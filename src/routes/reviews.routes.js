const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const reviewsController = require("../controllers/reviews.controller");
const { validate } = require("../middlewares/validate.middleware");
const { reviewWriteLimiter, publicReadLimiter } = require("../middlewares/rateLimit.middleware");

router.post(
  "/",
  reviewWriteLimiter,
  [
    body("applicationId").trim().notEmpty(),
    body("rating").isInt({ min: 1, max: 5 }),
    body("comment").optional({ values: "falsy" }).isString().isLength({ max: 1000 }),
  ],
  validate,
  reviewsController.create,
);

router.get("/", publicReadLimiter, reviewsController.list);

module.exports = router;
