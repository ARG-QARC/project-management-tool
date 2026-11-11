const pool = require("../config/db");

const MANAGEMENT_ROLES = [
    "Project Manager",
    "Executive Manager",
    "System Administrator",
    "Task Manager",
];

/*
|--------------------------------------------------------------------------
| GET ALL TEAMS
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| GET TEAMS
|--------------------------------------------------------------------------
|
| Management roles:
|   - See all teams
|
| Member:
|   - See only the team they belong to
|
|--------------------------------------------------------------------------
*/

async function getTeams(req, res) {
    try {
        const currentUserId = req.user.id;
        const currentUserRole = req.user.role;

        // --------------------------------------------------
        // MANAGEMENT
        // Keep existing behavior:
        // Project Manager
        // Executive Manager
        // System Administrator
        // can see ALL teams
        // --------------------------------------------------

        if (MANAGEMENT_ROLES.includes(currentUserRole)) {
            const result = await pool.query(`
                SELECT 
                    t.id, 
                    t.name, 
                    t.description, 
                    t.created_by, 
                    t.created_at, 
                    COUNT(tm.user_id)::int AS member_count
                FROM teams t
                LEFT JOIN team_members tm 
                    ON tm.team_id = t.id
                GROUP BY t.id
                ORDER BY t.created_at DESC
            `);

            return res.json(result.rows);
        }

        // --------------------------------------------------
        // MEMBER
        // Show ONLY the team this user belongs to
        // --------------------------------------------------

        if (currentUserRole === "Member") {
            const result = await pool.query(`
                SELECT 
                    t.id, 
                    t.name, 
                    t.description, 
                    t.created_by, 
                    t.created_at, 
                    COUNT(tm_all.user_id)::int AS member_count
                FROM teams t
                INNER JOIN team_members tm_user
                    ON tm_user.team_id = t.id
                LEFT JOIN team_members tm_all
                    ON tm_all.team_id = t.id
                WHERE tm_user.user_id = $1
                GROUP BY t.id
                ORDER BY t.created_at DESC
            `, [currentUserId]);

            return res.json(result.rows);
        }

        // --------------------------------------------------
        // OTHER ROLES
        // Preserve safe existing behavior
        // --------------------------------------------------

        return res.json([]);

    } catch (error) {
        console.error("GET TEAMS ERROR:", error);

        return res.status(500).json({
            message: "Failed to load teams",
        });
    }
}
/*
|--------------------------------------------------------------------------
| GET MEMBERS NOT IN TEAM
|--------------------------------------------------------------------------
*/

async function getAvailableMembers(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                u.id,
                u.email,
                u.full_name,
                u.role,
                u.is_active
            FROM users u
            LEFT JOIN team_members tm
                ON tm.user_id = u.id
            WHERE
                u.is_active = TRUE
                AND tm.user_id IS NULL
                AND u.role <> 'Executive Manager'
                AND u.role <> 'System Administrator'
            ORDER BY u.full_name
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to load available members",
        });
    }
}

/*
|--------------------------------------------------------------------------
| GET MEMBERS WITH TEAM
|--------------------------------------------------------------------------
*/

