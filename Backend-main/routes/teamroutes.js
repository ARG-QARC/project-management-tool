const express = require("express");

const {
    getTeams,
    getAvailableMembers,
    getTeamMembers,
    createTeam,
    assignMemberToTeam,
    removeMember,
} = require("../controllers/teamcontroller");

const {
    authenticate,
    requireRole,
} = require("../middleware/authMiddleware");

const router = express.Router();

const MANAGEMENT_ROLES = [
    "Project Manager",
    "Executive Manager",
    "System Administrator",
    "Task Manager",
];

router.get(
    "/",
    authenticate,
    getTeams
);

router.get(
    "/available-members",
    authenticate,
    getAvailableMembers
);

router.get(
    "/members",
    authenticate,
    getTeamMembers
);

router.post(
    "/",
    authenticate,
    requireRole(...MANAGEMENT_ROLES),
    createTeam
);

router.post(
    "/assign-member",
    authenticate,
    requireRole(...MANAGEMENT_ROLES),
    assignMemberToTeam
);

router.delete(
    "/:teamId/members/:userId",
    authenticate,
    requireRole(...MANAGEMENT_ROLES),
    removeMember
);

module.exports = router;