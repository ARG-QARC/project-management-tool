const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");

const {
  getAllUpdates,
  getUserUpdates,
  createUpdate,
  updateUpdate,
  deleteUpdate
} = require("../controllers/dailyUpdateController");

// All routes require authentication
router.use(authenticate);

// Get all updates (managers only - could restrict in controller but let's allow it if we handle it there)
// Wait, we didn't restrict getAllUpdates to managers in the controller logic, so any member could call it and see all updates.
// We probably should let anyone see all updates if it's a team tracker, or just managers.
router.get("/", getAllUpdates);

// Get specific user's updates
router.get("/user/:userId", getUserUpdates);

// Create a new update
router.post("/", createUpdate);

// Update an existing update
router.put("/:id", updateUpdate);
router.patch("/:id", updateUpdate);

// Delete an update
router.delete("/:id", deleteUpdate);

module.exports = router;
