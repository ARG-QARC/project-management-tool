// controllers/dashboardcontroller.js
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

/* =========================================================
   HELPER: CLASSIFY USER ROLE
========================================================= */

const classifyUserRole = (user) => {
    const role = String(user.role || "")
        .toLowerCase()
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    const jobTitle = String(user.job_title || "")
        .toLowerCase()
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    const combined = `${role} ${jobTitle}`;

    /* ---------------------------------------------------------
       1. MANAGERS
    --------------------------------------------------------- */
    const isManager =
        role === "project manager" ||
        role === "executive manager" ||
        role === "team manager" ||
        role === "engineering manager" ||
        role === "product manager" ||
        role === "program manager" ||
        role === "manager" ||
        role.includes("manager") ||
        jobTitle.includes("manager") ||
        jobTitle.includes("team lead") ||
        jobTitle.includes("technical lead") ||
        jobTitle.includes("project lead");

    if (isManager) return { category: 'manager', label: 'Managers' };

    /* ---------------------------------------------------------
       2. DESIGNERS
    --------------------------------------------------------- */
    const isDesigner =
        combined.includes("frontend developer") ||
        combined.includes("front end developer") ||
        combined.includes("frontend engineer") ||
        combined.includes("front end engineer") ||
        combined.includes("ui developer") ||
        combined.includes("ux developer") ||
        combined.includes("ui/ux") ||
        combined.includes("ui ux") ||
        combined.includes("ui designer") ||
        combined.includes("ux designer") ||
        combined.includes("web designer") ||
        combined.includes("product designer") ||
        combined.includes("graphic designer") ||
        combined.includes("interaction designer") ||
        combined.includes("frontend");

    if (isDesigner) return { category: 'designer', label: 'Designers' };

    /* ---------------------------------------------------------
       3. DEVELOPERS
    --------------------------------------------------------- */
    const isDeveloper =
        combined.includes("full stack") ||
        combined.includes("fullstack") ||
        combined.includes("backend") ||
        combined.includes("back end") ||
        combined.includes("java") ||
        combined.includes("node") ||
        combined.includes("nodejs") ||
        combined.includes("node.js") ||
        combined.includes(".net") ||
        combined.includes("dotnet") ||
        combined.includes("c#") ||
        combined.includes("asp.net") ||
        combined.includes("php") ||
        combined.includes("python") ||
        combined.includes("django") ||
        combined.includes("flask") ||
        combined.includes("spring") ||
        combined.includes("software engineer") ||
        combined.includes("software developer") ||
        combined.includes("web developer") ||
        combined.includes("mobile developer") ||
        combined.includes("app developer") ||
        combined.includes("application developer") ||
        combined.includes("developer") ||
        combined.includes("engineer") ||
        role.includes("developer") ||
        jobTitle.includes("developer");

    if (isDeveloper) return { category: 'developer', label: 'Developers' };

    /* ---------------------------------------------------------
       4. QA / TESTING
    --------------------------------------------------------- */
    const isQA =
        combined.includes("qa") ||
        combined.includes("quality assurance") ||
        combined.includes("quality analyst") ||
        combined.includes("quality engineer") ||
        combined.includes("test engineer") ||
        combined.includes("software tester") ||
        combined.includes("tester") ||
        combined.includes("testing");

    if (isQA) return { category: 'qa', label: 'QA' };

    /* ---------------------------------------------------------
       5. OTHER
    --------------------------------------------------------- */
    return { category: 'other', label: 'Other' };
};

/* =========================================================
   DASHBOARD TEAM OVERVIEW
========================================================= */

