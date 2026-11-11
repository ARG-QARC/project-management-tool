// controllers/challengecontroller.js
const pool = require("../config/db");

const MANAGEMENT_ROLES = [
  "Project Manager",
  "Executive Manager",
  "System Administrator",
  "Task Manager",
];

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

/* =========================================================
   HELPER: GET TASK FOR AUTHORIZATION
========================================================= */

const getTaskForAuthorization = async (taskId) => {
    const result = await safeQuery(
        `
        SELECT
            id,
            assignee_id,
            project_id
        FROM tasks
        WHERE id = $1
        LIMIT 1
        `,
        [taskId]
    );

    return result.rows[0] || null;
};

/* =========================================================
   HELPER: CHECK CHALLENGE OWNERSHIP
========================================================= */

const getChallengeForAuthorization = async (challengeId) => {
    const result = await safeQuery(
        `
        SELECT
            id,
            user_id,
            task_id
        FROM task_challenges
        WHERE id = $1
        LIMIT 1
        `,
        [challengeId]
    );

    return result.rows[0] || null;
};

/* =========================================================
   GET TASK CHALLENGES
========================================================= */

const getTaskChallenges = async (req, res) => {
    try {
        const { taskId } = req.params;

        console.log('🔍 Fetching challenges for task:', { 
            taskId, 
            user: req.user?.id,
            role: req.user?.role 
        });

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        /* ---------------------------------------------------------
           Get task for authorization check
        --------------------------------------------------------- */
        const task = await getTaskForAuthorization(taskId);

        if (!task) {
            console.log('❌ Task not found:', taskId);
            return res.status(404).json({
                success: false,
                message: "Task not found.",
            });
        }

        /* ---------------------------------------------------------
           Check authorization
        --------------------------------------------------------- */
        const isManagementRole = MANAGEMENT_ROLES.includes(req.user.role);
        const isTaskAssignee = String(task.assignee_id || "") === String(req.user.id);

        if (!isManagementRole && !isTaskAssignee) {
            console.log('❌ Unauthorized access attempt:', { 
                userId: req.user.id, 
                role: req.user.role,
                taskId 
            });
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view challenges for this task.",
            });
        }

        /* ---------------------------------------------------------
           Fetch challenges
        --------------------------------------------------------- */
        const result = await safeQuery(
            `
            SELECT
                tc.id,
                tc.task_id,
                tc.user_id,
                tc.challenge,
                tc.created_at,
                tc.updated_at,
                u.full_name AS author_name,
                u.email AS author_email
            FROM task_challenges tc
            LEFT JOIN users u
                ON u.id = tc.user_id
            WHERE tc.task_id = $1
            ORDER BY tc.created_at ASC
            `,
            [taskId]
        );

        console.log(`✅ Found ${result.rows.length} challenges for task:`, taskId);

        return res.status(200).json({
            success: true,
            challenges: result.rows,
        });

    } catch (error) {
        console.error("❌ Get Task Challenges Error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch task challenges.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   CREATE TASK CHALLENGE
========================================================= */

const createTaskChallenge = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { challenge } = req.body;

        console.log('🔍 Creating challenge for task:', { 
            taskId, 
            user: req.user?.id,
            role: req.user?.role 
        });

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        /* ---------------------------------------------------------
           Only Members and Workers can add challenges
        --------------------------------------------------------- */
        if (req.user.role !== "Member" && req.user.role !== "Worker") {
            console.log('❌ Non-Member/Worker tried to add challenge:', req.user.role);
            return res.status(403).json({
                success: false,
                message: "Only Members and Workers can add task challenges.",
            });
        }

        /* ---------------------------------------------------------
           Validate challenge text
        --------------------------------------------------------- */
        if (!challenge || !challenge.trim()) {
            return res.status(400).json({
                success: false,
                message: "Challenge text is required.",
            });
        }

        /* ---------------------------------------------------------
           Get task for authorization check
        --------------------------------------------------------- */
        const task = await getTaskForAuthorization(taskId);

        if (!task) {
            console.log('❌ Task not found:', taskId);
            return res.status(404).json({
                success: false,
                message: "Task not found.",
            });
        }

        /* ---------------------------------------------------------
           Only the actual task assignee can submit challenges
        --------------------------------------------------------- */
        if (String(task.assignee_id || "") !== String(req.user.id)) {
            console.log('❌ User not assigned to task:', { 
                userId: req.user.id, 
                assigneeId: task.assignee_id 
            });
            return res.status(403).json({
                success: false,
                message: "You can only add challenges to tasks assigned to you.",
            });
        }

        /* ---------------------------------------------------------
           Insert challenge
        --------------------------------------------------------- */
        const result = await safeQuery(
            `
            INSERT INTO task_challenges (
                task_id,
                user_id,
                challenge
            )
            VALUES ($1, $2, $3)
            RETURNING
                id,
                task_id,
                user_id,
                challenge,
                created_at,
                updated_at
            `,
            [
                taskId,
                req.user.id,
                challenge.trim(),
            ]
        );

        console.log('✅ Challenge created:', result.rows[0].id);

        return res.status(201).json({
            success: true,
            message: "Challenge added successfully.",
            challenge: result.rows[0],
        });

    } catch (error) {
        console.error("❌ Create Task Challenge Error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to add task challenge.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   DELETE TASK CHALLENGE
========================================================= */

const deleteTaskChallenge = async (req, res) => {
    try {
        const { challengeId } = req.params;

        console.log('🔍 Deleting challenge:', { 
            challengeId, 
            user: req.user?.id,
            role: req.user?.role 
        });

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        /* ---------------------------------------------------------
           Get challenge for authorization check
        --------------------------------------------------------- */
        const challenge = await getChallengeForAuthorization(challengeId);

        if (!challenge) {
            console.log('❌ Challenge not found:', challengeId);
            return res.status(404).json({
                success: false,
                message: "Challenge not found.",
            });
        }

        /* ---------------------------------------------------------
           Check authorization
        --------------------------------------------------------- */
        const isManagementRole = MANAGEMENT_ROLES.includes(req.user.role);
        const isOwner = String(challenge.user_id) === String(req.user.id);

        if (!isManagementRole && !isOwner) {
            console.log('❌ Unauthorized delete attempt:', { 
                userId: req.user.id, 
                challengeOwnerId: challenge.user_id 
            });
            return res.status(403).json({
                success: false,
                message: "You are not authorized to delete this challenge.",
            });
        }

        /* ---------------------------------------------------------
           Delete challenge
        --------------------------------------------------------- */
        await safeQuery(
            `
            DELETE FROM task_challenges
            WHERE id = $1
            `,
            [challengeId]
        );

        console.log('✅ Challenge deleted:', challengeId);

        return res.status(200).json({
            success: true,
            message: "Challenge deleted successfully.",
        });

    } catch (error) {
        console.error("❌ Delete Task Challenge Error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to delete challenge.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   GET CHALLENGE COUNT FOR TASK
========================================================= */

const getChallengeCount = async (req, res) => {
    try {
        const { taskId } = req.params;

        console.log('🔍 Getting challenge count for task:', taskId);

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const result = await safeQuery(
            `
            SELECT COUNT(*) as count
            FROM task_challenges
            WHERE task_id = $1
            `,
            [taskId]
        );

        return res.status(200).json({
            success: true,
            count: parseInt(result.rows[0].count) || 0,
        });

    } catch (error) {
        console.error("❌ Get Challenge Count Error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to get challenge count.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   GET ALL CHALLENGES FOR USER
========================================================= */

const getUserChallenges = async (req, res) => {
    try {
        console.log('🔍 Fetching all challenges for user:', req.user?.id);

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const isManagementRole = MANAGEMENT_ROLES.includes(req.user.role);

        let query;
        let params;

        if (isManagementRole) {
            // Management can see all challenges
            query = `
                SELECT
                    tc.id,
                    tc.task_id,
                    tc.user_id,
                    tc.challenge,
                    tc.created_at,
                    tc.updated_at,
                    u.full_name AS author_name,
                    u.email AS author_email,
                    t.name AS task_name,
                    p.name AS project_name
                FROM task_challenges tc
                LEFT JOIN users u ON u.id = tc.user_id
                LEFT JOIN tasks t ON t.id = tc.task_id
                LEFT JOIN projects p ON p.id = t.project_id
                ORDER BY tc.created_at DESC
            `;
            params = [];
        } else {
            // Members can only see their own challenges
            query = `
                SELECT
                    tc.id,
                    tc.task_id,
                    tc.user_id,
                    tc.challenge,
                    tc.created_at,
                    tc.updated_at,
                    u.full_name AS author_name,
                    u.email AS author_email,
                    t.name AS task_name,
                    p.name AS project_name
                FROM task_challenges tc
                LEFT JOIN users u ON u.id = tc.user_id
                LEFT JOIN tasks t ON t.id = tc.task_id
                LEFT JOIN projects p ON p.id = t.project_id
                WHERE tc.user_id = $1
                ORDER BY tc.created_at DESC
            `;
            params = [req.user.id];
        }

        const result = await safeQuery(query, params);

        console.log(`✅ Found ${result.rows.length} challenges for user`);

        return res.status(200).json({
            success: true,
            challenges: result.rows,
            total: result.rows.length,
        });

    } catch (error) {
        console.error("❌ Get User Challenges Error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch user challenges.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

module.exports = {
    getTaskChallenges,
    createTaskChallenge,
    deleteTaskChallenge,
    getChallengeCount,
    getUserChallenges,
};
