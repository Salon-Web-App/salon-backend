const prisma = require("../lib/prisma");
const { toPublicReview, PUBLIC_REVIEW_INCLUDE } = require("../utils/publicReview");

const ALREADY_REVIEWED = { error: "A review has already been submitted for this booking." };

async function create(req, res, next) {
  try {
    const { applicationId, rating, comment } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { applicationId },
      include: { review: { select: { id: true } } },
    });
    if (!booking || booking.deletedAt) {
      return res.status(404).json({ error: "Booking not found" });
    }
    if (booking.status !== "completed") {
      return res.status(400).json({
        error: "Reviews can only be left after the appointment is completed",
      });
    }
    if (booking.review) return res.status(409).json(ALREADY_REVIEWED);

    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        rating: Number(rating),
        comment: comment || null,
        approved: false,
      },
    });

    res.status(201).json({
      id: review.id,
      message: "Thanks! Your review will appear after moderation.",
    });
  } catch (err) {
    // Two submissions racing past the check above.
    if (err.code === "P2002") return res.status(409).json(ALREADY_REVIEWED);
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const reviews = await prisma.review.findMany({
      where: { approved: true },
      include: PUBLIC_REVIEW_INCLUDE,
      // `order` is set by the admin reorder action.
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    res.json(reviews.map(toPublicReview));
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list };
