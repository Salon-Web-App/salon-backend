// Public review submission (tied to a completed booking) and the approved
// reviews feed shown on the site.
const prisma = require("../lib/prisma");

async function create(req, res, next) {
  try {
    const { applicationId, rating, comment } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { applicationId },
    });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    if (booking.status !== "completed") {
      return res.status(400).json({
        error: "Reviews can only be left after the appointment is completed",
      });
    }

    const review = await prisma.review.create({
      data: { bookingId: booking.id, rating, comment, approved: false },
    });

    res.status(201).json({
      id: review.id,
      message: "Thanks! Your review will appear after moderation.",
    });
  } catch (err) {
    next(err);
  }
}
async function list(req, res, next) {
  try {
    const reviews = await prisma.review.findMany({
      where: { approved: true },
      include: {
        booking: {
          select: {
            customerName: true,
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Optional: map the response to flatten it so the frontend receives
    // customerName and serviceName directly on each review object if preferred
    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: new Date(review.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      customerName: review.booking?.customerName || "Anonymous",
      serviceName: review.booking?.service?.name || "General Service",
    }));

    res.json(formattedReviews);
    console.log(formattedReviews);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list };