async function getTeamMembers(req, res) {
    try {
        const result = await pool.query(`
            SELECT DISTINCT ON (u.id)
                u.id,
                u.email,
                u.full_name,
                u.role,
                COALESCE(t.id, '') AS team_id,
                COALESCE(t.name, 'General Team') AS team_name
            FROM users u
            LEFT JOIN team_members tm
                ON tm.user_id = u.id
            LEFT JOIN teams t
                ON t.id = tm.team_id
            WHERE u.is_active = TRUE
            ORDER BY u.id, u.full_name
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to load team members",
        });
    }
}

/*
|--------------------------------------------------------------------------
| CREATE TEAM
|--------------------------------------------------------------------------
*/

async function createTeam(req, res) {
    if (!MANAGEMENT_ROLES.includes(req.user.role)) {
        return res.status(403).json({
            message: "Only management can create teams",
        });
    }

    const {
        name,
        description,
    } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            message: "Team name is required",
        });
    }

    try {
        const result = await pool.query(
            `
            INSERT INTO teams (
                name,
                description,
                created_by
            )
            VALUES ($1, $2, $3)
            RETURNING *
            `,
            [
                name.trim(),
                description?.trim() || null,
                req.user.id,
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create team",
        });
    }
}

/*
|--------------------------------------------------------------------------
| ASSIGN MEMBER TO TEAM
|--------------------------------------------------------------------------
*/

const assignMemberToTeam = async (req, res) => {
    try {
        const { teamId, userId } = req.body;

        const currentUserId = req.user.id;
        const currentUserRole = req.user.role;

        console.log("========== ASSIGN MEMBER TO TEAM ==========");
        console.log("teamId:", teamId);
        console.log("userId:", userId);
        console.log("currentUserId:", currentUserId);
        console.log("currentUserRole:", currentUserRole);

        // --------------------------------------------------
        // Validate request
        // --------------------------------------------------

        if (!teamId) {
            return res.status(400).json({
                success: false,
                message: "Team ID is required.",
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required.",
            });
        }

        // --------------------------------------------------
        // Verify team
        // --------------------------------------------------

        const teamResult = await pool.query(
            `
      SELECT
        id,
        name
      FROM teams
      WHERE id = $1
      `,
            [teamId]
        );

        if (teamResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Team not found.",
            });
        }

        const team = teamResult.rows[0];

        // --------------------------------------------------
        // Verify user
        // --------------------------------------------------

        const userResult = await pool.query(
            `
      SELECT
        id,
        full_name,
        email,
        role,
        is_active
      FROM users
      WHERE id = $1
      `,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        const member = userResult.rows[0];

        if (!member.is_active) {
            return res.status(400).json({
                success: false,
                message: "This user is inactive.",
            });
        }

        // --------------------------------------------------
        // Check whether user is already in a team
        // --------------------------------------------------

        const existingTeamResult = await pool.query(
            `
      SELECT
        tm.team_id,
        t.name AS team_name
      FROM team_members tm
      INNER JOIN teams t
        ON t.id = tm.team_id
      WHERE tm.user_id = $1
      LIMIT 1
      `,
            [userId]
        );

        if (existingTeamResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: `${member.full_name} already belongs to ${existingTeamResult.rows[0].team_name}.`,
            });
        }

        // --------------------------------------------------
        // Insert member into team
        // --------------------------------------------------

        const insertResult = await pool.query(
            `
      INSERT INTO team_members (
        team_id,
        user_id
      )
      VALUES ($1, $2)
      RETURNING
        team_id,
        user_id
      `,
            [teamId, userId]
        );

        // --------------------------------------------------
        // Return complete member
        // --------------------------------------------------

        return res.status(201).json({
            success: true,
            message: `${member.full_name} assigned to ${team.name} successfully.`,
            member: {
                id: member.id,
                full_name: member.full_name,
                email: member.email,
                role: member.role,
                team_id: team.id,
                team_name: team.name,
            },
            assignment: insertResult.rows[0],
        });

    } catch (error) {
        console.error("=================================");
        console.error("ASSIGN MEMBER TO TEAM ERROR");
        console.error("=================================");
        console.error(error);

        // PostgreSQL duplicate-key error
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "This member is already assigned to this team.",
            });
        }

        // Foreign-key error
        if (error.code === "23503") {
            return res.status(400).json({
                success: false,
                message: "Invalid team or user ID.",
                detail: error.detail,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to assign member.",
            error: error.message,
        });
    }
};

/*
|--------------------------------------------------------------------------
| REMOVE MEMBER
|--------------------------------------------------------------------------
*/

async function removeMember(req, res) {
    if (!MANAGEMENT_ROLES.includes(req.user.role)) {
        return res.status(403).json({
            message: "Only management can remove members",
        });
    }

    const {
        teamId,
        userId,
    } = req.params;

    try {
        const result = await pool.query(
            `
            DELETE FROM team_members
            WHERE team_id = $1
              AND user_id = $2
            RETURNING *
            `,
            [
                teamId,
                userId,
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: "Team membership not found",
            });
        }

        res.json({
            message: "Member removed from team",
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to remove member",
        });
    }
}

module.exports = {
    getTeams,
    getAvailableMembers,
    getTeamMembers,
    createTeam,
    assignMemberToTeam,
    removeMember,
};
