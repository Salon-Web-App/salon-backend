const cron = require("node-cron");
const prisma = require("../lib/prisma");
const { enqueueNotification } = require("../jobs/queue");

async function markBookingsCompleted() {
  try {
    const now = new Date();

    // Find bookings whose end time has passed
    const bookings = await prisma.booking.findMany({
      where: {
        status: { notIn: ["completed", "cancelled"] },
        deletedAt: null,
        endTime: { lte: now },
      },
      orderBy: { endTime: "asc" },
    });

    if (bookings.length === 0) {
      console.log(
        `[Booking Completion Job] ${now.toISOString()} - No bookings to complete`,
      );
      return;
    }

    console.log(
      `[Booking Completion Job] Found ${bookings.length} booking(s) to complete`,
    );

    // Process each booking ONE BY ONE
    for (const booking of bookings) {
      try {
        // Mark this booking as completed
        const completedBooking = await prisma.booking.update({
          where: {
            id: booking.id,
          },
          data: {
            status: "completed",
          },
        });

        console.log(
          `[Booking Completion Job] Booking ${completedBooking.applicationId} marked as completed`,
        );

        // Send email AFTER successfully completing the booking

        await enqueueNotification("booking.completed", {
          bookingId: booking.id,
        });
      } catch (error) {
        // If one booking fails, continue processing the others
        console.error(
          `[Booking Completion Job] Failed to process booking ${booking.applicationId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("[Booking Completion Job] Error:", error);
  }
}

module.exports = markBookingsCompleted;
