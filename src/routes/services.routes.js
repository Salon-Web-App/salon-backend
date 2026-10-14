const express = require("express");
const router = express.Router();
const { listServices, getServiceDetail } = require("../controllers/services.controller");
const { publicReadLimiter } = require("../middlewares/rateLimit.middleware");

router.use(publicReadLimiter);

router.get("/", listServices);
router.get("/:id", getServiceDetail);

module.exports = router;
