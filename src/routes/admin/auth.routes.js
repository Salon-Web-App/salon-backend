const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const { login } = require("../../controllers/admin/auth.controller");
const { validate } = require("../../middlewares/validate.middleware");
const { loginLimiter } = require("../../middlewares/rateLimit.middleware");

router.post(
  "/login",
  loginLimiter,
  [body("email").isEmail(), body("password").notEmpty()],
  validate,
  login,
);

module.exports = router;
