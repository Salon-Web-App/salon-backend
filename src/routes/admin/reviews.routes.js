const express = require("express");
const router = express.Router();
const reviewsController = require("../../controllers/admin/reviews.controller");
const { requireAdmin } = require("../../middlewares/auth.middleware");
const { adminWriteLimiter } = require("../../middlewares/rateLimit.middleware");

router.use(requireAdmin);
router.use(adminWriteLimiter);

router.get("/", reviewsController.list);
router.patch("/:id/approve", reviewsController.setApproved);

module.exports = router;
