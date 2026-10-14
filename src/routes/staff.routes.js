const express = require("express");
const router = express.Router();
const { listStaff, getAvailability, getStaffDetail } = require("../controllers/staff.controller");
const { publicReadLimiter } = require("../middlewares/rateLimit.middleware");

router.use(publicReadLimiter);

router.get("/", listStaff);
router.get("/availability", getAvailability);
router.get("/:id", getStaffDetail);

module.exports = router;
