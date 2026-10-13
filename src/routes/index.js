// Mounts all public (customer-facing) route modules under their base
// paths. Imported once by app.js.
const express = require("express");
const router = express.Router();

router.use("/services", require("./services.routes"));
router.use("/staff", require("./staff.routes"));
router.use("/otp", require("./otp.routes"));
router.use("/bookings", require("./bookings.routes"));
router.use("/reviews", require("./reviews.routes"));
router.use("/admin", require("./admin/index"));
router.use("/availability", require("./availability.routes"));
router.use("/transformations", require("./transformation.routes"));
router.use("/packages", require("./packages.routes"));
module.exports = router;
