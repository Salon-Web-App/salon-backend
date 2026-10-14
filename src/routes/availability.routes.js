const express = require("express");
const { query } = require("express-validator");
const router = express.Router();
const bookingsController = require("../controllers/bookings.controller");
const { validate } = require("../middlewares/validate.middleware");
const { publicReadLimiter } = require("../middlewares/rateLimit.middleware");

const exactlyOneOffering = query().custom((q) => {
  if (Boolean(q.serviceId) === Boolean(q.packageId)) {
    throw new Error("Provide exactly one of serviceId or packageId");
  }
  return true;
});

router.get(
  "/",
  publicReadLimiter,
  [query("date").matches(/^\d{4}-\d{2}-\d{2}$/), exactlyOneOffering],
  validate,
  bookingsController.getAvailability,
);

module.exports = router;
