// controllers/taskcontroller.js
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
    } finally {
        client.release();
    }
};

/* =========================================================
   GET PROJECT TASKS
   GET /api/tasks/project/:projectId
========================================================= */

const getProjectTasks = async (req, res) => {
    try {
        const { projectId } = req.params;

        const normalizedProjId = projectId.replace(/^pp-(proj-)?/, 'proj-');

        const result = await safeQuery(
            `
            SELECT 
                t.id,
                t.project_id,
                t.name,
                t.description,
                t.status,
                t.priority,
                t.assignee_id,
                t.start_date,
                t.due_date,
                t.created_by,
                t.created_at,
                t.updated_at,
                u.full_name as assignee_name,
                u.email as assignee_email
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE t.project_id = $1 OR t.project_id = $2 OR ('pp-' || t.project_id) = $1
            ORDER BY t.created_at DESC
            `,
            [projectId, normalizedProjId]
        );

        console.log(`✅ Found ${result.rows.length} tasks for project:`, projectId);

        return res.status(200).json({
            success: true,
            tasks: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error("❌ Get project tasks error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve project tasks.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   GET SINGLE TASK
   GET /api/tasks/:taskId
========================================================= */

const getTask = async (req, res) => {
    try {
        const { taskId } = req.params;

        console.log('🔍 Fetching task:', { taskId, user: req.user?.id });

        const result = await safeQuery(
            `
            SELECT 
                t.id,
                t.project_id,
                t.name,
                t.description,
                t.status,
                t.priority,
                t.assignee_id,
                t.start_date,
                t.due_date,
                t.created_by,
                t.created_at,
                t.updated_at,
                u.full_name as assignee_name,
                u.email as assignee_email,
                p.name as project_name
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.id = $1
            `,
            [taskId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Task not found."
            });
        }

        console.log('✅ Task found:', taskId);

        return res.status(200).json({
            success: true,
            task: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Get task error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve task.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   CREATE TASK
   POST /api/tasks/project/:projectId
========================================================= */

const createTask = async (req, res) => {
    try {
        const rawProjectId = req.params.projectId || req.body.projectId;
        const effectiveProjectId = (rawProjectId && rawProjectId !== 'standalone' && rawProjectId !== 'none' && rawProjectId !== 'null')
            ? rawProjectId.trim()
            : null;
        const { name, description, status, priority, assigneeId, startDate, dueDate } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        console.log('🔍 Creating task:', { effectiveProjectId, name, assigneeId, user: userId, role: userRole });

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Task name is required."
            });
        }

        const isExecutive = userRole === 'Executive Manager';
        const isSystemAdmin = userRole === 'System Administrator';
        const isTaskManager = userRole === 'Task Manager';
        let project = null;

        if (effectiveProjectId) {
            // Verify project exists and get project info
            const projectResult = await safeQuery(
                `SELECT id, created_by, project_manager_id FROM projects WHERE id = $1`,
                [effectiveProjectId]
            );

            if (projectResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found."
                });
            }

            project = projectResult.rows[0];

            // Check project member mapping
            const memberCheck = await safeQuery(
                `SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2`,
                [effectiveProjectId, userId]
            );

            const isProjectManager = project.project_manager_id === userId || userRole === 'Project Manager';
            const isCreator = project.created_by === userId;
            const isMember = memberCheck.rows.length > 0;

            // Authorization check
            if (!isExecutive && !isSystemAdmin && !isTaskManager && !isProjectManager && !isCreator && !isMember) {
                return res.status(403).json({
                    success: false,
                    message: "Only project managers, task managers, creators, or assigned team members can create tasks."
                });
            }
        } else {
            // Standalone / Program Task without specific project
            if (!isExecutive && !isSystemAdmin && !isTaskManager && userRole !== 'Project Manager') {
                return res.status(403).json({
                    success: false,
                    message: "Only managers can create standalone tasks."
                });
            }
        }

        // Verify assignee exists if provided
        let assigneeName = null;
        let assigneeEmail = null;

        if (assigneeId) {
            const assigneeResult = await safeQuery(
                `SELECT id, full_name, email FROM users WHERE id = $1 AND is_active = TRUE`,
                [assigneeId]
            );

            if (assigneeResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Assignee not found or is inactive."
                });
            }

            assigneeName = assigneeResult.rows[0].full_name;
            assigneeEmail = assigneeResult.rows[0].email;

            // Auto-add to project_members if project exists and not already there
            if (effectiveProjectId) {
                const memberCheck2 = await safeQuery(
                    `SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = $2`,
                    [effectiveProjectId, assigneeId]
                );

                if (memberCheck2.rows.length === 0) {
                    try {
                        const pmId = `pm-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                        await safeQuery(
                            `INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                            [pmId, effectiveProjectId, assigneeId, "Member"]
                        );
                    } catch (error) {
                        console.warn("Could not add user to project members:", error);
                    }
                }
            }
        }

        const taskId = `tsk-${Date.now()}`;
        const trimmedName = name.trim();

        const result = await safeQuery(
            `
            INSERT INTO tasks (
                id,
                project_id,
                name,
                title,
                description,
                status,
                priority,
                assignee_id,
                assigned_to,
                start_date,
                due_date,
                created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING 
                id,
                project_id,
                name,
                title,
                description,
                status,
                priority,
                assignee_id,
                assigned_to,
                start_date,
                due_date,
                created_by,
                created_at,
                updated_at
            `,
            [
                taskId,
                effectiveProjectId,
                trimmedName,
                trimmedName,
                description || null,
                status || "To Do",
                priority || "Medium",
                assigneeId || null,
                assigneeId || null,
                startDate || null,
                dueDate || null,
                userId
            ]
        );

        const task = result.rows[0];
        task.assignee_name = assigneeName;
        task.assignee_email = assigneeEmail;

        console.log('✅ Task created:', task.id);

        return res.status(201).json({
            success: true,
            message: "Task created successfully.",
            task: task
        });

    } catch (error) {
        console.error("❌ Create task error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to create task.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   UPDATE TASK
   PATCH /api/tasks/:taskId
========================================================= */

const updateTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { name, description, status, priority, assigneeId, startDate, dueDate } = req.body;
        const userId = req.user.id;

        console.log('🔍 Updating task:', { taskId, name, status, user: userId });

        // Verify task exists and get project info
        const taskResult = await safeQuery(
            `SELECT id, project_id, created_by FROM tasks WHERE id = $1`,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Task not found."
            });
        }

        const taskRecord = taskResult.rows[0];
        const projectId = taskRecord.project_id;
        const userRole = req.user.role;
        const isExecutive = userRole === 'Executive Manager';
        const isSystemAdmin = userRole === 'System Administrator';
        const isTaskManager = userRole === 'Task Manager';
        const isTaskCreator = taskRecord.created_by === userId;

        let hasPermission = isExecutive || isSystemAdmin || isTaskManager || isTaskCreator;

        if (!hasPermission && projectId) {
            // Verify user is project creator or manager
            const projectResult = await safeQuery(
                `SELECT created_by, project_manager_id FROM projects WHERE id = $1`,
                [projectId]
            );

            if (projectResult.rows.length > 0) {
                const project = projectResult.rows[0];
                if (project.created_by === userId || project.project_manager_id === userId || userRole === 'Project Manager') {
                    hasPermission = true;
                }
            }
        }

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: "Only project managers, task managers, or task creators can update tasks."
            });
        }

        // Verify assignee exists if provided
        let assigneeName = null;
        let assigneeEmail = null;

        if (assigneeId) {
            const assigneeResult = await safeQuery(
                `SELECT id, full_name, email FROM users WHERE id = $1 AND is_active = TRUE`,
                [assigneeId]
            );

            if (assigneeResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Assignee not found or is inactive."
                });
            }

            assigneeName = assigneeResult.rows[0].full_name;
            assigneeEmail = assigneeResult.rows[0].email;
        }

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(description);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(status);
        }
        if (priority !== undefined) {
            updates.push(`priority = $${paramIndex++}`);
            values.push(priority);
        }
        if (assigneeId !== undefined) {
            updates.push(`assignee_id = $${paramIndex++}`);
            values.push(assigneeId);
        }
        if (startDate !== undefined) {
            updates.push(`start_date = $${paramIndex++}`);
            values.push(startDate);
        }
        if (dueDate !== undefined) {
            updates.push(`due_date = $${paramIndex++}`);
            values.push(dueDate);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No fields to update."
            });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(taskId);

        const query = `
            UPDATE tasks 
            SET ${updates.join(", ")} 
            WHERE id = $${paramIndex} 
            RETURNING *
        `;

        const result = await safeQuery(query, values);
        const task = result.rows[0];

        if (assigneeName) {
            task.assignee_name = assigneeName;
            task.assignee_email = assigneeEmail;
        }

        console.log('✅ Task updated:', taskId);

        return res.status(200).json({
            success: true,
            message: "Task updated successfully.",
            task: task
        });

    } catch (error) {
        console.error("❌ Update task error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to update task.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   UPDATE TASK STATUS
   PATCH /api/tasks/:taskId/status
========================================================= */

/* =========================================================
   UPDATE TASK STATUS
   PATCH /api/tasks/:taskId/status
========================================================= */

const updateTaskStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        console.log('🔍 Updating task status:', { taskId, status, user: userId, role: userRole });

        // =========================================================
        // VALIDATE STATUS
        // =========================================================
        if (!["To Do", "In Progress", "Completed", "Backlog"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be 'To Do', 'In Progress', 'Completed', or 'Backlog'."
            });
        }

        // =========================================================
        // GET CURRENT TASK
        // =========================================================
        const taskResult = await safeQuery(
            `SELECT id, status, assignee_id, name FROM tasks WHERE id = $1`,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Task not found."
            });
        }

        const currentTask = taskResult.rows[0];
        const currentStatus = currentTask.status;

        // =========================================================
        // ROLE-BASED RULES
        // =========================================================

        // ---------------------------------------------------------
        // MEMBERS & WORKERS
        // Members and Workers can only set: "To Do" (revert), "In Progress", "Completed"
        // Cannot set: "Done" or "Backlog"
        // ---------------------------------------------------------
        if (userRole === "Member" || userRole === "Worker") {
            if (status === "Done") {
                return res.status(403).json({
                    success: false,
                    message: "Workers and members cannot mark tasks as Done. Please mark the task as Completed for review."
                });
            }

            if (status === "Backlog") {
                return res.status(403).json({
                    success: false,
                    message: "Workers and members cannot move tasks to Backlog."
                });
            }

            // Can only update their own assigned tasks
            if (String(currentTask.assignee_id) !== String(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You can only update the status of tasks assigned to you."
                });
            }

            // Block reverting from Completed back to To Do (optional safety)
            if (currentStatus === "Completed" && status === "To Do") {
                return res.status(403).json({
                    success: false,
                    message: "You cannot move a Completed task back to To Do. Please contact your manager."
                });
            }
        }



        // =========================================================
        // UPDATE STATUS
        // =========================================================
        const result = await safeQuery(
            `
            UPDATE tasks 
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 
            RETURNING *
            `,
            [status, taskId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Task not found."
            });
        }

        const task = result.rows[0];

        // Fetch assignee name if exists
        if (task.assignee_id) {
            const assigneeRes = await safeQuery(
                `SELECT full_name, email FROM users WHERE id = $1`,
                [task.assignee_id]
            );

            if (assigneeRes.rows.length > 0) {
                task.assignee_name = assigneeRes.rows[0].full_name;
                task.assignee_email = assigneeRes.rows[0].email;
            }
        }

        console.log('✅ Task status updated:', taskId, 'from', currentStatus, 'to', status);

        return res.status(200).json({
            success: true,
            message: "Task status updated successfully.",
            task: task
        });

    } catch (error) {
        console.error("❌ Update task status error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to update task status.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   DELETE TASK
   DELETE /api/tasks/:taskId
========================================================= */

const deleteTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        console.log('🔍 Deleting task:', { taskId, user: userId });

        // Check user role
        const userResult = await safeQuery(
            `SELECT role FROM users WHERE id = $1 AND is_active = true`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "User not found or inactive."
            });
        }

        const userRole = userResult.rows[0].role;

        const allowedRoles = [
            "Project Manager",
            "Executive Manager",
            "System Administrator",
            "Task Manager"
        ];

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: "Only Project Manager, Task Manager, Executive Manager, or System Administrator can delete tasks."
            });
        }

        // Check if task exists
        const taskResult = await safeQuery(
            `SELECT id FROM tasks WHERE id = $1`,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Task not found."
            });
        }

        // Delete task submissions first (if any)
        await safeQuery(
            `DELETE FROM task_submissions WHERE task_id = $1`,
            [taskId]
        );

        // Delete task challenges (if any)
        await safeQuery(
            `DELETE FROM task_challenges WHERE task_id = $1`,
            [taskId]
        );

        // Delete task attachments (if any)
        await safeQuery(
            `DELETE FROM task_attachments WHERE task_id = $1`,
            [taskId]
        );

        // Delete the task
        await safeQuery(
            `DELETE FROM tasks WHERE id = $1`,
            [taskId]
        );

        console.log('✅ Task deleted:', taskId);

        return res.status(200).json({
            success: true,
            message: "Task and its associated data deleted successfully."
        });

    } catch (error) {
        console.error("❌ Delete task error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to delete task.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   ASSIGN TASK
   PATCH /api/tasks/:taskId/assign
========================================================= */

const assignTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { assigneeId } = req.body;
        const userId = req.user.id;

        console.log('🔍 Assigning task:', { taskId, assigneeId, user: userId });

        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: "Task ID is required.",
            });
        }

        if (!assigneeId) {
            return res.status(400).json({
                success: false,
                message: "Assignee ID is required.",
            });
        }

        // Get task + project info
        const taskResult = await safeQuery(
            `
            SELECT
                t.id AS task_id,
                t.name AS task_name,
                t.project_id,
                t.created_by AS task_created_by,
                p.name AS project_name,
                p.project_manager_id,
                p.created_by
            FROM tasks t
            LEFT JOIN projects p ON p.id = t.project_id
            WHERE t.id = $1
            `,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Task not found.",
            });
        }

        const task = taskResult.rows[0];

        // Check authorization
        const userRoleResult = await safeQuery(
            `SELECT role FROM users WHERE id = $1 AND is_active = TRUE`,
            [userId]
        );

        if (userRoleResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "User not found or inactive.",
            });
        }

        const userRole = userRoleResult.rows[0].role;
        const isProjectCreator = task.created_by === userId || task.task_created_by === userId;
        const isAdmin = userRole === "System Administrator" || userRole === "Executive Manager";
        const isPM = userRole === "Project Manager" || userRole === "Task Manager";

        if (!isAdmin && !isPM && !isProjectCreator) {
            return res.status(403).json({
                success: false,
                message: "Only System Administrator, Project Manager, Task Manager, or the Creator can assign tasks.",
            });
        }

        // Verify assignee exists and is active
        const assigneeResult = await safeQuery(
            `
            SELECT id, full_name, email, role
            FROM users
            WHERE id = $1 AND is_active = TRUE
            `,
            [assigneeId]
        );

        if (assigneeResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Team member not found or inactive.",
            });
        }

        const assignee = assigneeResult.rows[0];

        // Check if assignee is already a project member (if project exists)
        if (task.project_id) {
            const projectMemberCheck = await safeQuery(
                `
                SELECT user_id FROM project_members 
                WHERE project_id = $1 AND user_id = $2
                `,
                [task.project_id, assigneeId]
            );

            // Auto-add to project_members if not already there
            if (projectMemberCheck.rows.length === 0) {
                try {
                    await safeQuery(
                        `
                        INSERT INTO project_members (project_id, user_id, role)
                        VALUES ($1, $2, $3)
                        ON CONFLICT DO NOTHING
                        `,
                        [task.project_id, assigneeId, assignee.role || "Member"]
                    );
                } catch (error) {
                    console.warn("Could not add user to project members:", error);
                }
            }
        }

        // Assign the task
        const updateResult = await safeQuery(
            `
            UPDATE tasks
            SET assignee_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
            `,
            [assigneeId, taskId]
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Task could not be assigned.",
            });
        }

        const updatedTask = updateResult.rows[0];
        updatedTask.assignee_name = assignee.full_name;
        updatedTask.assignee_email = assignee.email;

        console.log('✅ Task assigned:', taskId, 'to', assignee.full_name);

        return res.status(200).json({
            success: true,
            message: `Task assigned to ${assignee.full_name} successfully.`,
            task: updatedTask,
        });

    } catch (error) {
        console.error("❌ Assign task error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Unable to assign task.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   GET MY TASKS
   GET /api/tasks/my/tasks
========================================================= */

const getMyTasks = async (req, res) => {
    try {
        const userId = req.user.id;

        console.log('🔍 Fetching my tasks for user:', userId);

        const result = await safeQuery(
            `
            SELECT 
                t.id,
                t.project_id,
                t.name,
                t.description,
                t.status,
                t.priority,
                t.assignee_id,
                t.start_date,
                t.due_date,
                t.created_by,
                t.created_at,
                t.updated_at,
                u.full_name as assignee_name,
                u.email as assignee_email,
                p.name as project_name,
                p.domain as project_domain
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.assignee_id = $1
            ORDER BY 
                CASE 
                    WHEN t.status = 'To Do' THEN 1
                    WHEN t.status = 'In Progress' THEN 2
                    WHEN t.status = 'Completed' THEN 3
                    WHEN t.status = 'Done' THEN 4
                    ELSE 5
                END,
                t.due_date ASC NULLS LAST,
                t.created_at DESC
            `,
            [userId]
        );

        console.log(`✅ Found ${result.rows.length} tasks for user:`, userId);

        return res.status(200).json({
            success: true,
            tasks: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error("❌ Get my tasks error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve your tasks.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};
/* =========================================================
   GET MY PROJECTS
   GET /api/tasks/my/projects
========================================================= */

const getMyProjects = async (req, res) => {
    try {
        const userId = req.user.id;

        console.log('🔍 Fetching my projects for user:', userId);

        const result = await safeQuery(
            `
            SELECT DISTINCT
                p.id,
                p.name,
                p.domain,
                p.status,
                p.about_title,
                p.about_description,
                p.start_date,
                p.deadline,
                p.priority,
                COUNT(t.id)::int as total_tasks,
                COUNT(CASE WHEN t.assignee_id = $1 THEN 1 END)::int as my_tasks,
                COUNT(CASE WHEN (t.status = 'Completed' OR t.status = 'Done') AND t.assignee_id = $1 THEN 1 END)::int as my_completed_tasks
            FROM projects p
            LEFT JOIN tasks t ON p.id = t.project_id
            WHERE t.assignee_id = $1
            GROUP BY p.id
            ORDER BY p.name
            `,
            [userId]
        );

        console.log(`✅ Found ${result.rows.length} projects for user:`, userId);

        return res.status(200).json({
            success: true,
            projects: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error("❌ Get my projects error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve your projects.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   GET TASK STATS
   GET /api/tasks/stats
========================================================= */

const getTaskStats = async (req, res) => {
    try {
        console.log('🔍 Fetching task stats for user:', req.user?.id);

        const result = await safeQuery(`
            SELECT 
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status = 'To Do' THEN 1 END) as todo,
                COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'Done' THEN 1 END) as done,
                COUNT(CASE WHEN status = 'Backlog' THEN 1 END) as backlog,
                COUNT(CASE WHEN assignee_id = $1 THEN 1 END) as assigned_to_me,
                COUNT(CASE WHEN assignee_id = $1 AND status = 'To Do' THEN 1 END) as my_todo,
                COUNT(CASE WHEN assignee_id = $1 AND status = 'In Progress' THEN 1 END) as my_in_progress,
                COUNT(CASE WHEN assignee_id = $1 AND status = 'Completed' THEN 1 END) as my_completed,
                COUNT(CASE WHEN assignee_id = $1 AND status = 'Done' THEN 1 END) as my_done
            FROM tasks
            `,
            [req.user.id]
        );

        console.log('✅ Task stats fetched');

        return res.status(200).json({
            success: true,
            stats: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Get task stats error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch task stats.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

const getTasks = async (req, res) => {
    try {
        const { 
            taskName, 
            taskId, 
            projectName, 
            projectId, 
            status, 
            assigneeName, 
            assigneeId 
        } = req.query || {};

        console.log('🔍 getTasks called with filters:', {
            taskName,
            taskId,
            projectName,
            projectId,
            status,
            assigneeName,
            assigneeId,
            userId: req.user?.id,
            role: req.user?.role
        });

        const userId = req.user?.id;
        const userRole = req.user?.role;

        let query = `
            SELECT 
                t.id,
                t.project_id,
                t.name,
                t.description,
                t.status,
                t.priority,
                t.assignee_id,
                t.start_date,
                t.due_date,
                t.created_by,
                t.created_at,
                t.updated_at,
                u.full_name as assignee_name,
                u.email as assignee_email,
                p.name as project_name,
                p.domain as project_domain
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        const isMemberOrWorker = userRole === 'Member' || userRole === 'Worker';
        const isProjectManager = userRole === 'Project Manager';

        if (isMemberOrWorker) {
            query += ` AND t.assignee_id = $${paramIndex}`;
            params.push(userId);
            paramIndex++;
        } else if (isProjectManager) {
            query += ` AND (p.project_manager_id = $${paramIndex} OR t.created_by = $${paramIndex})`;
            params.push(userId);
            paramIndex++;
        }

        if (taskName) {
            query += ` AND LOWER(TRIM(t.name)) = LOWER(TRIM($${paramIndex}))`;
            params.push(taskName);
            paramIndex++;
        }

        if (taskId) {
            query += ` AND t.id = $${paramIndex}`;
            params.push(taskId);
            paramIndex++;
        }

        if (projectName) {
            query += ` AND LOWER(TRIM(p.name)) = LOWER(TRIM($${paramIndex}))`;
            params.push(projectName);
            paramIndex++;
        }

        if (projectId) {
            query += ` AND t.project_id = $${paramIndex}`;
            params.push(projectId);
            paramIndex++;
        }

        if (status) {
            query += ` AND LOWER(TRIM(t.status)) = LOWER(TRIM($${paramIndex}))`;
            params.push(status);
            paramIndex++;
        }

        if (assigneeName) {
            query += ` AND LOWER(TRIM(u.full_name)) = LOWER(TRIM($${paramIndex}))`;
            params.push(assigneeName);
            paramIndex++;
        }

        if (assigneeId) {
            query += ` AND t.assignee_id = $${paramIndex}`;
            params.push(assigneeId);
            paramIndex++;
        }

        query += ` ORDER BY t.created_at DESC`;

        const result = await safeQuery(query, params);

        console.log(`✅ Found ${result.rows.length} tasks`);

        if (req._isAIAgent) {
            return {
                success: true,
                tasks: result.rows,
                count: result.rows.length
            };
        }

        return res.status(200).json({
            success: true,
            tasks: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error("❌ Get tasks error:", error);
        console.error("Stack:", error.stack);

        if (req._isAIAgent) {
            return {
                success: false,
                error: error.message || 'Failed to retrieve tasks',
                tasks: []
            };
        }

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve tasks.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};


module.exports = {
    getProjectTasks,
    getTask,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    assignTask,
    getMyTasks,
    getMyProjects,
    getTaskStats,
    getTasks
};
