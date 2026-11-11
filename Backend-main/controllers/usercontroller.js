// controllers/usercontroller.js
const pool = require("../config/db");
const bcrypt = require("bcryptjs");

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
   ALLOWED ROLES
========================================================= */

const ALLOWED_ROLES = [
  "System Administrator",
  "Executive Manager",
  "Project Manager",
  "Task Manager",
  "Member",
  "Worker",
];

/* =========================================================
   GET ALL USERS
   GET /api/users
========================================================= */

const getUsers = async (req, res) => {
  try {
    console.log('🔍 Fetching all users for user:', req.user?.id);

    const result = await safeQuery(`
      SELECT
        id,
        email,
        full_name,
        role,
        is_active,
        last_login_at,
        created_at,
        updated_at,
        job_title,
        remarks
      FROM users
      ORDER BY created_at DESC
    `);

    console.log(`✅ Found ${result.rows.length} users`);

    return res.status(200).json({
      success: true,
      users: result.rows,
    });

  } catch (error) {
    console.error("❌ Get users error:", error);
    console.error("Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users.",
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

/* =========================================================
   GET USER BY ID
   GET /api/users/:id
========================================================= */

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('?? Fetching user profile by ID:', { id, user: req.user?.id });

    const result = await safeQuery(
      `
      SELECT
        id,
        email,
        full_name,
        role,
        is_active,
        last_login_at,
        created_at,
        updated_at,
        job_title,
        remarks
      FROM users
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = result.rows[0];

    // Fetch assigned projects
    const projectsRes = await safeQuery(
      `
      SELECT DISTINCT
        p.id,
        p.name,
        p.domain,
        p.status,
        p.priority,
        p.start_date,
        p.deadline,
        COALESCE(pm.role, CASE WHEN p.project_manager_id = $1 THEN 'Project Lead' ELSE 'Member' END) as project_role
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
      WHERE pm.user_id = $1 OR p.project_manager_id = $1 OR p.created_by = $1
      ORDER BY p.name ASC
      `,
      [id]
    );

    // Fetch assigned tasks
    const tasksRes = await safeQuery(
      `
      SELECT 
        t.id,
        t.name,
        t.title,
        t.status,
        t.priority,
        t.due_date,
        t.project_id,
        p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.assignee_id = $1 OR t.assigned_to = $1
      ORDER BY t.created_at DESC
      `,
      [id]
    );

    const tasks = tasksRes.rows;
    const taskStats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'Completed' || t.status === 'Done').length,
      in_progress: tasks.filter(t => t.status === 'In Progress').length,
      to_do: tasks.filter(t => t.status === 'To Do' || t.status === 'Backlog').length,
    };

    console.log('? User profile fetched:', id, { projects: projectsRes.rows.length, tasks: tasks.length });

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        projects: projectsRes.rows,
        tasks: tasks,
        taskStats,
      },
    });

  } catch (error) {
    console.error("? Get user by ID error:", error);
    console.error("Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile.",
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

/* =========================================================
   CREATE USER
   POST /api/users
========================================================= */

const createUser = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      role,
      jobTitle,
    } = req.body;

    console.log('🔍 Creating user:', { email, role, jobTitle, user: req.user?.id });

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, password and role are required.",
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role. Allowed roles: " + ALLOWED_ROLES.join(", "),
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    /* -----------------------------------------------------
       CHECK EXISTING EMAIL
    ----------------------------------------------------- */

    const existingUser = await safeQuery(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    /* -----------------------------------------------------
       HASH PASSWORD
    ----------------------------------------------------- */

    const passwordHash = await bcrypt.hash(password, 10);

    /* -----------------------------------------------------
       GENERATE USER ID
    ----------------------------------------------------- */

    const userId = 'usr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

    /* -----------------------------------------------------
       INSERT USER
    ----------------------------------------------------- */

    const result = await safeQuery(
      `
      INSERT INTO users (
        id,
        email,
        password_hash,
        full_name,
        role,
        is_active,
        job_title
      )
      VALUES ($1, $2, $3, $4, $5, true, $6)
      RETURNING
        id,
        email,
        full_name,
        role,
        is_active,
        last_login_at,
        created_at,
        updated_at,
        job_title
      `,
      [
        userId,
        normalizedEmail,
        passwordHash,
        fullName.trim(),
        role,
        jobTitle?.trim() || null,
      ]
    );

    console.log('✅ User created:', result.rows[0].id);

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      user: result.rows[0],
    });

  } catch (error) {
    console.error("❌ Create user error:", error);
    console.error("Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Failed to create user.",
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

/* =========================================================
   UPDATE USER
   PATCH /api/users/:id
========================================================= */

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, role, jobTitle, email, remarks } = req.body;

    console.log('🔍 Updating user:', { id, fullName, role, email, user: req.user?.id });

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (!fullName && !role && !jobTitle && !email && remarks === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update.",
      });
    }

    if (role && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role. Allowed roles: " + ALLOWED_ROLES.join(", "),
      });
    }

    /* -----------------------------------------------------
       CHECK USER EXISTS
    ----------------------------------------------------- */

    const existingUser = await safeQuery(
      `SELECT id, email FROM users WHERE id = $1`,
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (fullName) {
      updates.push(`full_name = $${paramIndex}`);
      values.push(fullName.trim());
      paramIndex++;
    }

    if (role) {
      updates.push(`role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }

    if (jobTitle !== undefined) {
      updates.push(`job_title = ${paramIndex}`);
      values.push(jobTitle?.trim() || null);
      paramIndex++;
    }

    if (remarks !== undefined) {
      updates.push(`remarks = ${paramIndex}`);
      values.push(remarks?.trim() || '');
      paramIndex++;
    }

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      
      // Check if email is already taken by another user
      const emailCheck = await safeQuery(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2`,
        [normalizedEmail, id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "This email is already in use by another user.",
        });
      }

      updates.push(`email = $${paramIndex}`);
      values.push(normalizedEmail);
      paramIndex++;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING
        id,
        email,
        full_name,
        role,
        is_active,
        last_login_at,
        created_at,
        updated_at,
        job_title,
        remarks
    `;

    const result = await safeQuery(query, values);

    console.log('✅ User updated:', id);

    return res.status(200).json({
      success: true,
      message: "User updated successfully.",
      user: result.rows[0],
    });

  } catch (error) {
    console.error("❌ Update user error:", error);
    console.error("Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Failed to update user.",
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

/* =========================================================
   ACTIVATE / DEACTIVATE USER
   PATCH /api/users/:id/status
========================================================= */

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    console.log('🔍 Updating user status:', { id, isActive, user: req.user?.id });

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    /* -----------------------------------------------------
       Prevent administrator from disabling himself
    ----------------------------------------------------- */
    if (req.user?.id === id && !isActive) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account.",
      });
    }

    /* -----------------------------------------------------
       Check user exists
    ----------------------------------------------------- */
    const userCheck = await safeQuery(
      `SELECT id FROM users WHERE id = $1`,
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /* -----------------------------------------------------
       Update user status
    ----------------------------------------------------- */
    const result = await safeQuery(
      `
      UPDATE users
      SET
        is_active = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        email,
        full_name,
        role,
        is_active,
        last_login_at,
        created_at,
        updated_at,
        job_title
      `,
      [isActive, id]
    );

    console.log(`✅ User ${isActive ? 'activated' : 'deactivated'}:`, id);

    return res.status(200).json({
      success: true,
      message: isActive
        ? "User activated successfully."
        : "User deactivated successfully.",
      user: result.rows[0],
    });

  } catch (error) {
    console.error("❌ Update user status error:", error);
    console.error("Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Failed to update user status.",
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

/* =========================================================
   DELETE USER
   DELETE /api/users/:id
========================================================= */

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔍 Deleting user:', { id, user: req.user?.id });

    /* -----------------------------------------------------
       Prevent administrator from deleting himself
    ----------------------------------------------------- */
    if (req.user?.id === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account.",
      });
    }

    /* -----------------------------------------------------
       Check if user exists
    ----------------------------------------------------- */
    const userCheck = await safeQuery(
      `SELECT id, full_name FROM users WHERE id = $1`,
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /* -----------------------------------------------------
       Safe cleanup of user associations
    ----------------------------------------------------- */
    await safeTransaction(async (client) => {
      // 1. Remove from team_members
      await client.query(`DELETE FROM team_members WHERE user_id = $1`, [id]);
      
      // 2. Remove from project_members
      await client.query(`DELETE FROM project_members WHERE user_id = $1`, [id]);
      
      // 3. Remove from program_project_members
      await client.query(`DELETE FROM program_project_members WHERE user_id = $1`, [id]);

      // 4. Unassign from tasks (set assignee_id to NULL)
      await client.query(`UPDATE tasks SET assignee_id = NULL, assigned_to = NULL WHERE assignee_id = $1`, [id]);

      // 5. Unassign from program_projects
      await client.query(`UPDATE program_projects SET assigned_to = NULL WHERE assigned_to = $1`, [id]);

      // 6. Unassign from projects managed by this user
      await client.query(`UPDATE projects SET project_manager_id = NULL, manager_id = NULL WHERE project_manager_id = $1`, [id]);

      // 7. Delete user record
      await client.query(`DELETE FROM users WHERE id = $1`, [id]);
    });

    console.log('✅ User deleted with associations cleaned:', id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully.",
    });

  } catch (error) {
    console.error("❌ Delete user error:", error);
    console.error("Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user.",
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

/* =========================================================
   GET USER STATS
   GET /api/users/stats
========================================================= */

const getUserStats = async (req, res) => {
  try {
    console.log('🔍 Fetching user stats');

    const result = await safeQuery(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users,
        COUNT(CASE WHEN role = 'System Administrator' THEN 1 END) as system_admins,
        COUNT(CASE WHEN role = 'Executive Manager' THEN 1 END) as executive_managers,
        COUNT(CASE WHEN role = 'Project Manager' THEN 1 END) as project_managers,
        COUNT(CASE WHEN role = 'Task Manager' THEN 1 END) as task_managers,
        COUNT(CASE WHEN role = 'Member' THEN 1 END) as members,
        COUNT(CASE WHEN role = 'Worker' THEN 1 END) as workers
      FROM users
    `);

    console.log('✅ User stats fetched');

    return res.status(200).json({
      success: true,
      stats: result.rows[0],
    });

  } catch (error) {
    console.error("❌ Get user stats error:", error);
    console.error("Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user stats.",
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};


/* =========================================================
   UPDATE USER REMARKS
   PATCH /api/users/:id/remarks
========================================================= */

const updateUserRemarks = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    console.log('?? Updating user remarks:', { id, remarks, byUser: req.user?.id });

    // Verify user exists
    const check = await safeQuery(`SELECT id, full_name FROM users WHERE id = $1`, [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const result = await safeQuery(
      `
      UPDATE users
      SET remarks = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, full_name, email, role, job_title, remarks, is_active
      `,
      [remarks !== undefined ? remarks : '', id]
    );

    console.log('? Remarks saved for user:', id);

    return res.status(200).json({
      success: true,
      message: "Remarks updated successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("? Update user remarks error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update remarks.",
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  getUserStats,
  updateUserRemarks,
};
