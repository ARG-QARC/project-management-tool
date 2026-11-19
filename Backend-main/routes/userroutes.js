const express = require("express");

const router = express.Router();

const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  updateUserRemarks,
  deleteUser,
} = require("../controllers/usercontroller");

// IMPORTANT: authenticate is a named export
const { authenticate } = require("../middleware/authMiddleware");

// adminMiddleware exports the function directly
const requireSystemAdministrator = require("../middleware/adminMiddleware");

/* =========================================================
   USER MANAGEMENT & PROFILES
========================================================= */

router.get(
  "/",
  authenticate,
  getUsers
);

router.get(
  "/:id",
  authenticate,
  getUserById
);

router.post(
  "/",
  authenticate,
  requireSystemAdministrator,
  createUser
);

router.patch(
  "/:id/remarks",
  authenticate,
  updateUserRemarks
);

router.patch(
  "/:id/status",
  authenticate,
  requireSystemAdministrator,
  updateUserStatus
);

router.patch(
  "/:id",
  authenticate,
  requireSystemAdministrator,
  updateUser
);

router.delete(
  "/:id",
  authenticate,
  requireSystemAdministrator,
  deleteUser
);

module.exports = router;
