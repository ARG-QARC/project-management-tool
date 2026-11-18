const pool = require("../config/db");

// =========================================================
// FILE CONFIGURATION
// =========================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = [
    "pdf", "doc", "docx", "txt", "rtf", "md",
    "csv", "xls", "xlsx", "ppt", "pptx",
    "png", "jpg", "jpeg", "webp", "gif", "svg",
    "zip", "rar", "7z", "json", "mp4", "mp3", "wav"
];

const MANAGEMENT_ROLES = [
    "System Administrator",
    "Executive Manager",
    "Project Manager",
    "Task Manager",
];


// =========================================================
// HELPER
// =========================================================

const isManagementRole = (role) => {
    return MANAGEMENT_ROLES.includes(role);
};


// =========================================================
// UPLOAD TASK ATTACHMENT
// =========================================================

const uploadTaskAttachment = async (req, res) => {
    try {
        const { taskId } = req.params;

        const userId = req.user.id;

        // -----------------------------------------------------
        // File exists
        // -----------------------------------------------------

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file provided.",
            });
        }

        const {
            originalname,
            buffer,
            size,
            mimetype,
        } = req.file;

        // -----------------------------------------------------
        // File size
        // -----------------------------------------------------

        if (size > MAX_FILE_SIZE) {
            return res.status(400).json({
                success: false,
                message: `File size must not exceed 10 MB. Current size: ${(
                    size /
                    (1024 * 1024)
                ).toFixed(2)} MB`,
            });
        }

        // -----------------------------------------------------
        // Extension
        // -----------------------------------------------------

        const fileExtension = originalname.includes(".")
            ? originalname.split(".").pop().toLowerCase()
            : "bin";

        if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
            return res.status(400).json({
                success: false,
                message: `Invalid file extension (.${fileExtension}). Allowed: ${ALLOWED_EXTENSIONS.join(
                    ", "
                )}`,
            });
        }

        // -----------------------------------------------------
        // Verify task
        // -----------------------------------------------------

        const taskCheck = await pool.query(
            "SELECT id FROM tasks WHERE id = $1 UNION SELECT id FROM program_project_tasks WHERE id = $1",
            [taskId]
        );

        if (taskCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Task not found.",
            });
        }

        // -----------------------------------------------------
        // Verify buffer
        // -----------------------------------------------------

        if (!Buffer.isBuffer(buffer)) {
            return res.status(400).json({
                success: false,
                message: "Uploaded file content is invalid.",
            });
        }

        // -----------------------------------------------------
        // Save file
        // -----------------------------------------------------

        const result = await pool.query(
            `
            INSERT INTO task_attachments (
                id,
                task_id,
                file_name,
                file_type,
                mime_type,
                file_size,
                file_content,
                uploaded_by
            )
            VALUES ('att-' || extract(epoch from now())::bigint || '-' || floor(random()*100000)::text, $1, $2, $3, $4, $5, $6, $7)
            RETURNING
                id,
                task_id,
                file_name,
                file_type,
                mime_type,
                file_size,
                uploaded_by,
                created_at,
                updated_at
            `,
            [
                taskId,
                originalname,
                fileExtension,
                mimetype,
                size,
                buffer,
                userId,
            ]
        );

        const attachment = result.rows[0];

        return res.status(201).json({
            success: true,
            message: "File uploaded successfully.",
            attachment: {
                id: attachment.id,
                taskId: attachment.task_id,
                fileName: attachment.file_name,
                fileType: attachment.file_type,
                mimeType: attachment.mime_type,
                fileSize: attachment.file_size,
                uploadedBy: attachment.uploaded_by,
                createdAt: attachment.created_at,
                updatedAt: attachment.updated_at,
            },
        });
    } catch (error) {
        console.error("Upload attachment error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to upload file.",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};


// =========================================================
// GET TASK ATTACHMENTS
// IMPORTANT: DO NOT RETURN file_content HERE
// =========================================================

const getTaskAttachments = async (req, res) => {
    try {
        const { taskId } = req.params;

        // -----------------------------------------------------
        // Get attachment metadata only
        // -----------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                ta.id,
                ta.task_id,
                ta.file_name,
                ta.file_type,
                ta.mime_type,
                ta.file_size,
                ta.uploaded_by,
                ta.created_at,
                u.full_name AS uploader_name
            FROM task_attachments ta
            LEFT JOIN users u
                ON ta.uploaded_by = u.id
            WHERE ta.task_id = $1
            ORDER BY ta.created_at DESC
            `,
            [taskId]
        );

        return res.status(200).json({
            success: true,
            attachments: result.rows,
        });
    } catch (error) {
        console.error("Get attachments error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve attachments.",
        });
    }
};


// =========================================================
// DOWNLOAD ATTACHMENT
// =========================================================

const downloadTaskAttachment = async (req, res) => {
    try {
        const { attachmentId } = req.params;

        const result = await pool.query(
            `
            SELECT
                ta.id,
                ta.task_id,
                ta.file_name,
                ta.mime_type,
                ta.file_content,
                t.assignee_id
            FROM task_attachments ta
            LEFT JOIN tasks t
                ON ta.task_id = t.id
            WHERE ta.id = $1
            `,
            [attachmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Attachment not found.",
            });
        }

        const attachment = result.rows[0];

        // -----------------------------------------------------
        // Validate database content
        // -----------------------------------------------------

        if (!attachment.file_content) {
            return res.status(404).json({
                success: false,
                message: "File content is missing from database.",
            });
        }

        const fileBuffer = Buffer.isBuffer(attachment.file_content)
            ? attachment.file_content
            : Buffer.from(attachment.file_content);

        // -----------------------------------------------------
        // Headers
        // -----------------------------------------------------

        res.setHeader(
            "Content-Type",
            attachment.mime_type || "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(
                attachment.file_name
            )}"`
        );

        res.setHeader(
            "Content-Length",
            fileBuffer.length
        );

        return res.status(200).send(fileBuffer);
    } catch (error) {
        console.error("Download attachment error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to download file.",
        });
    }
};