const getDashboardTeamOverview = async (req, res) => {
    try {
        console.log('🔍 Fetching dashboard team overview for user:', req.user?.id);

        /* ---------------------------------------------------------
           FETCH ALL USERS - Using safeQuery
        --------------------------------------------------------- */
        const result = await safeQuery(`
            SELECT
                id,
                role,
                job_title,
                is_active
            FROM users
            WHERE is_active = TRUE
            ORDER BY id
        `);

        const users = result.rows;

        if (users.length === 0) {
            console.log('ℹ️ No active users found');
            return res.status(200).json({
                success: true,
                total: 0,
                developers: 0,
                designers: 0,
                managers: 0,
                qa: 0,
                other: 0,
                message: 'No active users found'
            });
        }

        console.log(`📊 Processing ${users.length} active users`);

        /* ---------------------------------------------------------
           CLASSIFY EACH USER
        --------------------------------------------------------- */
        let developers = 0;
        let designers = 0;
        let managers = 0;
        let qa = 0;
        let other = 0;

        const userCategories = [];

        users.forEach((user) => {
            const classification = classifyUserRole(user);
            
            // Count by category
            switch (classification.category) {
                case 'developer':
                    developers++;
                    break;
                case 'designer':
                    designers++;
                    break;
                case 'manager':
                    managers++;
                    break;
                case 'qa':
                    qa++;
                    break;
                default:
                    other++;
                    break;
            }
            
            userCategories.push({
                id: user.id,
                role: user.role,
                jobTitle: user.job_title,
                category: classification.category,
                categoryLabel: classification.label
            });
        });

        console.log('📊 Team breakdown:', {
            managers,
            developers,
            designers,
            qa,
            other,
            total: users.length
        });

        /* ---------------------------------------------------------
           RESPONSE
        --------------------------------------------------------- */
        return res.status(200).json({
            success: true,
            total: users.length,
            developers,
            designers,
            managers,
            qa,
            other,
            breakdown: userCategories, // Optional: detailed breakdown
        });

    } catch (error) {
        console.error("❌ Dashboard team overview error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard team overview.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   DASHBOARD PROJECT STATS
========================================================= */

const getDashboardProjectStats = async (req, res) => {
    try {
        console.log('🔍 Fetching dashboard project stats');

        /* ---------------------------------------------------------
           GET PROJECT STATS
        --------------------------------------------------------- */
        const statsResult = await safeQuery(`
            SELECT 
                COUNT(*) as total_projects,
                COUNT(CASE WHEN status = 'Done' THEN 1 END) as completed_projects,
                COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_projects,
                COUNT(CASE WHEN status = 'Backlog' THEN 1 END) as backlog_projects,
                COUNT(CASE WHEN status = 'Unassigned' THEN 1 END) as unassigned_projects,
                COUNT(CASE WHEN status = 'Paused' THEN 1 END) as paused_projects,
                COALESCE(AVG(progress), 0) as avg_progress
            FROM projects
        `);

        /* ---------------------------------------------------------
           GET RECENT PROJECTS
        --------------------------------------------------------- */
        const recentProjectsResult = await safeQuery(`
            SELECT 
                p.id,
                p.name,
                p.status,
                p.priority,
                p.progress,
                p.created_at,
                u.full_name as created_by_name
            FROM projects p
            LEFT JOIN users u ON p.created_by = u.id
            ORDER BY p.created_at DESC
            LIMIT 10
        `);

        const stats = statsResult.rows[0];

        console.log('📊 Project stats:', stats);

        return res.status(200).json({
            success: true,
            stats: {
                total: parseInt(stats.total_projects) || 0,
                completed: parseInt(stats.completed_projects) || 0,
                inProgress: parseInt(stats.in_progress_projects) || 0,
                backlog: parseInt(stats.backlog_projects) || 0,
                unassigned: parseInt(stats.unassigned_projects) || 0,
                paused: parseInt(stats.paused_projects) || 0,
                averageProgress: Math.round(parseFloat(stats.avg_progress) || 0),
            },
            recentProjects: recentProjectsResult.rows || [],
        });

    } catch (error) {
        console.error("❌ Dashboard project stats error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard project stats.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   DASHBOARD TASK STATS
========================================================= */

const getDashboardTaskStats = async (req, res) => {
    try {
        console.log('🔍 Fetching dashboard task stats');

        /* ---------------------------------------------------------
           GET TASK STATS
        --------------------------------------------------------- */
        const statsResult = await safeQuery(`
            SELECT 
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status IN ('Completed', 'Done') THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_tasks,
                COUNT(CASE WHEN status = 'To Do' THEN 1 END) as todo_tasks,
                COUNT(CASE WHEN status = 'Backlog' THEN 1 END) as backlog_tasks,
                COALESCE(AVG(
                    CASE 
                        WHEN due_date IS NOT NULL 
                        AND status NOT IN ('Completed', 'Done') 
                        AND due_date < CURRENT_DATE 
                        THEN 1 
                        ELSE 0 
                    END
                ) * 100, 0) as overdue_percentage
            FROM tasks
        `);

        /* ---------------------------------------------------------
           GET TASKS BY PRIORITY
        --------------------------------------------------------- */
        const priorityResult = await safeQuery(`
            SELECT 
                priority,
                COUNT(*) as count,
                COUNT(CASE WHEN status = 'Done' THEN 1 END) as completed
            FROM tasks
            WHERE priority IS NOT NULL
            GROUP BY priority
            ORDER BY 
                CASE priority
                    WHEN 'High' THEN 1
                    WHEN 'Medium' THEN 2
                    WHEN 'Low' THEN 3
                    ELSE 4
                END
        `);

        /* ---------------------------------------------------------
           GET RECENT TASKS
        --------------------------------------------------------- */
        const recentTasksResult = await safeQuery(`
            SELECT 
                t.id,
                t.name,
                t.status,
                t.priority,
                t.due_date,
                t.created_at,
                p.name as project_name,
                u.full_name as assignee_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN users u ON t.assignee_id = u.id
            ORDER BY t.created_at DESC
            LIMIT 10
        `);

        const stats = statsResult.rows[0];

        console.log('📊 Task stats:', stats);

        return res.status(200).json({
            success: true,
            stats: {
                total: parseInt(stats.total_tasks) || 0,
                completed: parseInt(stats.completed_tasks) || 0,
                inProgress: parseInt(stats.in_progress_tasks) || 0,
                todo: parseInt(stats.todo_tasks) || 0,
                backlog: parseInt(stats.backlog_tasks) || 0,
                overduePercentage: Math.round(parseFloat(stats.overdue_percentage) || 0),
            },
            byPriority: priorityResult.rows || [],
            recentTasks: recentTasksResult.rows || [],
        });

    } catch (error) {
        console.error("❌ Dashboard task stats error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard task stats.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   COMPLETE DASHBOARD DATA
========================================================= */

const getCompleteDashboard = async (req, res) => {
    try {
        console.log('🔍 Fetching complete dashboard data');

        /* ---------------------------------------------------------
           FETCH ALL DASHBOARD DATA IN PARALLEL
        --------------------------------------------------------- */
        const [
            teamOverview,
            projectStats,
            taskStats
        ] = await Promise.all([
            // Get team overview
            safeQuery(`
                SELECT id, role, job_title, is_active
                FROM users
                WHERE is_active = TRUE
            `),
            
            // Get project stats
            safeQuery(`
                SELECT 
                    COUNT(*) as total_projects,
                    COUNT(CASE WHEN status = 'Done' THEN 1 END) as completed_projects,
                    COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_projects,
                    COALESCE(AVG(progress), 0) as avg_progress
                FROM projects
            `),
            
            // Get task stats
            safeQuery(`
                SELECT 
                    COUNT(*) as total_tasks,
                    COUNT(CASE WHEN status IN ('Completed', 'Done') THEN 1 END) as completed_tasks,
                    COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_tasks,
                    COUNT(CASE WHEN status = 'To Do' THEN 1 END) as todo_tasks,
                    COUNT(CASE WHEN status = 'Backlog' THEN 1 END) as backlog_tasks
                FROM tasks
            `)
        ]);

        /* ---------------------------------------------------------
           PROCESS TEAM DATA
        --------------------------------------------------------- */
        let developers = 0, designers = 0, managers = 0, qa = 0, other = 0;

        teamOverview.rows.forEach((user) => {
            const classification = classifyUserRole(user);
            switch (classification.category) {
                case 'developer': developers++; break;
                case 'designer': designers++; break;
                case 'manager': managers++; break;
                case 'qa': qa++; break;
                default: other++; break;
            }
        });

        const projectStatsData = projectStats.rows[0];
        const taskStatsData = taskStats.rows[0];

        return res.status(200).json({
            success: true,
            team: {
                total: teamOverview.rows.length,
                developers,
                designers,
                managers,
                qa,
                other,
            },
            projects: {
                total: parseInt(projectStatsData.total_projects) || 0,
                completed: parseInt(projectStatsData.completed_projects) || 0,
                inProgress: parseInt(projectStatsData.in_progress_projects) || 0,
                averageProgress: Math.round(parseFloat(projectStatsData.avg_progress) || 0),
            },
            tasks: {
                total: parseInt(taskStatsData.total_tasks) || 0,
                completed: parseInt(taskStatsData.completed_tasks) || 0,
                inProgress: parseInt(taskStatsData.in_progress_tasks) || 0,
                todo: parseInt(taskStatsData.todo_tasks) || 0,
                backlog: parseInt(taskStatsData.backlog_tasks) || 0,
            },
        });

    } catch (error) {
        console.error("❌ Complete dashboard error:", error);
        console.error("Stack:", error.stack);

        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard data.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   PROJECT MANAGER DASHBOARD
   GET /api/dashboard/manager
========================================================= */

const getManagerDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role || "";
        const isExecutiveOrAdmin = userRole === "Executive Manager" || userRole === "System Administrator" || userRole === "Task Manager";

        console.log(`🔍 Fetching manager dashboard for user: ${userId} (${userRole})`);

        // Scope projects query: Executive/Admin see all, PM sees projects they manage or created
        const projectFilter = isExecutiveOrAdmin
            ? ""
            : "WHERE (p.project_manager_id = $1 OR p.created_by = $1)";
        const projectParams = isExecutiveOrAdmin ? [] : [userId];

        const [
            projectsResult,
            tasksStatsResult,
            pendingApprovalsResult,
            teamWorkloadResult,
            priorityResult
        ] = await Promise.all([
            // 1. Projects summary
            safeQuery(`
                SELECT 
                    p.id, p.name, p.domain, p.status, p.priority, p.progress,
                    p.start_date, p.deadline, p.created_at,
                    COALESCE(u.full_name, 'Unassigned') as manager_name,
                    COUNT(t.id)::int as total_tasks,
                    COUNT(CASE WHEN t.status IN ('Completed', 'Done') THEN 1 END)::int as done_tasks
                FROM projects p
                LEFT JOIN users u ON p.project_manager_id = u.id
                LEFT JOIN tasks t ON p.id = t.project_id
                ${projectFilter}
                GROUP BY p.id, u.full_name
                ORDER BY p.deadline ASC NULLS LAST, p.created_at DESC
            `, projectParams),

            // 2. Aggregate task stats across managed projects
            safeQuery(`
                SELECT 
                    COUNT(t.id)::int as total_tasks,
                    COUNT(CASE WHEN t.status IN ('Completed', 'Done') THEN 1 END)::int as done_tasks,
                    COUNT(CASE WHEN t.status = 'Completed' THEN 1 END)::int as completed_tasks,
                    COUNT(CASE WHEN t.status = 'In Progress' THEN 1 END)::int as in_progress_tasks,
                    COUNT(CASE WHEN t.status = 'To Do' OR t.status IS NULL THEN 1 END)::int as todo_tasks,
                    COUNT(CASE WHEN t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status NOT IN ('Completed', 'Done') THEN 1 END)::int as overdue_tasks
                FROM tasks t
                ${!isExecutiveOrAdmin ? "JOIN projects p ON t.project_id = p.id WHERE (p.project_manager_id = $1 OR p.created_by = $1)" : ""}
            `, projectParams),

            // 3. Tasks pending PM review / approval (status = 'Completed' by member)
            safeQuery(`
                SELECT 
                    t.id, t.name, t.priority, t.due_date, t.updated_at,
                    p.id as project_id, p.name as project_name,
                    u.id as assignee_id, u.full_name as assignee_name, u.email as assignee_email
                FROM tasks t
                JOIN projects p ON t.project_id = p.id
                LEFT JOIN users u ON t.assignee_id = u.id
                WHERE t.status = 'Completed'
                ${!isExecutiveOrAdmin ? "AND (p.project_manager_id = $1 OR p.created_by = $1)" : ""}
                ORDER BY t.updated_at DESC
                LIMIT 15
            `, projectParams),

            // 4. Team members workload across managed projects
            safeQuery(`
                SELECT 
                    u.id, u.full_name, u.role, u.job_title,
                    COUNT(t.id)::int as total_tasks,
                    COUNT(CASE WHEN t.status IN ('Completed', 'Done') THEN 1 END)::int as done_tasks,
                    COUNT(CASE WHEN t.status = 'In Progress' THEN 1 END)::int as in_progress_tasks,
                    COUNT(CASE WHEN t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status NOT IN ('Completed', 'Done') THEN 1 END)::int as overdue_tasks
                FROM users u
                JOIN tasks t ON t.assignee_id = u.id
                ${!isExecutiveOrAdmin ? "JOIN projects p ON t.project_id = p.id AND (p.project_manager_id = $1 OR p.created_by = $1)" : ""}
                WHERE u.is_active = TRUE
                GROUP BY u.id
                ORDER BY total_tasks DESC
                LIMIT 12
            `, projectParams),

            // 5. Priority distribution
            safeQuery(`
                SELECT 
                    COALESCE(t.priority, 'Medium') as priority,
                    COUNT(t.id)::int as count
                FROM tasks t
                ${!isExecutiveOrAdmin ? "JOIN projects p ON t.project_id = p.id WHERE (p.project_manager_id = $1 OR p.created_by = $1)" : ""}
                GROUP BY t.priority
            `, projectParams)
        ]);

        const projects = projectsResult.rows;
        const taskStats = tasksStatsResult.rows[0] || {
            total_tasks: 0, done_tasks: 0, completed_tasks: 0,
            in_progress_tasks: 0, todo_tasks: 0, overdue_tasks: 0
        };
        const activeProjects = projects.filter(p => !['completed', 'done'].includes((p.status || '').toLowerCase())).length;
        const completedProjects = projects.filter(p => ['completed', 'done'].includes((p.status || '').toLowerCase())).length;
        const completionRate = taskStats.total_tasks > 0 
            ? Math.round((taskStats.done_tasks / taskStats.total_tasks) * 100) 
            : 0;

        return res.status(200).json({
            success: true,
            role: userRole,
            dashboardType: "manager",
            stats: {
                totalProjects: projects.length,
                activeProjects,
                completedProjects,
                totalTasks: taskStats.total_tasks,
                doneTasks: taskStats.done_tasks,
                inProgressTasks: taskStats.in_progress_tasks,
                todoTasks: taskStats.todo_tasks,
                pendingApprovalsCount: taskStats.completed_tasks,
                overdueTasks: taskStats.overdue_tasks,
                completionRate
            },
            pendingApprovals: pendingApprovalsResult.rows,
            teamWorkload: teamWorkloadResult.rows,
            projects: projects.slice(0, 10),
            priorityBreakdown: priorityResult.rows
        });

    } catch (error) {
        console.error("❌ Manager dashboard error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load Project Manager dashboard.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   MEMBER DASHBOARD
   GET /api/dashboard/member
========================================================= */

const getMemberDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('🔍 Fetching member dashboard for user:', userId);

        const [
            tasksResult,
            projectsResult,
            recentSubmissionsResult
        ] = await Promise.all([
            // 1. All tasks assigned to this member
            safeQuery(`
                SELECT 
                    t.id, t.project_id, t.name, t.description, t.status, t.priority,
                    t.start_date, t.due_date, t.created_at, t.updated_at,
                    p.name as project_name, p.domain as project_domain
                FROM tasks t
                LEFT JOIN projects p ON t.project_id = p.id
                WHERE t.assignee_id = $1
                ORDER BY 
                    CASE 
                        WHEN t.status = 'In Progress' THEN 1
                        WHEN t.status = 'To Do' OR t.status IS NULL THEN 2
                        WHEN t.status = 'Completed' THEN 3
                        WHEN t.status = 'Done' THEN 4
                        ELSE 5
                    END,
                    t.due_date ASC NULLS LAST,
                    t.created_at DESC
            `, [userId]),

            // 2. Projects this member contributes to
            safeQuery(`
                SELECT 
                    p.id, p.name, p.domain, p.status, p.deadline, p.progress,
                    COUNT(t.id)::int as my_tasks_count,
                    COUNT(CASE WHEN t.status IN ('Completed', 'Done') THEN 1 END)::int as my_done_count,
                    COUNT(CASE WHEN t.status = 'In Progress' THEN 1 END)::int as my_in_progress_count
                FROM projects p
                JOIN tasks t ON p.id = t.project_id
                WHERE t.assignee_id = $1
                GROUP BY p.id
                ORDER BY p.deadline ASC NULLS LAST
            `, [userId]),

            // 3. Member's recent task submissions
            safeQuery(`
                SELECT 
                    ts.id, ts.task_id, ts.link, ts.description, ts.version, ts.created_at,
                    t.name as task_name, t.status as task_status
                FROM task_submissions ts
                JOIN tasks t ON ts.task_id = t.id
                WHERE ts.submitted_by = $1
                ORDER BY ts.created_at DESC
                LIMIT 5
            `, [userId]).catch(() => ({ rows: [] }))
        ]);

        const tasks = tasksResult.rows;
        const total = tasks.length;
        const done = tasks.filter(t => ["Completed", "Done"].includes(t.status)).length;
        const pendingReview = tasks.filter(t => t.status === "Completed").length;
        const inProgress = tasks.filter(t => t.status === "In Progress").length;
        const todo = tasks.filter(t => t.status === "To Do" || !t.status).length;
        const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && !["Completed", "Done"].includes(t.status)).length;
        const rate = total > 0 ? Math.round((done / total) * 100) : 0;

        // Urgent focus tasks (due within 3 days or overdue, and not done)
        const focusTasks = tasks.filter(t => !["Completed", "Done"].includes(t.status)).slice(0, 8);

        return res.status(200).json({
            success: true,
            dashboardType: "member",
            stats: {
                totalTasks: total,
                doneTasks: done,
                inProgressTasks: inProgress,
                todoTasks: todo,
                pendingReviewCount: pendingReview,
                overdueTasks: overdue,
                completionRate: rate,
                activeProjectsCount: projectsResult.rows.length
            },
            focusTasks,
            allMyTasks: tasks,
            myProjects: projectsResult.rows,
            recentSubmissions: recentSubmissionsResult.rows || []
        });

    } catch (error) {
        console.error("❌ Member dashboard error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load Member dashboard.",
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
};

/* =========================================================
   ROLE-AWARE COMBINED DASHBOARD
   GET /api/dashboard/stats
========================================================= */

const getRoleDashboard = async (req, res) => {
    const userRole = req.user?.role || "";
    const isManager = [
        "Project Manager",
        "Executive Manager",
        "System Administrator",
        "Task Manager"
    ].includes(userRole);

    if (isManager) {
        return getManagerDashboard(req, res);
    } else {
        return getMemberDashboard(req, res);
    }
};

module.exports = {
    getDashboardTeamOverview,
    getDashboardProjectStats,
    getDashboardTaskStats,
    getCompleteDashboard,
    getManagerDashboard,
    getMemberDashboard,
    getRoleDashboard,
};
