// controllers/reportcontroller.js
const pool = require("../config/db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
} = require("docx");

/* =========================================================
   HELPER: SAFE DATABASE QUERY WITH CONNECTION RELEASE
========================================================= */

const safeQuery = async (text, params) => {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    } finally {
        client.release(); // ✅ Always release connection back to pool
    }
};

const safeTransaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } finally {
        client.release();
    }
};

/* =========================================================
   REPORT FILE UPLOAD
========================================================= */

const uploadDir = process.env.NODE_ENV === "production"
    ? path.join("/tmp", "reports")
    : path.join(__dirname, "../uploads/reports");

// Safely attempt folder creation
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} catch (err) {
    console.warn("Could not create upload directory synchronously:", err.message);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeName = path
            .basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9_-]/g, "_");
        cb(null, `${Date.now()}-${safeName}${ext}`);
    },
});

const reportUpload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "text/csv",
        ];

        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Unsupported file type"));
        }
        cb(null, true);
    },
});

/* =========================================================
   REPORT DOCUMENT TEXT EXTRACTION
========================================================= */

const extractReportContent = async (file) => {
    const extension = path.extname(file.originalname).toLowerCase();

    // PDF
    if (extension === ".pdf" || file.mimetype === "application/pdf") {
        const buffer = fs.readFileSync(file.path);
        const parsed = await pdfParse(buffer);
        return String(parsed.text || "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    // DOCX
    if (extension === ".docx" || file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const result = await mammoth.extractRawText({ path: file.path });
        return String(result.value || "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    // OLD .DOC
    if (extension === ".doc" || file.mimetype === "application/msword") {
        throw new Error("Old .doc files are not supported. Please save the document as .docx and upload it again.");
    }

    // Plain text / CSV / Markdown
    if ([".txt", ".csv", ".md", ".json"].includes(extension) || (file.mimetype && file.mimetype.startsWith("text/"))) {
        return fs.readFileSync(file.path, "utf8").trim();
    }

    // Other allowed files (Excel, images, etc.)
    return `Uploaded report attachment: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)`;
};

/* =========================================================
   GET CURRENT USER
========================================================= */

async function getCurrentUser(userId) {
    const result = await safeQuery(
        `
        SELECT
            id,
            full_name,
            email,
            role,
            is_active
        FROM users
        WHERE id = $1
        `,
        [userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

/* =========================================================
   BUILD ROLE-BASED PROJECT ACCESS
========================================================= */

function buildProjectAccess(role, userId, userParamNumber = 1) {
    if (["Executive Manager", "System Administrator", "Project Manager", "Task Manager"].includes(role)) {
        return { sql: "", params: [] };
    }

    if (role === "Member" || role === "Worker" || role === "Intern") {
        return {
            sql: `
                AND EXISTS (
                    SELECT 1
                    FROM tasks t_access
                    WHERE t_access.project_id = p.id
                    AND (t_access.assignee_id = $${userParamNumber} OR t_access.assigned_to = $${userParamNumber})
                )
            `,
            params: [userId],
        };
    }

    return { sql: `AND FALSE`, params: [] };
}

/* =========================================================
   GET REPORT OVERVIEW
========================================================= */

const getReportOverview = async (req, res) => {
    try {
        console.log('🔍 Fetching report overview for user:', req.user?.id);

        const user = await getCurrentUser(req.user.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive",
            });
        }

        const access = buildProjectAccess(user.role, user.id, 1);

        const result = await safeQuery(
            `
            SELECT
                p.id,
                p.name,
                p.domain,
                p.about_title,
                p.about_description,
                p.status,
                p.priority,
                p.start_date,
                p.deadline,
                p.progress,
                p.project_manager_id,

                manager.full_name AS project_manager_name,

                r.id AS report_id,
                r.title AS report_title,
                r.content AS report_content,
                r.format AS report_format,
                r.submitted_by AS report_submitted_by,

                submitter.full_name AS report_submitted_by_name,

                r.created_at AS report_created_at,
                r.updated_at AS report_updated_at,

                COUNT(DISTINCT t.id) AS total_tasks,
                COUNT(DISTINCT CASE WHEN t.status IN ('Completed', 'Done') THEN t.id END) AS completed_tasks

            FROM projects p

            LEFT JOIN users manager
                ON manager.id = p.project_manager_id

            LEFT JOIN project_reports r
                ON r.project_id = p.id

            LEFT JOIN users submitter
                ON submitter.id = r.submitted_by

            LEFT JOIN tasks t
                ON t.project_id = p.id

            WHERE 1 = 1
            ${access.sql}

            GROUP BY
                p.id,
                manager.full_name,
                r.id,
                r.title,
                r.content,
                r.format,
                r.submitted_by,
                submitter.full_name,
                r.created_at,
                r.updated_at

            ORDER BY p.created_at DESC
            `,
            access.params
        );

        const projects = result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            domain: row.domain,
            aboutTitle: row.about_title,
            aboutDescription: row.about_description,
            status: row.status,
            priority: row.priority,
            startDate: row.start_date,
            deadline: row.deadline,
            progress: Number(row.progress || 0),
            projectManager: {
                id: row.project_manager_id,
                name: row.project_manager_name,
            },
            totalTasks: Number(row.total_tasks || 0),
            completedTasks: Number(row.completed_tasks || 0),
            report: row.report_id ? {
                id: row.report_id,
                title: row.report_title,
                content: row.report_content,
                format: row.report_format,
                submittedBy: row.report_submitted_by,
                submittedByName: row.report_submitted_by_name,
                createdAt: row.report_created_at,
                updatedAt: row.report_updated_at,
            } : null,
            reportStatus: row.report_id ? "Done" : "Pending",
        }));

        const completedReports = projects.filter(p => p.reportStatus === "Done");
        const pendingReports = projects.filter(p => p.reportStatus === "Pending");

        console.log(`✅ Report overview: ${projects.length} projects, ${completedReports.length} completed, ${pendingReports.length} pending`);

        return res.json({
            success: true,
            user: {
                id: user.id,
                name: user.full_name,
                email: user.email,
                role: user.role,
            },
            permissions: {
                canCreateReport: user.role === "Project Manager",
                canEditReport: user.role === "Project Manager",
                canDeleteReport: false,
                canDownloadReport: user.role === "Executive Manager" || 
                                  user.role === "Project Manager" || 
                                  user.role === "Member" || 
                                  user.role === "System Administrator",
            },
            summary: {
                totalProjects: projects.length,
                completedReports: completedReports.length,
                pendingReports: pendingReports.length,
            },
            completedReports,
            pendingReports,
            projects,
        });

    } catch (error) {
        console.error("❌ getReportOverview error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to load reports",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   GET SINGLE PROJECT REPORT
========================================================= */

const getProjectReport = async (req, res) => {
    try {
        const { projectId } = req.params;

        console.log('🔍 Fetching project report:', { projectId, user: req.user?.id });

        const user = await getCurrentUser(req.user.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive",
            });
        }

        const access = buildProjectAccess(user.role, user.id, 2);

        const result = await safeQuery(
            `
            SELECT
                p.id,
                p.name,
                p.domain,
                p.status,
                p.priority,
                p.start_date,
                p.deadline,
                p.progress,
                p.project_manager_id,

                manager.full_name AS project_manager_name,

                r.id AS report_id,
                r.title,
                r.content,
                r.format,
                r.submitted_by,
                r.created_at,
                r.updated_at

            FROM projects p

            LEFT JOIN users manager
                ON manager.id = p.project_manager_id

            LEFT JOIN project_reports r
                ON r.project_id = p.id

            WHERE p.id = $1
            ${access.sql}
            `,
            [projectId, ...access.params]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found or you do not have permission to view it",
            });
        }

        console.log('✅ Project report found for:', projectId);

        return res.json({
            success: true,
            project: result.rows[0],
        });

    } catch (error) {
        console.error("❌ getProjectReport error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to load project report",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   CREATE / UPDATE REPORT
========================================================= */

const createOrUpdateReport = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { title, content, format } = req.body;

        console.log('🔍 Creating/updating report:', { projectId, title, format, user: req.user?.id });

        // Validate
        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Report title is required",
            });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: "Report content is required",
            });
        }

        if (!["PDF", "Word"].includes(format)) {
            return res.status(400).json({
                success: false,
                message: "Report format must be PDF or Word",
            });
        }

        const user = await getCurrentUser(req.user.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive",
            });
        }

        // Allow any manager/admin role to submit reports
        if (!["Project Manager", "Task Manager", "Executive Manager", "System Administrator"].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: "Only Managers or Administrators can create or update project reports",
            });
        }

        // Verify project exists
        const projectResult = await safeQuery(
            `
            SELECT id, name, project_manager_id
            FROM projects
            WHERE id = $1
            `,
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        // Upsert
        const result = await safeQuery(
            `
            INSERT INTO project_reports (
                project_id,
                submitted_by,
                title,
                content,
                format
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (project_id)
            DO UPDATE SET
                submitted_by = EXCLUDED.submitted_by,
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                format = EXCLUDED.format,
                updated_at = NOW()
            RETURNING *
            `,
            [
                projectId,
                user.id,
                title.trim(),
                content.trim(),
                format,
            ]
        );

        console.log('✅ Report saved for project:', projectId);

        return res.status(200).json({
            success: true,
            message: "Report saved successfully",
            report: result.rows[0],
        });

    } catch (error) {
        console.error("❌ createOrUpdateReport error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to save report",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   UPLOAD PROJECT REPORT FILE
========================================================= */

const uploadProjectReportFile = async (req, res) => {
    let uploadedFilePath = null;

    try {
        const { projectId } = req.params;

        console.log('🔍 Uploading report file:', { projectId, file: req.file?.originalname });

        // Check file
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select a file",
            });
        }

        uploadedFilePath = req.file.path;

        // Get current user
        const user = await getCurrentUser(req.user.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive",
            });
        }

        // Allow any manager/admin role to upload
        if (!["Project Manager", "Task Manager", "Executive Manager", "System Administrator"].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: "Only Managers or Administrators can upload project report files",
            });
        }

        // Verify project
        const projectResult = await safeQuery(
            `
            SELECT id, name, project_manager_id
            FROM projects
            WHERE id = $1
            `,
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        // Extract text from file
        console.log("========================================");
        console.log("REPORT FILE UPLOAD");
        console.log("Original file:", req.file.originalname);
        console.log("MIME type:", req.file.mimetype);
        console.log("File path:", req.file.path);
        console.log("File size:", req.file.size);
        console.log("========================================");

        let extractedContent = "";

        try {
            extractedContent = await extractReportContent(req.file);
            console.log("Extracted content length:", extractedContent.length);
        } catch (extractionError) {
            console.error("Report text extraction failed:", extractionError);
            return res.status(400).json({
                success: false,
                message: extractionError.message || "Could not extract readable text from this file.",
            });
        }

        if (!extractedContent || !extractedContent.trim()) {
            return res.status(400).json({
                success: false,
                message: "The file was uploaded, but no readable text was found. Make sure the PDF or Word document contains selectable text.",
            });
        }

        const fileUrl = `/uploads/reports/${req.file.filename}`;

        console.log('✅ File uploaded successfully:', req.file.filename);

        return res.status(200).json({
            success: true,
            message: "File uploaded and text extracted successfully",
            file: {
                originalName: req.file.originalname,
                fileName: req.file.filename,
                mimeType: req.file.mimetype,
                size: req.file.size,
                url: fileUrl,
            },
            content: extractedContent,
        });

    } catch (error) {
        console.error("❌ uploadProjectReportFile error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to upload project file",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   DOWNLOAD REPORT
========================================================= */

const downloadReport = async (req, res) => {
    try {
        const { projectId, format } = req.params;

        console.log('🔍 Downloading report:', { projectId, format, user: req.user?.id });

        // Validate format
        const requestedFormat = format === "pdf" ? "PDF" : format === "word" ? "Word" : null;

        if (!requestedFormat) {
            return res.status(400).json({
                success: false,
                message: "Invalid report format",
            });
        }

        // Get current user
        const user = await getCurrentUser(req.user.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive",
            });
        }

        // Role based project access
        const access = buildProjectAccess(user.role, user.id, 2);

        // Get project + optional saved report
        const result = await safeQuery(
            `
            SELECT
                p.id AS project_id,
                p.name AS project_name,
                p.domain,
                p.about_title,
                p.about_description,
                p.status,
                p.priority,
                p.start_date,
                p.start_time,
                p.deadline,
                p.deadline_time,
                p.progress,
                prog.name AS program_name,

                manager.full_name AS manager_name,

                r.title,
                r.content,
                r.format,
                r.created_at,
                r.updated_at

            FROM projects p

            LEFT JOIN project_reports r
                ON r.project_id = p.id

            LEFT JOIN programs prog
                ON prog.id = p.program_id

            LEFT JOIN users manager
                ON manager.id = COALESCE(p.project_manager_id, p.manager_id)

            WHERE p.id = $1
            ${access.sql}
            `,
            [projectId, ...access.params]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found or you do not have permission to access it",
            });
        }

        const report = result.rows[0];

        // Fetch all tasks for this project to include in the report
        const tasksRes = await safeQuery(
            `
            SELECT
                t.id,
                t.name,
                t.title,
                t.description,
                t.status,
                t.priority,
                t.start_date,
                t.start_time,
                t.due_date,
                t.due_time,
                u.full_name AS assignee_name
            FROM tasks t
            LEFT JOIN users u ON u.id = COALESCE(t.assignee_id, t.assigned_to)
            WHERE t.project_id = $1
            ORDER BY t.created_at DESC
            `,
            [projectId]
        );

        const projectTasks = tasksRes.rows;
        const totalTasks = projectTasks.length;
        const completedTasks = projectTasks.filter(t => t.status === "Completed" || t.status === "Done").length;
        const inProgressTasks = projectTasks.filter(t => t.status === "In Progress").length;
        const todoTasks = projectTasks.filter(t => !t.status || t.status === "To Do" || t.status === "Backlog").length;
        const nowStr = new Date().toISOString().split("T")[0];
        const overdueTasks = projectTasks.filter(
            t => t.due_date && String(t.due_date).split("T")[0] < nowStr && t.status !== "Completed" && t.status !== "Done"
        ).length;
        const computedProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : (report.progress || 0);

        const fmtDate = (d, tm) => {
            if (!d) return "N/A";
            const dStr = d instanceof Date ? d.toISOString().split("T")[0] : String(d).split("T")[0];
            return tm ? `${dStr} at ${tm}` : dStr;
        };

        // Clean values
        const projectName = report.project_name || "Project";
        const programName = report.program_name || "General Portfolio";
        const domainName = report.domain || "General";
        const reportTitle = report.title || `${projectName} - Project Status Report`;
        const managerName = report.manager_name || "Unassigned";
        const status = totalTasks > 0 && completedTasks === totalTasks ? "Completed" : (report.status || "Active");
        const priority = report.priority || "Medium";
        const progress = computedProgress;
        const startDate = fmtDate(report.start_date, report.start_time);
        const deadline = fmtDate(report.deadline, report.deadline_time);

        // Build comprehensive report content combining executive notes + task breakdown
        const lines = [];
        if (report.about_description) {
            lines.push(`Project Overview: ${report.about_description}`);
            lines.push("");
        }
        lines.push(`Task Summary: ${totalTasks} Total | ${completedTasks} Completed | ${inProgressTasks} In Progress | ${todoTasks} To Do | ${overdueTasks} Overdue`);
        lines.push("");

        if (report.content && report.content.trim()) {
            lines.push("Executive Report Notes:");
            lines.push(report.content.trim());
            lines.push("");
        }

        lines.push("Task Breakdown:");
        if (projectTasks.length === 0) {
            lines.push("  - No tasks recorded for this project yet.");
        } else {
            projectTasks.forEach((t, idx) => {
                const tName = t.name || t.title || "Untitled Task";
                const tStatus = t.status === "Done" ? "Completed" : (t.status || "To Do");
                const tAssignee = t.assignee_name || "Unassigned";
                const tStart = fmtDate(t.start_date, t.start_time);
                const tDue = fmtDate(t.due_date, t.due_time);
                lines.push(`  ${idx + 1}. ${tName}`);
                lines.push(`     Assigned to: ${tAssignee} | Status: ${tStatus} | Priority: ${t.priority || "Medium"}`);
                lines.push(`     Start: ${tStart} | Due: ${tDue}`);
            });
        }

        const reportContent = lines.join("\n");

        const safeProjectName = projectName
            .toString()
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .toLowerCase();

        // PDF Download
        if (requestedFormat === "PDF") {
            const regularFontPath = path.join(__dirname, "../fonts/DejaVuSans.ttf");
            const boldFontPath = path.join(__dirname, "../fonts/DejaVuSans-Bold.ttf");

            const doc = new PDFDocument({ margin: 50, size: "A4" });

            let regFont = "Helvetica";
            let bldFont = "Helvetica-Bold";
            if (fs.existsSync(regularFontPath) && fs.existsSync(boldFontPath)) {
                doc.registerFont("ReportRegular", regularFontPath);
                doc.registerFont("ReportBold", boldFontPath);
                regFont = "ReportRegular";
                bldFont = "ReportBold";
            }

            const filename = `${safeProjectName}_project_report.pdf`;

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Cache-Control", "no-store");

            doc.pipe(res);

            // Title
            doc.font(bldFont).fontSize(20).text(reportTitle, { align: "left" });
            doc.moveDown(0.5);
            doc.font(regFont).fontSize(10).fillColor("#555555").text(`Generated on ${new Date().toLocaleString()}`);
            doc.fillColor("#000000").moveDown();

            // Project Information
            doc.font(bldFont).fontSize(13).text("Project Summary");
            doc.moveDown(0.3);
            doc.font(regFont).fontSize(11);
            doc.text(`Project: ${projectName}`);
            doc.text(`Program: ${programName}`);
            doc.text(`Domain: ${domainName}`);
            doc.text(`Assigned to (Lead): ${managerName}`);
            doc.text(`Status: ${status}`);
            doc.text(`Priority: ${priority}`);
            doc.text(`Completion Progress: ${progress}% (${completedTasks}/${totalTasks} tasks)`);
            doc.text(`Start Date: ${startDate}`);
            doc.text(`Deadline: ${deadline}`);
            doc.moveDown();

            // Report Heading
            doc.font(bldFont).fontSize(13).text("Execution & Tasks Report");
            doc.moveDown(0.4);

            // Report Content
            doc.font(regFont).fontSize(10.5).text(reportContent, {
                lineGap: 4,
                width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                align: "left",
            });

            doc.end();
            return;
        }

        // Word Download
        if (requestedFormat === "Word") {
            const children = [
                new Paragraph({ text: reportTitle, heading: HeadingLevel.TITLE }),
                new Paragraph({ children: [new TextRun({ text: "Program: ", bold: true }), new TextRun(programName)] }),
                new Paragraph({ children: [new TextRun({ text: "Project: ", bold: true }), new TextRun(projectName)] }),
                new Paragraph({ children: [new TextRun({ text: "Domain: ", bold: true }), new TextRun(domainName)] }),
                new Paragraph({ children: [new TextRun({ text: "Assigned to (Lead): ", bold: true }), new TextRun(managerName)] }),
                new Paragraph({ children: [new TextRun({ text: "Status: ", bold: true }), new TextRun(status)] }),
                new Paragraph({ children: [new TextRun({ text: "Priority: ", bold: true }), new TextRun(priority)] }),
                new Paragraph({ children: [new TextRun({ text: "Progress: ", bold: true }), new TextRun(`${progress}% (${completedTasks}/${totalTasks} tasks)`)] }),
                new Paragraph({ children: [new TextRun({ text: "Start Date: ", bold: true }), new TextRun(String(startDate))] }),
                new Paragraph({ children: [new TextRun({ text: "Deadline: ", bold: true }), new TextRun(String(deadline))] }),
                new Paragraph({ text: "" }),
                new Paragraph({ text: "Execution & Tasks Report", heading: HeadingLevel.HEADING_1 }),
            ];

            const contentLines = String(reportContent).split(/\r?\n/);
            contentLines.forEach((line) => {
                children.push(new Paragraph({ children: [new TextRun(line)] }));
            });

            const document = new Document({ sections: [{ children }] });
            const buffer = await Packer.toBuffer(document);
            const filename = `${safeProjectName}_project_report.docx`;

            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Content-Length", buffer.length);
            res.setHeader("Cache-Control", "no-store");

            return res.end(buffer);
        }

    } catch (error) {
        console.error("❌ downloadReport error:", error);
        console.error("Stack:", error.stack);

        if (res.headersSent) {
            return res.end();
        }

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to download report",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   DOWNLOAD INDIVIDUAL MEMBER REPORT (PDF / WORD)
   GET /api/reports/user/:userId/download/:format
========================================================= */

const downloadIndividualReport = async (req, res) => {
    try {
        const { userId, format } = req.params;
        const requestedFormat = format === "pdf" ? "PDF" : format === "word" ? "Word" : null;

        if (!requestedFormat) {
            return res.status(400).json({
                success: false,
                message: "Invalid report format. Use 'pdf' or 'word'.",
            });
        }

        const userRes = await safeQuery(
            `SELECT id, full_name, email, role, job_title, remarks, is_active, created_at FROM users WHERE id = $1`,
            [userId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Member not found.",
            });
        }

        const member = userRes.rows[0];

        const tasksRes = await safeQuery(
            `
            SELECT
                t.id,
                t.name,
                t.title,
                t.status,
                t.priority,
                t.start_date,
                t.start_time,
                t.due_date,
                t.due_time,
                p.name AS project_name
            FROM tasks t
            LEFT JOIN projects p ON p.id = t.project_id
            WHERE t.assignee_id = $1 OR t.assigned_to = $1
            ORDER BY t.created_at DESC
            `,
            [userId]
        );

        const updatesRes = await safeQuery(
            `
            SELECT date, content, created_at, edited_at
            FROM daily_updates
            WHERE user_id = $1
            ORDER BY date DESC, created_at DESC
            LIMIT 15
            `,
            [userId]
        ).catch(() => ({ rows: [] }));

        const tasks = tasksRes.rows;
        const dailyUpdates = updatesRes.rows;
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === "Completed" || t.status === "Done").length;
        const inProgress = tasks.filter(t => t.status === "In Progress").length;
        const todo = tasks.filter(t => !t.status || t.status === "To Do" || t.status === "Backlog").length;
        const nowStr = new Date().toISOString().split("T")[0];
        const overdue = tasks.filter(
            t => t.due_date && String(t.due_date).split("T")[0] < nowStr && t.status !== "Completed" && t.status !== "Done"
        ).length;

        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const onTimeRate = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;
        const kpiScore = total > 0
            ? Math.min(100, Math.round(completionRate * 0.65 + onTimeRate * 0.25 + Math.min(10, dailyUpdates.length * 2)))
            : (dailyUpdates.length > 0 ? Math.min(100, 50 + dailyUpdates.length * 5) : 0);

        const fmtDate = (d, tm) => {
            if (!d) return "N/A";
            const dStr = d instanceof Date ? d.toISOString().split("T")[0] : String(d).split("T")[0];
            return tm ? `${dStr} at ${tm}` : dStr;
        };

        const lines = [];
        lines.push(`KPI Score: ${kpiScore} / 100`);
        lines.push(`Task Completion Rate: ${completionRate}% (${completed} of ${total} tasks completed)`);
        lines.push(`On-Time Delivery Rate: ${onTimeRate}% (${overdue} overdue)`);
        lines.push(`Task Breakdown: ${total} Total | ${completed} Completed | ${inProgress} In Progress | ${todo} To Do | ${overdue} Overdue`);
        lines.push(`Daily Updates Logged: ${dailyUpdates.length}`);
        lines.push("");

        if (member.remarks && member.remarks.trim()) {
            lines.push(`Management Remarks: ${member.remarks.trim()}`);
            lines.push("");
        }

        lines.push("Assigned Tasks:");
        if (tasks.length === 0) {
            lines.push("  - No tasks assigned to this member.");
        } else {
            tasks.forEach((t, idx) => {
                const tName = t.name || t.title || "Untitled Task";
                const tStatus = t.status === "Done" ? "Completed" : (t.status || "To Do");
                const tProj = t.project_name || "Standalone / Program Task";
                lines.push(`  ${idx + 1}. ${tName} [${tProj}]`);
                lines.push(`     Status: ${tStatus} | Priority: ${t.priority || "Medium"} | Start: ${fmtDate(t.start_date, t.start_time)} | Due: ${fmtDate(t.due_date, t.due_time)}`);
            });
        }

        lines.push("");
        lines.push("Recent Daily Updates:");
        if (dailyUpdates.length === 0) {
            lines.push("  - No daily updates logged.");
        } else {
            dailyUpdates.forEach((du, idx) => {
                const dStr = du.date instanceof Date ? du.date.toISOString().split("T")[0] : String(du.date).split("T")[0];
                const editTag = du.edited_at ? " (Edited)" : "";
                lines.push(`  ${idx + 1}. [${dStr}${editTag}] ${String(du.content || "").replace(/\r?\n/g, " ")}`);
            });
        }

        const reportBody = lines.join("\n");
        const safeUserName = (member.full_name || "member").toString().replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
        const reportTitle = `${member.full_name} - Individual KPI & Performance Report`;

        if (requestedFormat === "PDF") {
            const doc = new PDFDocument({ margin: 50, size: "A4" });
            const filename = `${safeUserName}_individual_report.pdf`;

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Cache-Control", "no-store");

            doc.pipe(res);

            doc.font("Helvetica-Bold").fontSize(19).text(reportTitle, { align: "left" });
            doc.moveDown(0.4);
            doc.font("Helvetica").fontSize(10).fillColor("#555555").text(`Generated on ${new Date().toLocaleString()}`);
            doc.fillColor("#000000").moveDown();

            doc.font("Helvetica-Bold").fontSize(13).text("Member Profile");
            doc.moveDown(0.3);
            doc.font("Helvetica").fontSize(11);
            doc.text(`Full Name: ${member.full_name}`);
            doc.text(`Role: ${member.role}`);
            doc.text(`Job Title: ${member.job_title || "Specialist"}`);
            doc.text(`Email: ${member.email}`);
            doc.text(`Status: ${member.is_active ? "Active" : "Inactive"}`);
            doc.moveDown();

            doc.font("Helvetica-Bold").fontSize(13).text("Performance & KPI Breakdown");
            doc.moveDown(0.4);
            doc.font("Helvetica").fontSize(10.5).text(reportBody, {
                lineGap: 4,
                width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                align: "left",
            });

            doc.end();
            return;
        }

        if (requestedFormat === "Word") {
            const children = [
                new Paragraph({ text: reportTitle, heading: HeadingLevel.TITLE }),
                new Paragraph({ children: [new TextRun({ text: "Full Name: ", bold: true }), new TextRun(member.full_name)] }),
                new Paragraph({ children: [new TextRun({ text: "Role: ", bold: true }), new TextRun(member.role)] }),
                new Paragraph({ children: [new TextRun({ text: "Job Title: ", bold: true }), new TextRun(member.job_title || "Specialist")] }),
                new Paragraph({ children: [new TextRun({ text: "Email: ", bold: true }), new TextRun(member.email)] }),
                new Paragraph({ children: [new TextRun({ text: "KPI Score: ", bold: true }), new TextRun(`${kpiScore} / 100`)] }),
                new Paragraph({ text: "" }),
                new Paragraph({ text: "Performance & Task Breakdown", heading: HeadingLevel.HEADING_1 }),
            ];

            reportBody.split(/\r?\n/).forEach(line => {
                children.push(new Paragraph({ children: [new TextRun(line)] }));
            });

            const document = new Document({ sections: [{ children }] });
            const buffer = await Packer.toBuffer(document);
            const filename = `${safeUserName}_individual_report.docx`;

            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Content-Length", buffer.length);
            res.setHeader("Cache-Control", "no-store");

            return res.end(buffer);
        }
    } catch (error) {
        console.error("❌ downloadIndividualReport error:", error);
        if (res.headersSent) return res.end();
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to download individual report",
        });
    }
};

module.exports = {
    getReportOverview,
    getProjectReport,
    createOrUpdateReport,
    downloadReport,
    downloadIndividualReport,
    uploadProjectReportFile,
    reportUpload,
};