// =========================================================
// PREVIEW ATTACHMENT
// =========================================================

const previewTaskAttachment = async (req, res) => {
    try {
        const { attachmentId } = req.params;

        // -----------------------------------------------------
        // Get file
        // -----------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                ta.id,
                ta.task_id,
                ta.file_name,
                ta.mime_type,
                ta.file_type,
                ta.file_content,
                t.assignee_id
            FROM task_attachments ta
            LEFT JOIN tasks t
                ON ta.task_id = t.id
            WHERE ta.id = $1
            `,
            [attachmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Attachment not found.",
            });
        }

        const attachment = result.rows[0];

        // -----------------------------------------------------
        // Make sure BYTEA exists
        // -----------------------------------------------------

        if (!attachment.file_content) {
            return res.status(404).json({
                success: false,
                message: "File content is missing from database.",
            });
        }

        // PostgreSQL BYTEA normally comes back as Buffer.
        // This also safely handles Uint8Array/string cases.
        const fileBuffer = Buffer.isBuffer(attachment.file_content)
            ? attachment.file_content
            : Buffer.from(attachment.file_content);

        // -----------------------------------------------------
        // Inline browser response
        // -----------------------------------------------------

        res.setHeader(
            "Content-Type",
            attachment.mime_type || "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `inline; filename="${encodeURIComponent(
                attachment.file_name
            )}"`
        );

        res.setHeader(
            "Content-Length",
            fileBuffer.length
        );

        // Prevent caching of protected task files
        res.setHeader(
            "Cache-Control",
            "private, no-store, max-age=0"
        );

        return res.status(200).send(fileBuffer);
    } catch (error) {
        console.error("Preview attachment error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to preview file.",
        });
    }
};


// =========================================================
// DELETE ATTACHMENT
// =========================================================

const deleteTaskAttachment = async (req, res) => {
    try {
        const { attachmentId } = req.params;

        const userId = req.user.id;
        const userRole = req.user.role;

        const result = await pool.query(
            `
            SELECT
                id,
                uploaded_by
            FROM task_attachments
            WHERE id = $1
            `,
            [attachmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Attachment not found.",
            });
        }

        const attachment = result.rows[0];

        const management = isManagementRole(userRole);

        const uploader =
            String(attachment.uploaded_by || "") === String(userId);

        if (!management && !uploader) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not authorized to delete this file.",
            });
        }

        await pool.query(
            `
            DELETE FROM task_attachments
            WHERE id = $1
            `,
            [attachmentId]
        );

        return res.status(200).json({
            success: true,
            message: "File deleted successfully.",
        });
    } catch (error) {
        console.error("Delete attachment error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete attachment.",
        });
    }
};


module.exports = {
    uploadTaskAttachment,
    getTaskAttachments,
    downloadTaskAttachment,
    previewTaskAttachment,
    deleteTaskAttachment,
};
