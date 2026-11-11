const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/authMiddleware");
const requireSystemAdministrator = require("../middleware/adminMiddleware");

const {
  getProjectTasks,
  getTask,
  getTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  assignTask,
  getMyTasks,
  getMyProjects
} = require("../controllers/taskcontroller");

// =========================================================
// 1. SPECIFIC / NAMED ROUTES (must come first)
// =========================================================

// Get all tasks (with filters)
router.get("/", authenticate, getTasks);

// Get current user's assigned tasks
router.get("/my/tasks", authenticate, getMyTasks);

// Get current user's projects (with assigned tasks)
router.get("/my/projects", authenticate, getMyProjects);

// Get all tasks for a project
router.get("/project/:projectId", authenticate, getProjectTasks);
// =========================================================
// 3. TASK-SCOPED ROUTES
// =========================================================

// Create task (general / standalone or with body projectId)
router.post("/", authenticate, createTask);

// Create task in project
router.post("/project/:projectId", authenticate, createTask);

// Assign / reassign task
router.patch("/:taskId/assign", authenticate, assignTask);

// Update task status
router.patch("/:taskId/status", authenticate, updateTaskStatus);

// Update full task details
router.patch("/:taskId", authenticate, updateTask);

// Delete task
router.delete(
  "/:taskId",
  authenticate,
  requireRole("System Administrator", "Executive Manager", "Project Manager", "Task Manager"),
  deleteTask
);

// Get single task details (KEEP LAST among GETs)
router.get("/:taskId", authenticate, getTask);

module.exports = router;
