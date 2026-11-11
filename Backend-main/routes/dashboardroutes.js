const express = require("express");

const router = express.Router();

const {
  getDashboardTeamOverview,
  getDashboardProjectStats,
  getDashboardTaskStats,
  getCompleteDashboard,
  getManagerDashboard,
  getMemberDashboard,
  getRoleDashboard,
} = require("../controllers/dashboardcontroller");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

/*
|--------------------------------------------------------------------------
| DASHBOARD ROUTES
|--------------------------------------------------------------------------
*/

// Role-aware dashboard (Manager or Member auto-detected)
router.get("/stats", authenticate, getRoleDashboard);

// Explicit Manager Dashboard
router.get(
  "/manager",
  authenticate,
  requireRole("Project Manager", "Executive Manager", "System Administrator", "Task Manager"),
  getManagerDashboard
);

// Explicit Member Dashboard
router.get("/member", authenticate, getMemberDashboard);

// Team Overview (legacy/widget)
router.get("/team-overview", authenticate, getDashboardTeamOverview);

// Project Stats
router.get("/project-stats", authenticate, getDashboardProjectStats);

// Task Stats
router.get("/task-stats", authenticate, getDashboardTaskStats);

// Complete organization dashboard summary
router.get("/summary", authenticate, getCompleteDashboard);

module.exports = router;
