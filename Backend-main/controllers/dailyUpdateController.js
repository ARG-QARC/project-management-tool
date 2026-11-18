const pool = require("../config/db");

const isManagementRole = (role) => [
  "Project Manager",
  "Executive Manager",
  "System Administrator",
  "Task Manager"
].includes(role);

// Get all daily updates (Managers)
const getAllUpdates = async (req, res) => {
  try {
    const { date, user_id } = req.query;
    let query = `
      SELECT du.*, u.full_name as user_name, u.email as user_email
      FROM daily_updates du
      JOIN users u ON du.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (date) {
      params.push(date);
      query += ` AND du.date = $${params.length}`;
    }
    
    if (user_id) {
      params.push(user_id);
      query += ` AND du.user_id = $${params.length}`;
    }

    query += ` ORDER BY du.date DESC, du.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching daily updates:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

// Get updates for a specific user
const getUserUpdates = async (req, res) => {
  try {
    const userId = req.params.userId;
    // Users can only view their own updates, managers can view any.
    if (!isManagementRole(req.user.role) && req.user.id !== userId) {
      return res.status(403).json({ error: "Unauthorized to view these updates" });
    }

    const query = `
      SELECT du.*, u.full_name as user_name
      FROM daily_updates du
      JOIN users u ON du.user_id = u.id
      WHERE du.user_id = $1
      ORDER BY du.date DESC, du.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching user daily updates:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

// Create a new daily update
const createUpdate = async (req, res) => {
  try {
    const { date, content } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const updateDate = date || new Date().toISOString().split('T')[0];

    const query = `
      INSERT INTO daily_updates (user_id, date, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const params = [userId, updateDate, content];

    const result = await pool.query(query, params);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating daily update:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

// Update an existing daily update
const updateUpdate = async (req, res) => {
  try {
    const updateId = req.params.id;
    const { content, kpi_score, clientDate } = req.body;

    // Check ownership
    const checkQuery = `SELECT * FROM daily_updates WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [updateId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Update not found" });
    }

    const updateRecord = checkResult.rows[0];

    // Only owner can update content, managers can update KPI
    if (!isManagementRole(req.user.role) && req.user.id !== updateRecord.user_id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Enforce same-day restriction when editing content
    if (content !== undefined) {
      const recordDateStr = updateRecord.date instanceof Date
        ? updateRecord.date.toISOString().split("T")[0]
        : String(updateRecord.date || "").split("T")[0];

      const now = new Date();
      const utcToday = now.toISOString().split("T")[0];
      const pktToday = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().split("T")[0];
      const allowedDates = new Set([utcToday, pktToday]);
      if (clientDate && typeof clientDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
        // Only trust clientDate if within +/- 14 hours of server UTC
        const diffHours = Math.abs(now.getTime() - new Date(`${clientDate}T12:00:00Z`).getTime()) / 3600000;
        if (diffHours <= 26) allowedDates.add(clientDate);
      }

      if (!allowedDates.has(recordDateStr)) {
        return res.status(403).json({
          error: "Daily updates can only be edited on the same day they were posted. Editing is locked on the next day."
        });
      }
    }

    const newContent = content !== undefined ? content : updateRecord.content;
    const newKpi = kpi_score !== undefined ? kpi_score : updateRecord.kpi_score;
    const isContentEdited = content !== undefined && content.trim() !== String(updateRecord.content || "").trim();

    await pool.query(`ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE`).catch(() => {});

    const query = `
      UPDATE daily_updates
      SET
        content = $1,
        kpi_score = $2,
        updated_at = NOW(),
        edited_at = CASE WHEN $4 = TRUE THEN NOW() ELSE COALESCE(edited_at, NOW()) END
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [newContent, newKpi, updateId, isContentEdited]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating daily update:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

// Delete a daily update
const deleteUpdate = async (req, res) => {
  try {
    const updateId = req.params.id;

    // Check ownership
    const checkQuery = `SELECT * FROM daily_updates WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [updateId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Update not found" });
    }

    if (!isManagementRole(req.user.role) && req.user.id !== checkResult.rows[0].user_id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await pool.query(`DELETE FROM daily_updates WHERE id = $1`, [updateId]);
    res.json({ message: "Daily update deleted successfully" });
  } catch (error) {
    console.error("Error deleting daily update:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

module.exports = {
  getAllUpdates,
  getUserUpdates,
  createUpdate,
  updateUpdate,
  deleteUpdate
};
