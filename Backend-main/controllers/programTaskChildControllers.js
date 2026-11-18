// controllers/programTaskChildControllers.js
const pool = require("../config/db");

const MANAGEMENT_ROLES = [
    "Project Manager",
    "Task Manager",
    "Executive Manager",
    "System Administrator",
];
const isManagementRole = (r) => MANAGEMENT_ROLES.includes(r);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
    "pdf", "doc", "docx", "txt", "rtf", "md",
    "csv", "xls", "xlsx", "ppt", "pptx",
    "png", "jpg", "jpeg", "webp", "gif", "svg",
    "zip", "rar", "7z", "json", "mp4", "mp3", "wav"
];

const safeQuery = async (text, params) => {
    const c = await pool.connect();
    try {
        return await c.query(text, params);
    } finally {
        c.release();
    }
};

/* =========================================================
   CHALLENGES
========================================================= */

const getProgramTaskChallenges = async (req, res) => {
    try {
        const { taskId } = req.params;

        const t = await safeQuery(
            `SELECT id, assignee_id FROM program_project_tasks WHERE id = $1`,
            [taskId]
        );
        if (t.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }

        const isManager = isManagementRole(req.user.role);
        const isAssignee =
            String(t.rows[0].assignee_id || "") === String(req.user.id);

        if (!isManager && !isAssignee) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }

        const r = await safeQuery(
            `
            SELECT c.*, u.full_name AS author_name, u.email AS author_email
            FROM program_task_challenges c
            LEFT JOIN users u ON u.id = c.user_id
            WHERE c.program_task_id = $1
            ORDER BY c.created_at ASC
            `,
            [taskId]
        );

        return res.status(200).json({ success: true, challenges: r.rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed to fetch." });
    }
};

const createProgramTaskChallenge = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { challenge } = req.body;

        if (req.user.role !== "Member") {
            return res.status(403).json({
                success: false,
                message: "Only Members can add challenges.",
            });
        }
        if (!challenge || !challenge.trim()) {
            return res.status(400).json({
                success: false,
                message: "Challenge text is required.",
            });
        }

        const t = await safeQuery(
            `SELECT assignee_id FROM program_project_tasks WHERE id = $1`,
            [taskId]
        );
        if (t.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }
        if (String(t.rows[0].assignee_id || "") !== String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "You can only add challenges to tasks assigned to you.",
            });
        }

        const r = await safeQuery(
            `
            INSERT INTO program_task_challenges (program_task_id, user_id, challenge)
            VALUES ($1, $2, $3)
            RETURNING *
            `,
            [taskId, req.user.id, challenge.trim()]
        );

        return res.status(201).json({
            success: true,
            challenge: r.rows[0],
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed to add challenge." });
    }
};

const deleteProgramTaskChallenge = async (req, res) => {
    try {
        const { challengeId } = req.params;

        const r = await safeQuery(
            `SELECT * FROM program_task_challenges WHERE id = $1`,
            [challengeId]
        );
        if (r.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Challenge not found." });
        }
        const ch = r.rows[0];
        const isManager = isManagementRole(req.user.role);
        const isOwner = String(ch.user_id) === String(req.user.id);
        if (!isManager && !isOwner) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }

        await safeQuery(
            `DELETE FROM program_task_challenges WHERE id = $1`,
            [challengeId]
        );

        return res.status(200).json({ success: true, message: "Deleted." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed to delete." });
    }
};

/* =========================================================
   ATTACHMENTS (Member + Manager)
========================================================= */

const uploadProgramTaskAttachment = async (req, res) => {
    try {
        const { taskId } = req.params;
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file provided." });
        }

        const t = await safeQuery(
            `SELECT id, assignee_id FROM program_project_tasks WHERE id = $1`,
            [taskId]
        );
        if (t.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }

        const isManager = isManagementRole(req.user.role);
        const isAssignee =
            String(t.rows[0].assignee_id || "") === String(req.user.id);
        if (!isManager && !isAssignee) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }

        const { originalname, buffer, size, mimetype } = req.file;
        if (size > MAX_FILE_SIZE) {
            return res.status(400).json({ success: false, message: "File exceeds 10 MB." });
        }
        const ext = originalname.includes(".") ? originalname.split(".").pop().toLowerCase() : "bin";
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return res.status(400).json({ success: false, message: `Invalid file extension (.${ext}).` });
        }

        const r = await safeQuery(
            `
            INSERT INTO program_task_attachments (
                program_task_id, file_name, file_type, mime_type,
                file_size, file_content, uploaded_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING id, program_task_id, file_name, file_type, mime_type,
                      file_size, uploaded_by, created_at
            `,
            [taskId, originalname, ext, mimetype, size, buffer, req.user.id]
        );

        return res.status(201).json({ success: true, attachment: r.rows[0] });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed to upload." });
    }
};

