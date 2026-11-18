// controllers/programsController.js
const pool = require("../config/db");

const safeQuery = async (text, params) => {
    const client = await pool.connect();
    try {
        return await client.query(text, params);
    } finally {
        client.release();
    }
};

const safeTransaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const isAdminOrManager = (role) =>
    ["Executive Manager", "System Administrator", "Project Manager", "Task Manager"].includes(role);

/* =========================================================
   GET ALL PROGRAMS (with project counts)
   GET /api/programs
========================================================= */

const getPrograms = async (req, res) => {
    try {
        const user = req.user;

        if (isAdminOrManager(user.role)) {
            const result = await safeQuery(
                `
                SELECT
                    p.id, p.name, p.description, p.domain,
                    p.start_date, p.end_date, p.priority, p.status,
                    p.created_by, p.created_at, p.updated_at,
                    u.full_name AS created_by_name,
                    COALESCE(pc.project_count, 0)::INTEGER AS project_count,
                    COALESCE(pc.completed_count, 0)::INTEGER AS completed_count
                FROM programs p
                LEFT JOIN users u ON p.created_by = u.id
                LEFT JOIN (
                    SELECT
                        program_id,
                        COUNT(*) AS project_count,
                        COUNT(*) FILTER (WHERE status IN ('Completed', 'Done')) AS completed_count
                    FROM (
                        SELECT id, program_id, status FROM program_projects WHERE program_id IS NOT NULL
                        UNION
                        SELECT id, program_id, status FROM projects WHERE program_id IS NOT NULL AND id NOT IN (SELECT id FROM program_projects)
                    ) combined_projects
                    GROUP BY program_id
                ) pc ON pc.program_id = p.id
                ORDER BY p.created_at DESC
                `
            );

            return res.status(200).json({
                success: true,
                programs: result.rows,
            });
        }

        // Non-admin / Member: Only return programs the member belongs to
        const memberResult = await safeQuery(
            `
            SELECT
                p.id, p.name, p.description, p.domain,
                p.start_date, p.end_date, p.priority, p.status,
                p.created_by, p.created_at, p.updated_at,
                u.full_name AS created_by_name,
                COALESCE(pc.project_count, 0)::INTEGER AS project_count,
                COALESCE(pc.completed_count, 0)::INTEGER AS completed_count
            FROM programs p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN (
                SELECT
                    program_id,
                    COUNT(*) AS project_count,
                    COUNT(*) FILTER (WHERE status IN ('Completed', 'Done')) AS completed_count
                FROM (
                    SELECT id, program_id, status FROM program_projects WHERE program_id IS NOT NULL
                    UNION
                    SELECT id, program_id, status FROM projects WHERE program_id IS NOT NULL AND id NOT IN (SELECT id FROM program_projects)
                ) combined_projects
                GROUP BY program_id
            ) pc ON pc.program_id = p.id
            WHERE p.id IN (
                SELECT pp.program_id FROM program_projects pp WHERE pp.assigned_to = $1
                UNION
                SELECT pr.program_id FROM projects pr WHERE pr.program_id IS NOT NULL AND (
                    pr.id IN (SELECT project_id FROM project_members WHERE user_id = $1)
                    OR pr.id IN (SELECT project_id FROM tasks WHERE assignee_id = $1 OR assigned_to = $1)
                )
                UNION
                SELECT 'prog-qarc' WHERE EXISTS (SELECT 1 FROM team_members WHERE user_id = $1)
            )
            ORDER BY p.created_at DESC
            `,
            [user.id]
        );

        return res.status(200).json({
            success: true,
            programs: memberResult.rows,
        });
    } catch (error) {
        console.error("❌ getPrograms error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch programs.",
            ...(process.env.NODE_ENV !== "production" && { error: error.message }),
        });
    }
};

/* =========================================================
   GET SINGLE PROGRAM + ITS PROJECTS
   GET /api/programs/:programId
========================================================= */

