const express = require("express");
const { query } = require("express-validator");
const router = express.Router();
const { listStaff, getAvailability, getStaffDetail } = require("../controllers/staff.controller");
const { validate } = require("../middlewares/validate.middleware");
const { publicReadLimiter } = require("../middlewares/rateLimit.middleware");

router.use(publicReadLimiter);

router.get("/", listStaff);
router.get(
  "/availability",
  [
    query("staffId").notEmpty(),
    query("date").matches(/^\d{4}-\d{2}-\d{2}$/),
    query().custom((q) => {
      if (Boolean(q.serviceId) === Boolean(q.packageId)) {
        throw new Error("Provide exactly one of serviceId or packageId");
      }
      return true;
    }),
  ],
  validate,
  getAvailability,
);
router.get("/:id", getStaffDetail);

module.exports = router;