const getProgramTaskAttachments = async (req, res) => {
    try {
        const { taskId } = req.params;

        const t = await safeQuery(
            `SELECT assignee_id FROM program_project_tasks WHERE id = $1`,
            [taskId]
        );
        if (t.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }
        const isManager = isManagementRole(req.user.role);
        const isAssignee =
            String(t.rows[0].assignee_id || "") === String(req.user.id);
        if (!isManager && !isAssignee) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }

        const r = await safeQuery(
            `
            SELECT a.id, a.program_task_id, a.file_name, a.file_type, a.mime_type,
                   a.file_size, a.uploaded_by, a.created_at, a.updated_at,
                   u.full_name AS uploader_name
            FROM program_task_attachments a
            LEFT JOIN users u ON u.id = a.uploaded_by
            WHERE a.program_task_id = $1
            ORDER BY a.created_at DESC
            `,
            [taskId]
        );

        return res.status(200).json({ success: true, attachments: r.rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed." });
    }
};

const downloadProgramTaskAttachment = async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const r = await safeQuery(
            `
            SELECT a.*, t.assignee_id
            FROM program_task_attachments a
            INNER JOIN program_project_tasks t ON t.id = a.program_task_id
            WHERE a.id = $1
            `,
            [attachmentId]
        );
        if (r.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Not found." });
        }
        const f = r.rows[0];
        const isManager = isManagementRole(req.user.role);
        const isAssignee = String(f.assignee_id || "") === String(req.user.id);
        if (!isManager && !isAssignee) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }

        const buf = Buffer.isBuffer(f.file_content)
            ? f.file_content
            : Buffer.from(f.file_content);

        res.setHeader("Content-Type", f.mime_type || "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(f.file_name)}"`
        );
        res.setHeader("Content-Length", buf.length);
        return res.status(200).send(buf);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed." });
    }
};

const previewProgramTaskAttachment = async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const r = await safeQuery(
            `
            SELECT a.*, t.assignee_id
            FROM program_task_attachments a
            INNER JOIN program_project_tasks t ON t.id = a.program_task_id
            WHERE a.id = $1
            `,
            [attachmentId]
        );
        if (r.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Not found." });
        }
        const f = r.rows[0];
        const isManager = isManagementRole(req.user.role);
        const isAssignee = String(f.assignee_id || "") === String(req.user.id);
        if (!isManager && !isAssignee) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }

        const buf = Buffer.isBuffer(f.file_content)
            ? f.file_content
            : Buffer.from(f.file_content);

        res.setHeader("Content-Type", f.mime_type || "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${encodeURIComponent(f.file_name)}"`
        );
        res.setHeader("Content-Length", buf.length);
        res.setHeader("Cache-Control", "private, no-store, max-age=0");
        return res.status(200).send(buf);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed." });
    }
};

const deleteProgramTaskAttachment = async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const r = await safeQuery(
            `SELECT * FROM program_task_attachments WHERE id = $1`,
            [attachmentId]
        );
        if (r.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Not found." });
        }
        const a = r.rows[0];
        const isManager = isManagementRole(req.user.role);
        const isUploader = String(a.uploaded_by) === String(req.user.id);
        if (!isManager && !isUploader) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }

        await safeQuery(
            `DELETE FROM program_task_attachments WHERE id = $1`,
            [attachmentId]
        );

        return res.status(200).json({ success: true, message: "Deleted." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed." });
    }
};

/* =========================================================
   WORK PARTS
========================================================= */