const getProgramById = async (req, res) => {
    try {
        const { programId } = req.params;
        const user = req.user;

        if (!isAdminOrManager(user.role)) {
            const memberCheck = await safeQuery(
                `
                SELECT 1 FROM programs p
                WHERE p.id = $1 AND (
                    p.id IN (SELECT pp.program_id FROM program_projects pp WHERE pp.assigned_to = $2)
                    OR p.id IN (
                        SELECT pr.program_id FROM projects pr WHERE pr.program_id = $1 AND (
                            pr.id IN (SELECT project_id FROM project_members WHERE user_id = $2)
                            OR pr.id IN (SELECT project_id FROM tasks WHERE assignee_id = $2 OR assigned_to = $2)
                        )
                    )
                    OR ($1 = 'prog-qarc' AND EXISTS (SELECT 1 FROM team_members WHERE user_id = $2))
                )
                `,
                [programId, user.id]
            );

            if (memberCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: You do not have access to this program.",
                });
            }
        }

        const programResult = await safeQuery(
            `
            SELECT p.*, u.full_name AS created_by_name
            FROM programs p
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.id = $1
            `,
            [programId]
        );

        if (programResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Program not found.",
            });
        }

        const projectsResult = await safeQuery(
            `
            SELECT * FROM (
                SELECT
                    pp.id,
                    pp.program_id,
                    pp.name,
                    pp.domain,
                    pp.about_title,
                    pp.about_description,
                    pp.status,
                    pp.priority,
                    pp.start_date,
                    pp.deadline,
                    pp.created_by,
                    pp.assigned_to,
                    pp.created_at,
                    pp.updated_at,
                    cu.full_name AS created_by_name,
                    au.full_name AS assigned_to_name,
                    au.email AS assigned_to_email,
                    au.role AS assigned_to_role
                FROM program_projects pp
                LEFT JOIN users cu ON pp.created_by = cu.id
                LEFT JOIN users au ON pp.assigned_to = au.id
                WHERE pp.program_id = $1

                UNION ALL

                SELECT
                    pr.id,
                    pr.program_id,
                    pr.name,
                    pr.domain,
                    pr.about_title,
                    pr.about_description,
                    pr.status,
                    pr.priority,
                    pr.start_date,
                    pr.deadline,
                    pr.created_by,
                    COALESCE(pr.project_manager_id, pr.manager_id) AS assigned_to,
                    pr.created_at,
                    pr.updated_at,
                    cu.full_name AS created_by_name,
                    au.full_name AS assigned_to_name,
                    au.email AS assigned_to_email,
                    au.role AS assigned_to_role
                FROM projects pr
                LEFT JOIN users cu ON pr.created_by = cu.id
                LEFT JOIN users au ON COALESCE(pr.project_manager_id, pr.manager_id) = au.id
                WHERE pr.program_id = $1
                  AND pr.id NOT IN (SELECT id FROM program_projects WHERE program_id = $1)
            ) combined
            ORDER BY created_at DESC
            `,
            [programId]
        );

        return res.status(200).json({
            success: true,
            program: programResult.rows[0],
            projects: projectsResult.rows,
        });
    } catch (error) {
        console.error("❌ getProgramById error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch program.",
        });
    }
};

/* =========================================================
   CREATE PROGRAM
   POST /api/programs
========================================================= */

const createProgram = async (req, res) => {
    try {
        const user = req.user;

        if (!isAdminOrManager(user.role)) {
            return res.status(403).json({
                success: false,
                message: "Only admins and managers can create programs.",
            });
        }

        const {
            name,
            description,
            domain,
            startDate,
            endDate,
            priority,
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Program name is required.",
            });
        }

        const programId = `prog-${Date.now()}`;
        const code = (req.body.code || name.trim().substring(0, 4)).toUpperCase();

        const result = await safeQuery(
            `
            INSERT INTO programs (id, name, code, description, domain, start_date, end_date, priority, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            `,
            [
                programId,
                name.trim(),
                code,
                description || null,
                domain || null,
                startDate || null,
                endDate || null,
                priority || "Medium",
                user.id,
            ]
        );

        return res.status(201).json({
            success: true,
            program: result.rows[0],
        });
    } catch (error) {
        console.error("❌ createProgram error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create program.",
        });
    }
};

