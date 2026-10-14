const express = require("express");
const router = express.Router();
const bookingsController = require("../../controllers/admin/bookings.controller");
const { requireAdmin } = require("../../middlewares/auth.middleware");
const { adminWriteLimiter } = require("../../middlewares/rateLimit.middleware");

router.use(requireAdmin);
router.use(adminWriteLimiter);

router.get("/", bookingsController.list);
router.patch("/:id/assign-staff", bookingsController.assignStaff);
router.patch("/:id/status", bookingsController.changeStatus);
router.patch("/:id/reschedule", bookingsController.reschedule);

module.exports = router;