const getProgramTaskWorkParts = async (req, res) => {
    try {
        const { taskId } = req.params;
        const r = await safeQuery(
            `
            SELECT w.*, u.full_name AS creator_name, u.email AS creator_email, u.role AS creator_role
            FROM program_task_work_parts w
            LEFT JOIN users u ON u.id = w.created_by
            WHERE w.program_task_id = $1
            ORDER BY w.created_at ASC
            `,
            [taskId]
        );
        return res.status(200).json({ success: true, workParts: r.rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed." });
    }
};

const createProgramTaskWorkPart = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { title, description, status } = req.body;

        const t = await safeQuery(
            `SELECT id, assignee_id, status FROM program_project_tasks WHERE id = $1`,
            [taskId]
        );
        if (t.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }
        const task = t.rows[0];

        const isManager = isManagementRole(req.user.role);
        const isAssignee = String(task.assignee_id || "") === String(req.user.id);
        if (!isManager && !isAssignee) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "Title is required." });
        }

        const VALID = ["To Do", "Pending", "Done"];
        const st = VALID.includes(status) ? status : "To Do";

        const r = await safeQuery(
            `
            INSERT INTO program_task_work_parts
                (program_task_id, created_by, title, description, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [taskId, req.user.id, title.trim(), description?.trim() || null, st]
        );

        return res.status(201).json({ success: true, workPart: r.rows[0] });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed." });
    }
};

const updateProgramTaskWorkPartStatus = async (req, res) => {
    try {
        const { workPartId } = req.params;
        const { status } = req.body;
        const VALID = ["To Do", "Pending", "Done"];
        if (!VALID.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status." });
        }

        const r = await safeQuery(
            `SELECT * FROM program_task_work_parts WHERE id = $1`,
            [workPartId]
        );
        if (r.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Not found." });
        }

        const part = r.rows[0];
        const isManager = isManagementRole(req.user.role);
        const isCreator = String(part.created_by) === String(req.user.id);

        const t = await safeQuery(
            `SELECT assignee_id FROM program_project_tasks WHERE id = $1`,
            [part.program_task_id]
        );
        const isAssignee =
            String(t.rows[0]?.assignee_id || "") === String(req.user.id);

        if (!isManager && !isCreator && !isAssignee) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }

        await safeQuery(
            `
            UPDATE program_task_work_parts
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            `,
            [status, workPartId]
        );

        return res.status(200).json({ success: true, message: "Updated." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed." });
    }
};

const deleteProgramTaskWorkPart = async (req, res) => {
    try {
        const { workPartId } = req.params;
        const r = await safeQuery(
            `SELECT * FROM program_task_work_parts WHERE id = $1`,
            [workPartId]
        );
        if (r.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Not found." });
        }
        const part = r.rows[0];
        const isManager = isManagementRole(req.user.role);
        const isCreator = String(part.created_by) === String(req.user.id);
        if (!isManager && !isCreator) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }
        await safeQuery(
            `DELETE FROM program_task_work_parts WHERE id = $1`,
            [workPartId]
        );
        return res.status(200).json({ success: true, message: "Deleted." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed." });
    }
};

/* =========================================================
   SUBMISSIONS
========================================================= */

const getProgramTaskSubmissions = async (req, res) => {
    try {
        const { taskId } = req.params;

        const t = await safeQuery(
            `SELECT assignee_id FROM program_project_tasks WHERE id = $1`,
            [taskId]
        );
        if (t.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }
        const isManager = isManagementRole(req.user.role);
        const isAssignee =
            String(t.rows[0].assignee_id || "") === String(req.user.id);
        if (!isManager && !isAssignee) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }

        const r = await safeQuery(
            `
            SELECT s.*, u.full_name AS submitter_name, u.email AS submitter_email
            FROM program_task_submissions s
            LEFT JOIN users u ON u.id = s.user_id
            WHERE s.program_task_id = $1
            ORDER BY s.created_at DESC
            `,
            [taskId]
        );

        return res.status(200).json({ success: true, submissions: r.rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed." });
    }
};

const createProgramTaskSubmission = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { link, description } = req.body;

        const t = await safeQuery(
            `SELECT id, assignee_id, status FROM program_project_tasks WHERE id = $1`,
            [taskId]
        );
        if (t.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }
        const task = t.rows[0];

        if (String(task.assignee_id || "") !== String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "Only the assignee can submit work.",
            });
        }
        if (task.status === "Done") {
            return res.status(400).json({
                success: false,
                message: "Task is already Done.",
            });
        }

        const parts = await safeQuery(
            `SELECT COUNT(*)::int AS c FROM program_task_work_parts WHERE program_task_id = $1`,
            [taskId]
        );
        if (parts.rows[0].c === 0) {
            return res.status(400).json({
                success: false,
                message: "Add at least one work part before submitting.",
            });
        }

        const r = await safeQuery(
            `
            INSERT INTO program_task_submissions
                (program_task_id, user_id, link, description, version)
            VALUES ($1, $2, $3, $4,
                (SELECT COALESCE(MAX(version), 0) + 1 FROM program_task_submissions WHERE program_task_id = $1)
            )
            RETURNING *
            `,
            [taskId, req.user.id, link || null, description || null]
        );

        if (task.status === "To Do") {
            await safeQuery(
                `UPDATE program_project_tasks SET status = 'In Progress' WHERE id = $1`,
                [taskId]
            );
        }

        return res.status(201).json({ success: true, submission: r.rows[0] });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed." });
    }
};

const deleteProgramTaskSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const r = await safeQuery(
            `SELECT * FROM program_task_submissions WHERE id = $1`,
            [submissionId]
        );
        if (r.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Not found." });
        }
        const sub = r.rows[0];
        const isManager = isManagementRole(req.user.role);
        const isOwner = String(sub.user_id) === String(req.user.id);
        if (!isManager && !isOwner) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }
        await safeQuery(
            `DELETE FROM program_task_submissions WHERE id = $1`,
            [submissionId]
        );
        return res.status(200).json({ success: true, message: "Deleted." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Failed." });
    }
};

module.exports = {
    getProgramTaskChallenges,
    createProgramTaskChallenge,
    deleteProgramTaskChallenge,

    uploadProgramTaskAttachment,
    getProgramTaskAttachments,
    downloadProgramTaskAttachment,
    previewProgramTaskAttachment,
    deleteProgramTaskAttachment,

    getProgramTaskWorkParts,
    createProgramTaskWorkPart,
    updateProgramTaskWorkPartStatus,
    deleteProgramTaskWorkPart,

    getProgramTaskSubmissions,
    createProgramTaskSubmission,
    deleteProgramTaskSubmission,
};
