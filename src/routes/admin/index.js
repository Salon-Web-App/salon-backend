// Mounts all /admin/* sub-routers. Note auth.routes is mounted first and
// is the only one NOT behind requireAdmin (you need to log in before you
// have a token) — every other admin router applies requireAdmin itself.
const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth.routes"));
router.use("/staff", require("./staff.routes"));
router.use("/services", require("./services.routes"));
router.use("/bookings", require("./bookings.routes"));
router.use("/reviews", require("./reviews.routes"));

module.exports = router;