/* =========================================================
   UPDATE PROGRAM
   PATCH /api/programs/:programId
========================================================= */

const updateProgram = async (req, res) => {
    try {
        const user = req.user;
        const { programId } = req.params;

        if (!isAdminOrManager(user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden." });
        }

        const {
            name,
            description,
            domain,
            startDate,
            endDate,
            priority,
            status,
        } = req.body;

        const result = await safeQuery(
            `
            UPDATE programs
            SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                domain = COALESCE($3, domain),
                start_date = COALESCE($4, start_date),
                end_date = COALESCE($5, end_date),
                priority = COALESCE($6, priority),
                status = COALESCE($7, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *
            `,
            [
                name ? name.trim() : null,
                description || null,
                domain || null,
                startDate || null,
                endDate || null,
                priority || null,
                status || null,
                programId,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Program not found." });
        }

        return res.status(200).json({ success: true, program: result.rows[0] });
    } catch (error) {
        console.error("❌ updateProgram error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update program.",
        });
    }
};

/* =========================================================
   DELETE PROGRAM
   DELETE /api/programs/:programId
========================================================= */

const deleteProgram = async (req, res) => {
    try {
        const user = req.user;
        const { programId } = req.params;

        if (!isAdminOrManager(user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden." });
        }

        await safeTransaction(async (client) => {
            // Delete related program project tasks and members
            await client.query(`
                DELETE FROM program_project_tasks
                WHERE program_project_id IN (SELECT id FROM program_projects WHERE program_id = $1)
            `, [programId]);

            await client.query(`
                DELETE FROM program_project_members
                WHERE program_project_id IN (SELECT id FROM program_projects WHERE program_id = $1)
            `, [programId]);

            await client.query(`DELETE FROM program_projects WHERE program_id = $1`, [programId]);

            // Unlink or clean up projects tied to this program
            await client.query(`UPDATE projects SET program_id = NULL WHERE program_id = $1`, [programId]);

            // Delete the program itself
            const res = await client.query(`DELETE FROM programs WHERE id = $1 RETURNING id`, [programId]);
            if (res.rows.length === 0) {
                throw new Error("Program not found");
            }
        });

        return res.status(200).json({ success: true, message: "Program and associated program records deleted." });
    } catch (error) {
        console.error("❌ deleteProgram error:", error);
        if (error.message === "Program not found") {
            return res.status(404).json({ success: false, message: "Program not found." });
        }
        return res.status(500).json({
            success: false,
            message: "Failed to delete program.",
        });
    }
};

/* =========================================================
   CREATE PROGRAM PROJECT
   POST /api/programs/:programId/projects
========================================================= */

const createProgramProject = async (req, res) => {
    try {
        const user = req.user;
        const { programId } = req.params;

        if (!isAdminOrManager(user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden." });
        }

        const {
            name,
            domain,
            aboutTitle,
            aboutDescription,
            startDate,
            deadline,
            priority,
            assignedTo,
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Project name is required.",
            });
        }

        // Confirm program exists
        const programCheck = await safeQuery(
            `SELECT id FROM programs WHERE id = $1`,
            [programId]
        );

        if (programCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Program not found.",
            });
        }

        // Verify assigned user if provided
        if (assignedTo) {
            const assigneeCheck = await safeQuery(
                `SELECT id FROM users WHERE id = $1 AND is_active = TRUE`,
                [assignedTo]
            );
            if (assigneeCheck.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Assigned user not found or inactive.",
                });
            }
        }

        const projectId = `proj-${Date.now()}`;
        const result = await safeQuery(
            `
            INSERT INTO program_projects (
                id, program_id, name, domain, about_title, about_description,
                start_date, deadline, priority, assigned_to,
                status, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
            `,
            [
                projectId,
                programId,
                name.trim(),
                domain || null,
                aboutTitle || null,
                aboutDescription || null,
                startDate || null,
                deadline || null,
                priority || "Medium",
                assignedTo || null,
                assignedTo ? "In Progress" : "Unassigned",
                user.id,
            ]
        );

        // Also insert into main projects table so it appears in Projects & Dashboard views under this program
        try {
            await safeQuery(
                `
                INSERT INTO projects (
                    id, name, domain, about_title, about_description,
                    start_date, deadline, priority, status, program_id,
                    manager_id, project_manager_id, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id) DO UPDATE SET
                    program_id = EXCLUDED.program_id,
                    name = EXCLUDED.name,
                    domain = EXCLUDED.domain,
                    about_title = EXCLUDED.about_title,
                    about_description = EXCLUDED.about_description,
                    start_date = EXCLUDED.start_date,
                    deadline = EXCLUDED.deadline,
                    priority = EXCLUDED.priority,
                    status = EXCLUDED.status,
                    manager_id = EXCLUDED.manager_id,
                    project_manager_id = EXCLUDED.project_manager_id
                `,
                [
                    projectId,
                    name.trim(),
                    domain || null,
                    aboutTitle || null,
                    aboutDescription || null,
                    startDate || null,
                    deadline || null,
                    priority || "Medium",
                    assignedTo ? "In Progress" : "Unassigned",
                    programId,
                    assignedTo || null,
                    assignedTo || null,
                    user.id,
                ]
            );

            const memberTargetId = assignedTo || user.id;
            const memberId = `pm-${Date.now()}`;
            await safeQuery(
                `INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                [memberId, projectId, memberTargetId, assignedTo ? "Lead Contributor" : (user.role || "Project Manager")]
            );
        } catch (syncErr) {
            console.warn("Could not sync program_project to projects table:", syncErr.message);
        }

        return res.status(201).json({
            success: true,
            project: result.rows[0],
        });
    } catch (error) {
        console.error("❌ createProgramProject error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create program project.",
            ...(process.env.NODE_ENV !== "production" && { error: error.message }),
        });
    }
};

/* =========================================================
   ASSIGN PROGRAM PROJECT
   PATCH /api/programs/:programId/projects/:projectId/assign
========================================================= */

const assignProgramProject = async (req, res) => {
    try {
        const user = req.user;
        const { programId, projectId } = req.params;
        const { assignedTo } = req.body;

        if (!isAdminOrManager(user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden." });
        }

        if (!assignedTo) {
            return res.status(400).json({
                success: false,
                message: "Assigned user ID is required.",
            });
        }

        // Verify assignee
        const assigneeCheck = await safeQuery(
            `SELECT id, role, full_name FROM users WHERE id = $1 AND is_active = TRUE`,
            [assignedTo]
        );

        if (assigneeCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Assignee not found or inactive.",
            });
        }

        const result = await safeQuery(
            `
            UPDATE program_projects
            SET
                assigned_to = $1,
                status = CASE WHEN status = 'Unassigned' THEN 'In Progress' ELSE status END,
                updated_at = NOW()
            WHERE id = $2 AND program_id = $3
            RETURNING *
            `,
            [assignedTo, projectId, programId]
        );

        // Also update projects table if project exists there
        const projUpdate = await safeQuery(
            `
            UPDATE projects
            SET
                project_manager_id = $1,
                manager_id = $1,
                status = CASE WHEN status = 'Unassigned' THEN 'In Progress' ELSE status END,
                updated_at = NOW()
            WHERE id = $2 AND program_id = $3
            RETURNING *
            `,
            [assignedTo, projectId, programId]
        );

        if (result.rows.length === 0 && projUpdate.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Program project not found.",
            });
        }

        return res.status(200).json({
            success: true,
            project: result.rows[0] || projUpdate.rows[0],
            message: `Deliverable assigned to ${assigneeCheck.rows[0].full_name}`,
        });
    } catch (error) {
        console.error("❌ assignProgramProject error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to assign program project.",
            ...(process.env.NODE_ENV !== "production" && { error: error.message }),
        });
    }
};

/* =========================================================
   UPDATE PROGRAM PROJECT
   PATCH /api/programs/:programId/projects/:projectId
========================================================= */

const updateProgramProject = async (req, res) => {
    try {
        const user = req.user;
        const { programId, projectId } = req.params;

        if (!isAdminOrManager(user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden." });
        }

        const {
            name,
            domain,
            aboutTitle,
            aboutDescription,
            startDate,
            deadline,
            priority,
            status,
        } = req.body;

        const result = await safeQuery(
            `
            UPDATE program_projects
            SET
                name = COALESCE($1, name),
                domain = COALESCE($2, domain),
                about_title = COALESCE($3, about_title),
                about_description = COALESCE($4, about_description),
                start_date = COALESCE($5, start_date),
                deadline = COALESCE($6, deadline),
                priority = COALESCE($7, priority),
                status = COALESCE($8, status)
            WHERE id = $9 AND program_id = $10
            RETURNING *
            `,
            [
                name?.trim() || null,
                domain ?? null,
                aboutTitle ?? null,
                aboutDescription ?? null,
                startDate || null,
                deadline || null,
                priority || null,
                status || null,
                projectId,
                programId,
            ]
        );

        const projUpdate = await safeQuery(
            `
            UPDATE projects
            SET
                name = COALESCE($1, name),
                domain = COALESCE($2, domain),
                about_title = COALESCE($3, about_title),
                about_description = COALESCE($4, about_description),
                start_date = COALESCE($5, start_date),
                deadline = COALESCE($6, deadline),
                priority = COALESCE($7, priority),
                status = COALESCE($8, status),
                updated_at = NOW()
            WHERE id = $9 AND program_id = $10
            RETURNING *
            `,
            [
                name?.trim() || null,
                domain ?? null,
                aboutTitle ?? null,
                aboutDescription ?? null,
                startDate || null,
                deadline || null,
                priority || null,
                status || null,
                projectId,
                programId,
            ]
        );

        if (result.rows.length === 0 && projUpdate.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Program project not found.",
            });
        }

        return res.status(200).json({ success: true, project: result.rows[0] || projUpdate.rows[0] });
    } catch (error) {
        console.error("❌ updateProgramProject error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update program project.",
        });
    }
};

/* =========================================================
   DELETE PROGRAM PROJECT
   DELETE /api/programs/:programId/projects/:projectId
========================================================= */

const deleteProgramProject = async (req, res) => {
    try {
        const user = req.user;
        const { programId, projectId } = req.params;

        if (!isAdminOrManager(user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden." });
        }

        const result = await safeQuery(
            `DELETE FROM program_projects WHERE id = $1 AND program_id = $2 RETURNING id`,
            [projectId, programId]
        );

        const projDel = await safeQuery(
            `DELETE FROM projects WHERE id = $1 AND program_id = $2 RETURNING id`,
            [projectId, programId]
        );

        if (result.rows.length === 0 && projDel.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Program project not found.",
            });
        }

        return res.status(200).json({ success: true, message: "Project deleted." });
    } catch (error) {
        console.error("❌ deleteProgramProject error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete program project.",
        });
    }
};

/* =========================================================
   GET ASSIGNABLE USERS (PM + EM + SysAdmin)
   GET /api/programs/assignable-users
========================================================= */

const getAssignableUsers = async (req, res) => {
    try {
        const user = req.user;

        if (!isAdminOrManager(user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden." });
        }

        const result = await safeQuery(
            `
            SELECT id, full_name, email, role, job_title
            FROM users
            WHERE is_active = TRUE
              AND role IN (
                  'Member',
                  'Worker',
                  'Task Manager',
                  'Project Manager',
                  'Executive Manager',
                  'System Administrator'
              )
            ORDER BY
                CASE role
                    WHEN 'Worker' THEN 1
                    WHEN 'Member' THEN 2
                    WHEN 'Task Manager' THEN 3
                    WHEN 'Project Manager' THEN 4
                    WHEN 'Executive Manager' THEN 5
                    WHEN 'System Administrator' THEN 6
                    ELSE 7
                END,
                full_name ASC
            `
        );

        return res.status(200).json({
            success: true,
            users: result.rows,
        });
    } catch (error) {
        console.error("❌ getAssignableUsers error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch assignable users.",
        });
    }
};

module.exports = {
    getPrograms,
    getProgramById,
    createProgram,
    updateProgram,
    deleteProgram,
    createProgramProject,
    assignProgramProject,
    updateProgramProject,
    deleteProgramProject,
    getAssignableUsers,
};
