const { Pool } = require('pg');
const pool = require('../config/db'); // Your DB connection

// Helper to check if user is assigned to task
const isTaskAssignee = async (taskId, userId) => {
    const result = await pool.query(
        'SELECT assignee_id FROM tasks WHERE id = $1',
        [taskId]
    );
    return result.rows[0]?.assignee_id === userId;
};

// Helper to check if user has management role
const isManagementRole = async (userId) => {
    const result = await pool.query(
        'SELECT role FROM users WHERE id = $1',
        [userId]
    );
    const role = result.rows[0]?.role;
    return ['System Administrator', 'Executive Manager', 'Project Manager', 'Task Manager'].includes(role);
};

// ================================
// SUBMISSION CONTROLLERS
// ================================

const addSubmission = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        const { link, description } = req.body;

        // Verify task exists
        const taskResult = await pool.query(
            'SELECT id, assignee_id, status FROM tasks WHERE id = $1',
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskResult.rows[0];

        // Only the assignee can submit work
        if (String(task.assignee_id) !== String(userId)) {
            return res.status(403).json({
                error: 'Only the task assignee can submit work'
            });
        }

        if (task.status === 'Done') {
            return res.status(400).json({
                error: 'Task is already marked as Done'
            });
        }

        // Only Members can submit
        const userResult = await pool.query(
            'SELECT role FROM users WHERE id = $1',
            [userId]
        );
        const userRole = userResult.rows[0]?.role;

        if (userRole !== 'Member' && userRole !== 'Worker') {
            return res.status(403).json({
                error: 'Only Members and Workers can submit work'
            });
        }

        // =========================================================
        // REQUIRE: at least one work part
        // =========================================================
        const partsCheck = await pool.query(
            'SELECT COUNT(*)::int AS count FROM task_work_parts WHERE task_id = $1',
            [taskId]
        );

        if (partsCheck.rows[0].count === 0) {
            return res.status(400).json({
                error: 'Please add at least one work part before submitting. Work parts describe what you did.'
            });
        }

        // =========================================================
        // Insert submission (link is now OPTIONAL)
        // =========================================================
        const result = await pool.query(
            `INSERT INTO task_submissions (task_id, user_id, link, description, version)
             VALUES ($1, $2, $3, $4,
                 (SELECT COALESCE(MAX(version), 0) + 1 FROM task_submissions WHERE task_id = $1)
             )
             RETURNING *`,
            [taskId, userId, link || null, description || null]
        );

        // Update task status to "In Progress" if it was "To Do"
        if (task.status === 'To Do') {
            await pool.query(
                'UPDATE tasks SET status = $1 WHERE id = $2',
                ['In Progress', taskId]
            );
        }

        res.status(201).json({
            success: true,
            submission: result.rows[0],
            message: 'Work submitted successfully'
        });

    } catch (error) {
        console.error('Add submission error:', error);
        res.status(500).json({
            error: error.message || 'Failed to add submission'
        });
    }
};

// Get all submissions for a task
const getSubmissions = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        // Verify task exists
        const taskResult = await pool.query(
            'SELECT assignee_id FROM tasks WHERE id = $1',
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskResult.rows[0];

        // Check permissions: assignee OR management can view
        const isAssignee = task.assignee_id === userId;
        const isManager = await isManagementRole(userId);

        if (!isAssignee && !isManager) {
            return res.status(403).json({ 
                error: 'You are not authorized to view these submissions' 
            });
        }

        // Get submissions with user info
        const result = await pool.query(
            `SELECT 
                ts.*,
                u.full_name as submitter_name,
                u.email as submitter_email
             FROM task_submissions ts
             LEFT JOIN users u ON ts.user_id = u.id
             WHERE ts.task_id = $1
             ORDER BY ts.created_at DESC`,
            [taskId]
        );

        res.json({
            success: true,
            submissions: result.rows
        });

    } catch (error) {
        console.error('Get submissions error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to get submissions' 
        });
    }
};

// Get latest submission for a task
const getLatestSubmission = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        // Check permissions
        const taskResult = await pool.query(
            'SELECT assignee_id FROM tasks WHERE id = $1',
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskResult.rows[0];
        const isAssignee = task.assignee_id === userId;
        const isManager = await isManagementRole(userId);

        if (!isAssignee && !isManager) {
            return res.status(403).json({ 
                error: 'Not authorized' 
            });
        }

        const result = await pool.query(
            `SELECT 
                ts.*,
                u.full_name as submitter_name,
                u.email as submitter_email
             FROM task_submissions ts
             LEFT JOIN users u ON ts.user_id = u.id
             WHERE ts.task_id = $1
             ORDER BY ts.created_at DESC
             LIMIT 1`,
            [taskId]
        );

        res.json({
            success: true,
            submission: result.rows[0] || null
        });

    } catch (error) {
        console.error('Get latest submission error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to get latest submission' 
        });
    }
};

// Delete a submission
const deleteSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const userId = req.user.id;

        // Get submission details
        const subResult = await pool.query(
            `SELECT ts.*, t.assignee_id 
             FROM task_submissions ts
             JOIN tasks t ON ts.task_id = t.id
             WHERE ts.id = $1`,
            [submissionId]
        );

        if (subResult.rows.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const submission = subResult.rows[0];
        const isAssignee = submission.assignee_id === userId;
        const isManager = await isManagementRole(userId);

        // Only assignee or management can delete
        if (!isAssignee && !isManager) {
            return res.status(403).json({ 
                error: 'Not authorized to delete this submission' 
            });
        }

        await pool.query(
            'DELETE FROM task_submissions WHERE id = $1',
            [submissionId]
        );

        res.json({
            success: true,
            message: 'Submission deleted successfully'
        });

    } catch (error) {
        console.error('Delete submission error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to delete submission' 
        });
    }
};

// Update task status to Done (only if submissions exist)
const markTaskDone = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        // Check if user is management
        const isManager = await isManagementRole(userId);
        if (!isManager) {
            return res.status(403).json({
                error: 'Only managers can mark tasks as Done'
            });
        }

        // =========================================================
        // GET TASK + COUNTS
        // =========================================================
        const result = await pool.query(
            `SELECT 
                t.id, 
                t.status,
                (SELECT COUNT(*)::int FROM task_submissions WHERE task_id = t.id) AS submission_count,
                (SELECT COUNT(*)::int FROM task_submissions 
                 WHERE task_id = t.id AND link IS NOT NULL AND TRIM(link) <> '') AS link_count,
                (SELECT COUNT(*)::int FROM task_work_parts WHERE task_id = t.id) AS part_count,
                (SELECT COUNT(*)::int FROM task_work_parts 
                 WHERE task_id = t.id AND status = 'Done') AS done_part_count
             FROM tasks t
             WHERE t.id = $1`,
            [taskId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = result.rows[0];

        // Mark task as Completed
        await pool.query(
            'UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['Completed', taskId]
        );

        res.json({
            success: true,
            message: 'Task marked as Completed successfully'
        });

    } catch (error) {
        console.error('Mark task done error:', error);
        res.status(500).json({
            error: error.message || 'Failed to mark task as Done'
        });
    }
};

module.exports = {
    addSubmission,
    getSubmissions,
    getLatestSubmission,
    deleteSubmission,
    markTaskDone
};
