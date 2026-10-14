const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const bookingsController = require("../../controllers/admin/bookings.controller");
const { requireAdmin } = require("../../middlewares/auth.middleware");
const { validate } = require("../../middlewares/validate.middleware");
const { adminWriteLimiter } = require("../../middlewares/rateLimit.middleware");

router.use(requireAdmin);
router.use(adminWriteLimiter);

router.get("/", bookingsController.list);
router.patch(
  "/:id/assign-staff",
  [body("staffId").isString().notEmpty()],
  validate,
  bookingsController.assignStaff,
);
router.patch(
  "/:id/status",
  [body("status").isIn(bookingsController.ADMIN_STATUSES)],
  validate,
  bookingsController.changeStatus,
);
router.patch(
  "/:id/reschedule",
  [body("startTime").isISO8601()],
  validate,
  bookingsController.reschedule,
);

module.exports = router;
