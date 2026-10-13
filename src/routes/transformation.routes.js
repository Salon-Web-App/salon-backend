const express = require("express");
const router = express.Router();
const { list } = require("../controllers/transformation.controller");
const { publicReadLimiter } = require("../middlewares/rateLimit.middleware");

router.get("/", publicReadLimiter, list);

module.exports = router;
