const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const bookingsController = require("../controllers/bookings.controller");
const { validate } = require("../middlewares/validate.middleware");
const { bookingWriteLimiter, publicReadLimiter } = require("../middlewares/rateLimit.middleware");

const exactlyOneOffering = body().custom((b) => {
  if (Boolean(b.serviceId) === Boolean(b.packageId)) {
    throw new Error("Provide exactly one of serviceId or packageId");
  }
  return true;
});

router.post(
  "/",
  bookingWriteLimiter,
  [
    body("customerName").trim().notEmpty(),
    body("customerPhone").trim().notEmpty(),
    body("customerEmail").isEmail(),
    body("serviceId").optional().isString(),
    body("packageId").optional().isString(),
    exactlyOneOffering,
    body("startTime").isISO8601(),
    body("notes").optional().isString().isLength({ max: 1000 }),
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
  [body("channel").optional().isIn(["sms", "email"]), body("contact").notEmpty()],
  validate,
  bookingsController.requestModifyOtp,
);

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
