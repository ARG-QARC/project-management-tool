// controllers/taskWorkPartController.js
const pool = require('../config/db');

const isManagementRole = async (userId) => {
    const result = await pool.query(
        'SELECT role FROM users WHERE id = $1',
        [userId]
    );
    const role = result.rows[0]?.role;
    return ['System Administrator', 'Executive Manager', 'Project Manager', 'Task Manager'].includes(role);
};

// =========================================================
// CREATE WORK PART
// POST /api/tasks/:taskId/work-parts
// =========================================================
const createWorkPart = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        const { title, description, status } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const validStatuses = ['To Do', 'Pending', 'Done'];
        const finalStatus = status && validStatuses.includes(status)
            ? status
            : 'To Do';

        // Verify task exists
        const taskResult = await pool.query(
            'SELECT id, assignee_id FROM tasks WHERE id = $1',
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskResult.rows[0];

        // Permission: assignee (Member) OR management can create parts
        const isAssignee = String(task.assignee_id) === String(userId);
        const isManager = await isManagementRole(userId);

        if (!isAssignee && !isManager) {
            return res.status(403).json({
                error: 'Only the assigned Member or management can add work parts'
            });
        }

        const result = await pool.query(
            `INSERT INTO task_work_parts (task_id, created_by, title, description, status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [taskId, userId, title.trim(), description || null, finalStatus]
        );

        // Enrich with creator info
        const creatorResult = await pool.query(
            'SELECT full_name, email FROM users WHERE id = $1',
            [userId]
        );

        const workPart = result.rows[0];
        workPart.creator_name = creatorResult.rows[0]?.full_name || '';
        workPart.creator_email = creatorResult.rows[0]?.email || '';

        res.status(201).json({
            success: true,
            workPart,
            message: 'Work part created successfully'
        });

    } catch (error) {
        console.error('Create work part error:', error);
        res.status(500).json({
            error: error.message || 'Failed to create work part'
        });
    }
};

// =========================================================
// GET WORK PARTS FOR TASK
// GET /api/tasks/:taskId/work-parts
// =========================================================
const getWorkParts = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        const taskResult = await pool.query(
            'SELECT assignee_id FROM tasks WHERE id = $1',
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskResult.rows[0];
        const isAssignee = String(task.assignee_id) === String(userId);
        const isManager = await isManagementRole(userId);

        if (!isAssignee && !isManager) {
            return res.status(403).json({
                error: 'Not authorized to view work parts'
            });
        }

        const result = await pool.query(
            `SELECT 
                wp.*,
                u.full_name as creator_name,
                u.email as creator_email,
                u.role as creator_role
             FROM task_work_parts wp
             LEFT JOIN users u ON wp.created_by = u.id
             WHERE wp.task_id = $1
             ORDER BY wp.created_at ASC`,
            [taskId]
        );

        res.json({
            success: true,
            workParts: result.rows
        });

    } catch (error) {
        console.error('Get work parts error:', error);
        res.status(500).json({
            error: error.message || 'Failed to get work parts'
        });
    }
};

// =========================================================
// UPDATE WORK PART STATUS
// PATCH /api/work-parts/:workPartId/status
// =========================================================
const updateWorkPartStatus = async (req, res) => {
    try {
        const { workPartId } = req.params;
        const userId = req.user.id;
        const { status } = req.body;

        const validStatuses = ['To Do', 'Pending', 'Done'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: "Status must be 'To Do', 'Pending', or 'Done'"
            });
        }

        // Get work part + related task
        const partResult = await pool.query(
            `SELECT wp.id, wp.created_by, wp.task_id, t.assignee_id
             FROM task_work_parts wp
             JOIN tasks t ON wp.task_id = t.id
             WHERE wp.id = $1`,
            [workPartId]
        );

        if (partResult.rows.length === 0) {
            return res.status(404).json({ error: 'Work part not found' });
        }

        const part = partResult.rows[0];

        // Permission: creator, task assignee, or management
        const isCreator = String(part.created_by) === String(userId);
        const isAssignee = String(part.assignee_id) === String(userId);
        const isManager = await isManagementRole(userId);

        if (!isCreator && !isAssignee && !isManager) {
            return res.status(403).json({
                error: 'Not authorized to update this work part'
            });
        }

        const result = await pool.query(
            `UPDATE task_work_parts
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [status, workPartId]
        );

        res.json({
            success: true,
            workPart: result.rows[0],
            message: 'Work part status updated'
        });

    } catch (error) {
        console.error('Update work part status error:', error);
        res.status(500).json({
            error: error.message || 'Failed to update work part status'
        });
    }
};

// =========================================================
// DELETE WORK PART
// DELETE /api/work-parts/:workPartId
// =========================================================
const deleteWorkPart = async (req, res) => {
    try {
        const { workPartId } = req.params;
        const userId = req.user.id;

        const partResult = await pool.query(
            `SELECT wp.id, wp.created_by, wp.task_id
             FROM task_work_parts wp
             WHERE wp.id = $1`,
            [workPartId]
        );

        if (partResult.rows.length === 0) {
            return res.status(404).json({ error: 'Work part not found' });
        }

        const part = partResult.rows[0];
        const isCreator = String(part.created_by) === String(userId);
        const isManager = await isManagementRole(userId);

        if (!isCreator && !isManager) {
            return res.status(403).json({
                error: 'Not authorized to delete this work part'
            });
        }

        await pool.query(
            'DELETE FROM task_work_parts WHERE id = $1',
            [workPartId]
        );

        res.json({
            success: true,
            message: 'Work part deleted'
        });

    } catch (error) {
        console.error('Delete work part error:', error);
        res.status(500).json({
            error: error.message || 'Failed to delete work part'
        });
    }
};

module.exports = {
    createWorkPart,
    getWorkParts,
    updateWorkPartStatus,
    deleteWorkPart
};
