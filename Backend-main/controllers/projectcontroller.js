// controllers/projectcontroller.js
const pool = require("../config/db");

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
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/* =========================================================
   GET PROJECTS
========================================================= */

const getProjects = async (req, res) => {
    try {
        console.log('🔍 Fetching projects for user:', req.user?.id);

        const result = await safeQuery(`
            SELECT 
                p.id,
                p.name,
                p.domain,
                p.about_title,
                p.about_description,
                CASE 
                    WHEN COALESCE(tc.total_tasks, 0) = 0 THEN 
                        CASE WHEN p.status = 'In Progress' THEN 'Not Started' ELSE p.status END
                    WHEN tc.completed_tasks = tc.total_tasks THEN 'Completed'
                    ELSE 'In Progress'
                END AS status,
                p.priority,
                p.start_date,
                p.start_time,
                p.deadline,
                p.deadline_time,
                CASE 
                    WHEN COALESCE(tc.total_tasks, 0) = 0 THEN 0
                    ELSE ROUND((tc.completed_tasks::numeric / tc.total_tasks::numeric) * 100)::integer
                END AS progress,
                p.program_id,
                prog.name AS program_name,
                COALESCE(tc.total_tasks, 0)::integer AS total_tasks,
                COALESCE(tc.completed_tasks, 0)::integer AS completed_tasks,
                p.created_at,
                p.updated_at,

                creator.id AS creator_id,
                creator.full_name AS creator_name,
                creator.role AS creator_role,

                manager.id AS manager_id,
                manager.full_name AS manager_name,
                manager.email AS manager_email,
                manager.role AS manager_role,

                COALESCE(pm_agg.members, '[]'::json) AS members

            FROM projects p

            LEFT JOIN programs prog
                ON prog.id = p.program_id

            LEFT JOIN users creator
                ON creator.id = p.created_by

            LEFT JOIN users manager
                ON manager.id = p.project_manager_id

            LEFT JOIN (
                SELECT 
                    project_id,
                    COUNT(*)::integer AS total_tasks,
                    COUNT(CASE WHEN status = 'Completed' OR status = 'Done' THEN 1 END)::integer AS completed_tasks
                FROM tasks
                GROUP BY project_id
            ) tc ON tc.project_id = p.id

            LEFT JOIN (
                SELECT 
                    pm.project_id,
                    json_agg(json_build_object(
                        'id', u.id,
                        'full_name', u.full_name,
                        'email', u.email,
                        'role', u.role,
                        'project_role', pm.role
                    )) AS members
                FROM project_members pm
                JOIN users u ON u.id = pm.user_id
                WHERE u.is_active = TRUE
                GROUP BY pm.project_id
            ) pm_agg ON pm_agg.project_id = p.id

            WHERE $1 = TRUE 
               OR p.project_manager_id = $2
               OR p.manager_id = $2
               OR p.created_by = $2
               OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $2)
               OR p.id IN (SELECT project_id FROM tasks WHERE assignee_id = $2 OR assigned_to = $2)

            ORDER BY p.created_at DESC
        `, [
            ['Project Manager', 'Task Manager', 'Executive Manager', 'System Administrator'].includes(req.user?.role),
            req.user?.id
        ]);

        console.log(`✅ Found ${result.rows.length} projects`);

        return res.status(200).json({
            success: true,
            projects: result.rows
        });

    } catch (error) {
        console.error("❌ Get projects error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve projects.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   GET PROJECT MANAGERS
========================================================= */

const getProjectManagers = async (req, res) => {
    try {
        console.log('🔍 Fetching project managers');

        const result = await safeQuery(`
            SELECT
                id,
                full_name,
                email,
                role
            FROM users
            WHERE role = 'Project Manager'
              AND is_active = TRUE
            ORDER BY full_name
        `);

        console.log(`✅ Found ${result.rows.length} project managers`);

        return res.status(200).json({
            success: true,
            managers: result.rows
        });

    } catch (error) {
        console.error("❌ Get project managers error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve project managers.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   CREATE PROJECT
========================================================= */

const createProject = async (req, res) => {
    try {
        const {
            name,
            domain,
            aboutTitle,
            about_title,
            aboutDescription,
            about_description,
            startDate,
            start_date,
            startTime,
            start_time,
            deadline,
            deadlineTime,
            deadline_time,
            priority,
            status,
            programId,
            program_id
        } = req.body;
        
        const finalStartDate = startDate || start_date;
        const finalStartTime = startTime || start_time || "09:00";
        const finalDeadlineTime = deadlineTime || deadline_time || "17:00";
        const finalAboutTitle = aboutTitle || about_title;
        const finalAboutDescription = aboutDescription || about_description;
        const finalProgramId = programId || program_id;

        console.log('🔍 Creating project:', { name, domain, priority, user: req.user?.id });

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Project name is required."
            });
        }

        const projectId = `proj-${Date.now()}`;
        
        const result = await safeQuery(
            `
            INSERT INTO projects (
                id,
                name,
                domain,
                about_title,
                about_description,
                start_date,
                start_time,
                deadline,
                deadline_time,
                priority,
                program_id,
                created_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            )
            RETURNING *
            `,
            [
                projectId,
                name.trim(),
                domain || null,
                finalAboutTitle || null,
                finalAboutDescription || null,
                finalStartDate || null,
                finalStartTime,
                deadline || null,
                finalDeadlineTime,
                priority || "Medium",
                finalProgramId || null,
                req.user.id
            ]
        );

        // If linked to a program, also sync into program_projects so Program views and counts stay unified
        if (finalProgramId) {
            try {
                await safeQuery(
                    `
                    INSERT INTO program_projects (
                        id, program_id, name, domain, about_title, about_description,
                        start_date, start_time, deadline, deadline_time, priority, assigned_to, status, created_by
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT (id) DO UPDATE SET
                        program_id = EXCLUDED.program_id,
                        name = EXCLUDED.name,
                        domain = EXCLUDED.domain,
                        about_title = EXCLUDED.about_title,
                        about_description = EXCLUDED.about_description,
                        start_date = EXCLUDED.start_date,
                        start_time = EXCLUDED.start_time,
                        deadline = EXCLUDED.deadline,
                        deadline_time = EXCLUDED.deadline_time,
                        priority = EXCLUDED.priority
                    `,
                    [
                        projectId,
                        finalProgramId,
                        name.trim(),
                        domain || null,
                        finalAboutTitle || null,
                        finalAboutDescription || null,
                        finalStartDate || null,
                        finalStartTime,
                        deadline || null,
                        finalDeadlineTime,
                        priority || "Medium",
                        req.user.id,
                        "In Progress",
                        req.user.id
                    ]
                );
            } catch (e) {
                console.warn("Could not sync project to program_projects:", e.message);
            }
        }

        // Also add creator to project_members
        try {
            const memberId = `pm-${Date.now()}`;
            await safeQuery(
                `INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                [memberId, projectId, req.user.id, req.user.role || 'Project Manager']
            );
        } catch (e) {
            console.warn("Could not insert creator to project_members:", e.message);
        }

        console.log('✅ Project created:', result.rows[0].id);

        return res.status(201).json({
            success: true,
            message: "Project created successfully.",
            project: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Create project error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to create project.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   UPDATE PROJECT
========================================================= */

const updateProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const {
            name,
            domain,
            aboutTitle,
            about_title,
            aboutDescription,
            about_description,
            startDate,
            start_date,
            deadline,
            priority,
            status,
            programId,
            program_id
        } = req.body;
        
        const finalStartDate = startDate || start_date;
        const finalAboutTitle = aboutTitle || about_title;
        const finalAboutDescription = aboutDescription || about_description;
        const finalProgramId = programId || program_id;

        console.log('🔍 Updating project:', { projectId, name, user: req.user?.id });

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Project name is required."
            });
        }

        /* ---------------------------------------------------------
           Validate dates
        --------------------------------------------------------- */
        if (finalStartDate && deadline && deadline < finalStartDate) {
            return res.status(400).json({
                success: false,
                message: "Deadline must be greater than or equal to the start date."
            });
        }

        /* ---------------------------------------------------------
           Check project exists
        --------------------------------------------------------- */
        const projectResult = await safeQuery(
            `SELECT id FROM projects WHERE id = $1`,
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        /* ---------------------------------------------------------
           Update project
        --------------------------------------------------------- */
        const result = await safeQuery(
            `
            UPDATE projects
            SET
                name = $1,
                domain = $2,
                about_title = $3,
                about_description = $4,
                start_date = $5,
                deadline = $6,
                priority = $7,
                program_id = COALESCE($8, program_id),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *
            `,
            [
                name.trim(),
                domain || null,
                finalAboutTitle || null,
                finalAboutDescription || null,
                finalStartDate || null,
                deadline || null,
                priority || "Medium",
                finalProgramId || null,
                projectId
            ]
        );

        console.log('✅ Project updated:', projectId);

        return res.status(200).json({
            success: true,
            message: "Project updated successfully.",
            project: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Update project error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to update project.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   UPDATE PROJECT DEADLINE
========================================================= */

const updateProjectDeadline = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { deadline } = req.body;

        console.log('🔍 Updating deadline for project:', { projectId, deadline });

        /* ---------------------------------------------------------
           Check project exists and get start_date
        --------------------------------------------------------- */
        const projectResult = await safeQuery(
            `SELECT start_date FROM projects WHERE id = $1`,
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        const startDate = projectResult.rows[0].start_date;

        /* ---------------------------------------------------------
           Validate deadline
        --------------------------------------------------------- */
        if (deadline && startDate && deadline < startDate) {
            return res.status(400).json({
                success: false,
                message: "Deadline must be greater than or equal to the start date."
            });
        }

        /* ---------------------------------------------------------
           Update deadline
        --------------------------------------------------------- */
        const result = await safeQuery(
            `
            UPDATE projects
            SET
                deadline = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
            `,
            [
                deadline || null,
                projectId
            ]
        );

        console.log('✅ Deadline updated for project:', projectId);

        return res.status(200).json({
            success: true,
            message: "Project deadline updated successfully.",
            project: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Update deadline error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to update project deadline.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   DELETE PROJECT
========================================================= */

const deleteProject = async (req, res) => {
    try {
        const { projectId } = req.params;

        console.log('🔍 Deleting project:', { projectId, user: req.user?.id });

        const result = await safeTransaction(async (client) => {
            /* ---------------------------------------------------------
               Check project exists
            --------------------------------------------------------- */
            const projectResult = await client.query(
                `SELECT id, name FROM projects WHERE id = $1`,
                [projectId]
            );

            if (projectResult.rows.length === 0) {
                throw new Error("Project not found");
            }

            const projectName = projectResult.rows[0].name;

            /* ---------------------------------------------------------
               Delete task dependencies and tasks
            --------------------------------------------------------- */
            await client.query(`
                DELETE FROM task_attachments 
                WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)
            `, [projectId]);
            await client.query(`
                DELETE FROM task_submissions 
                WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)
            `, [projectId]);
            await client.query(`
                DELETE FROM task_work_parts 
                WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)
            `, [projectId]);
            await client.query(`
                DELETE FROM task_challenges 
                WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)
            `, [projectId]);

            const deletedTasks = await client.query(
                `DELETE FROM tasks WHERE project_id = $1 RETURNING id`,
                [projectId]
            );

            /* ---------------------------------------------------------
               Delete project members, reports, and matching program_projects
            --------------------------------------------------------- */
            await client.query(`DELETE FROM project_members WHERE project_id = $1`, [projectId]);
            await client.query(`DELETE FROM project_reports WHERE project_id = $1`, [projectId]);
            await client.query(`DELETE FROM program_projects WHERE id = $1 OR name = $2`, [projectId, projectName]);

            /* ---------------------------------------------------------
               Delete project
            --------------------------------------------------------- */
            await client.query(
                `DELETE FROM projects WHERE id = $1`,
                [projectId]
            );

            return {
                projectId,
                projectName,
                deletedTasks: deletedTasks.rowCount
            };
        });

        console.log('✅ Project deleted:', result.projectId, `(${result.deletedTasks} tasks deleted)`);

        return res.status(200).json({
            success: true,
            message: "Project and its tasks deleted successfully.",
            projectId: result.projectId,
            projectName: result.projectName,
            deletedTasks: result.deletedTasks
        });

    } catch (error) {
        console.error("❌ Delete project error:", error);
        console.error("Stack:", error.stack);

        if (error.message === "Project not found") {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to delete project.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   ASSIGN PROJECT
========================================================= */

const assignProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const targetUserId = req.body.managerId || req.body.userId || req.body.memberId;
        const requestedRole = req.body.role || "Lead Contributor";

        console.log('🔍 Assigning project:', { projectId, targetUserId, user: req.user?.id });

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: "A team member or manager is required for assignment."
            });
        }

        /* ---------------------------------------------------------
           Verify user exists and is active
        --------------------------------------------------------- */
        const userResult = await safeQuery(
            `
            SELECT id, full_name, email, role, is_active
            FROM users
            WHERE id = $1 AND is_active = TRUE
            `,
            [targetUserId]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Selected user was not found or is inactive."
            });
        }

        const assignee = userResult.rows[0];

        /* ---------------------------------------------------------
           Verify project exists
        --------------------------------------------------------- */
        const projectResult = await safeQuery(
            `SELECT id, name FROM projects WHERE id = $1`,
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        const project = projectResult.rows[0];

        /* ---------------------------------------------------------
           Assign project & update status
        --------------------------------------------------------- */
        const result = await safeQuery(
            `
            UPDATE projects
            SET
                project_manager_id = $1,
                status = CASE
                    WHEN status = 'Unassigned' THEN 'In Progress'
                    ELSE status
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
            `,
            [targetUserId, projectId]
        );

        /* ---------------------------------------------------------
           Add to project_members if not present
        --------------------------------------------------------- */
        const memberRoleId = assignee.role === 'Project Manager' ? 'Project Manager' : requestedRole;
        await safeQuery(
            `
            INSERT INTO project_members (id, project_id, user_id, role)
            SELECT $1, $2, $3, $4
            WHERE NOT EXISTS (
                SELECT 1 FROM project_members WHERE project_id = $2 AND user_id = $3
            )
            `,
            [`pm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, projectId, targetUserId, memberRoleId]
        );

        /* ---------------------------------------------------------
           Sync with corresponding program_projects deliverable
        --------------------------------------------------------- */
        await safeQuery(
            `
            UPDATE program_projects
            SET assigned_to = $1,
                status = CASE WHEN status = 'Unassigned' THEN 'In Progress' ELSE status END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
               OR id = 'pp-' || REPLACE($2, 'proj-', '')
               OR LOWER(name) = LOWER($3)
            `,
            [targetUserId, projectId, project.name]
        );

        console.log('✅ Project assigned:', projectId, 'to user:', targetUserId);

        return res.status(200).json({
            success: true,
            message: `Project assigned successfully to ${assignee.full_name}.`,
            project: result.rows[0],
            assignee: assignee,
            manager: assignee
        });

    } catch (error) {
        console.error("❌ Assign project error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to assign project.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   UNASSIGN PROJECT
========================================================= */

const unassignProject = async (req, res) => {
    try {
        const { projectId } = req.params;

        console.log('🔍 Unassigning project:', { projectId, user: req.user?.id });

        const result = await safeQuery(
            `
            UPDATE projects
            SET
                project_manager_id = NULL,
                status = 'Unassigned',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
            `,
            [projectId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        const project = result.rows[0];

        // Sync with program_projects
        await safeQuery(
            `
            UPDATE program_projects
            SET assigned_to = NULL,
                status = 'Unassigned',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
               OR id = 'pp-' || REPLACE($1, 'proj-', '')
               OR LOWER(name) = LOWER($2)
            `,
            [projectId, project.name]
        );

        console.log('✅ Project unassigned:', projectId);

        return res.status(200).json({
            success: true,
            message: "Project unassigned successfully.",
            project: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Unassign project error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to unassign project.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   PROJECT MEMBERS MANAGEMENT
========================================================= */

const getProjectMembers = async (req, res) => {
    try {
        const { projectId } = req.params;

        const normalizedProjId = projectId.replace(/^pp-(proj-)?/, 'proj-');

        const result = await safeQuery(
            `
            SELECT 
                pm.id,
                pm.project_id,
                pm.user_id,
                pm.role AS project_role,
                pm.created_at,
                u.full_name,
                u.email,
                u.role AS system_role,
                u.job_title
            FROM project_members pm
            JOIN users u ON u.id = pm.user_id
            WHERE (pm.project_id = $1 OR pm.project_id = $2 OR ('pp-' || pm.project_id) = $1) AND u.is_active = TRUE
            ORDER BY 
                CASE WHEN pm.role = 'Project Manager' THEN 1 ELSE 2 END,
                pm.created_at ASC
            `,
            [projectId, normalizedProjId]
        );

        return res.status(200).json({
            success: true,
            members: result.rows
        });
    } catch (error) {
        console.error("❌ Get project members error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load project members."
        });
    }
};

const addProjectMember = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { userId, role = "Contributor" } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required." });
        }

        const userCheck = await safeQuery(
            `SELECT id, full_name, email, role, job_title FROM users WHERE id = $1 AND is_active = TRUE`,
            [userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found or inactive." });
        }

        const newId = `pm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await safeQuery(
            `
            INSERT INTO project_members (id, project_id, user_id, role)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO NOTHING
            `,
            [newId, projectId, userId, role]
        );

        return res.status(201).json({
            success: true,
            message: `${userCheck.rows[0].full_name} added to project.`,
            member: {
                id: newId,
                project_id: projectId,
                user_id: userId,
                project_role: role,
                full_name: userCheck.rows[0].full_name,
                email: userCheck.rows[0].email,
                system_role: userCheck.rows[0].role,
                job_title: userCheck.rows[0].job_title
            }
        });
    } catch (error) {
        console.error("❌ Add project member error:", error);
        return res.status(500).json({ success: false, message: "Failed to add project member." });
    }
};

const removeProjectMember = async (req, res) => {
    try {
        const { projectId, userId } = req.params;

        await safeQuery(
            `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
            [projectId, userId]
        );

        return res.status(200).json({
            success: true,
            message: "Member removed from project."
        });
    } catch (error) {
        console.error("❌ Remove project member error:", error);
        return res.status(500).json({ success: false, message: "Failed to remove member." });
    }
};

/* =========================================================
   UPDATE PROJECT STATUS
========================================================= */

const updateProjectStatus = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { status } = req.body;

        console.log('🔍 Updating project status:', { projectId, status, user: req.user?.id });

        /* ---------------------------------------------------------
           Validate status
        --------------------------------------------------------- */
        const allowedStatuses = [
            "Unassigned",
            "Backlog",
            "In Progress",
            "Paused",
            "Done"
        ];

        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project status. Allowed statuses are: Unassigned, Backlog, In Progress, Paused, Done."
            });
        }

        /* ---------------------------------------------------------
           Check project exists and get current status
        --------------------------------------------------------- */
        const projectResult = await safeQuery(
            `
            SELECT id, name, status, project_manager_id
            FROM projects
            WHERE id = $1
            `,
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        const project = projectResult.rows[0];

        /* ---------------------------------------------------------
           Validate status transitions
        --------------------------------------------------------- */
        // Prevent assigned project from becoming Unassigned
        if (status === "Unassigned" && project.project_manager_id) {
            return res.status(400).json({
                success: false,
                message: "A project with an assigned Project Manager cannot have Unassigned status. Unassign the project first."
            });
        }

        // Prevent unassigned project from changing status
        if (status !== "Unassigned" && !project.project_manager_id) {
            return res.status(400).json({
                success: false,
                message: "A Project Manager must be assigned before changing the project status."
            });
        }

        /* ---------------------------------------------------------
           Update status
        --------------------------------------------------------- */
        const result = await safeQuery(
            `
            UPDATE projects
            SET
                status = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
            `,
            [status, projectId]
        );

        console.log('✅ Project status updated:', projectId, 'to', status);

        return res.status(200).json({
            success: true,
            message: "Project status updated successfully.",
            project: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Update project status error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to update project status.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   GET PROJECT BY ID
========================================================= */

const getProjectById = async (req, res) => {
    try {
        const { projectId } = req.params;

        const normalizedProjId = projectId.replace(/^pp-(proj-)?/, 'proj-');

        let result = await safeQuery(
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
                p.program_id,
                p.created_at,
                p.updated_at,

                creator.id AS creator_id,
                creator.full_name AS creator_name,
                creator.role AS creator_role,

                manager.id AS manager_id,
                manager.full_name AS manager_name,
                manager.email AS manager_email,
                manager.role AS manager_role

            FROM projects p

            LEFT JOIN users creator
                ON creator.id = p.created_by

            LEFT JOIN users manager
                ON manager.id = p.project_manager_id

            WHERE p.id = $1
               OR p.id = $2
               OR ('pp-' || p.id) = $1
            `,
            [projectId, normalizedProjId]
        );

        // Fallback: check program_projects table if not found in projects
        if (result.rows.length === 0) {
            const normalizedPpId = projectId.startsWith('pp-') ? projectId : `pp-${projectId}`;
            const ppResult = await safeQuery(
                `
                SELECT
                    pp.id,
                    pp.name,
                    pp.domain,
                    pp.about_title,
                    pp.about_description,
                    pp.status,
                    pp.priority,
                    pp.start_date,
                    pp.deadline,
                    0 AS progress,
                    pp.program_id,
                    pp.created_at,
                    pp.updated_at,

                    creator.id AS creator_id,
                    creator.full_name AS creator_name,
                    creator.role AS creator_role,

                    assignee.id AS manager_id,
                    assignee.full_name AS manager_name,
                    assignee.email AS manager_email,
                    assignee.role AS manager_role

                FROM program_projects pp
                LEFT JOIN users creator ON creator.id = pp.created_by
                LEFT JOIN users assignee ON assignee.id = pp.assigned_to
                WHERE pp.id = $1 OR pp.id = $2
                `,
                [projectId, normalizedPpId]
            );

            if (ppResult.rows.length > 0) {
                console.log('✅ Project found in program_projects:', ppResult.rows[0].id);
                return res.status(200).json({
                    success: true,
                    project: ppResult.rows[0]
                });
            }

            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        console.log('✅ Project found:', result.rows[0].id);

        return res.status(200).json({
            success: true,
            project: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Get project by ID error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve project.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

module.exports = {
    getProjects,
    getProjectManagers,
    getProjectById,
    createProject,
    updateProject,
    updateProjectDeadline,
    deleteProject,
    assignProject,
    unassignProject,
    updateProjectStatus,
    getProjectMembers,
    addProjectMember,
    removeProjectMember
};
