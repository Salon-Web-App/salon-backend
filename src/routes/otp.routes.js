const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const { sendOtp, verifyOtp } = require("../controllers/otp.controller");
const { validate } = require("../middlewares/validate.middleware");
const { otpSendLimiter, otpVerifyLimiter } = require("../middlewares/rateLimit.middleware");

router.post(
  "/send",
  otpSendLimiter,
  [
    body("contact").notEmpty(),
    body("channel").isIn(["sms", "email"]),
    body("purpose").isIn(["booking_create", "booking_modify"]),
  ],
  validate,
  sendOtp,
);

router.post(
  "/verify",
  otpVerifyLimiter,
  [
    body("contact").notEmpty(),
    body("otp").isLength({ min: 6, max: 6 }),
    body("purpose").isIn(["booking_create", "booking_modify"]),
  ],
  validate,
  verifyOtp,
);

module.exports = router;
