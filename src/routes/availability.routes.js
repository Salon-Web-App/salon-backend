// src/routes/availability.routes.js (or inside your existing routes)
const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookings.controller"); // or wherever your getAvailability controller lives
const { publicReadLimiter } = require("../middlewares/rateLimit.middleware");

router.get("/", publicReadLimiter, bookingController.getAvailability);

module.exports = router;
