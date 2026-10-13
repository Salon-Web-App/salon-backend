const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const bookingsController = require("../controllers/bookings.controller");
const { validate } = require("../middlewares/validate.middleware");
const {
  bookingWriteLimiter,
  publicReadLimiter,
} = require("../middlewares/rateLimit.middleware");

router.post(
  "/",
  bookingWriteLimiter,
  [
    body("customerName").notEmpty(),
    body("customerPhone").notEmpty(),
    body("customerEmail").isEmail(),
    body("serviceId").notEmpty(),
    body("startTime").isISO8601(),
    body("verificationToken").notEmpty(),
    body("verifiedContact").notEmpty(),
  ],
  validate,
  bookingsController.create,
);

router.get("/:applicationId", publicReadLimiter, bookingsController.getStatus);

router.post(
  "/:applicationId/request-otp",
  bookingWriteLimiter,
  [
    body("channel").optional().isIn(["sms", "email"]),
    body("contact").notEmpty(),
  ],
  validate,
  bookingsController.requestModifyOtp,
);

// router.post(
//   "/:applicationId/verify-contact",
//   bookingWriteLimiter,
//   [body("channel").isIn(["sms", "email"]), body("contact").notEmpty()],
//   validate,
//   bookingsController.validateContact,
// );

router.patch(
  "/:applicationId",
  bookingWriteLimiter,
  [
    body("verificationToken").notEmpty(),
    body("verifiedContact").notEmpty(),
    body("startTime").optional().isISO8601(),
    body("serviceId").optional().notEmpty(),
  ],
  validate,
  bookingsController.modify,
);

router.delete(
  "/:applicationId",
  bookingWriteLimiter,
  [body("verificationToken").notEmpty(), body("verifiedContact").notEmpty()],
  validate,
  bookingsController.cancel,
);

module.exports = router;
