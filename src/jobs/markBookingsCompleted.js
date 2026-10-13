// Marks bookings whose end time has passed as completed and queues the
// "completed" notification. Run by the maintenance worker on a schedule.
// Safe to run concurrently: each booking is claimed with a conditional
// update, so only the run that actually flips the status sends the email.
const prisma = require("../lib/prisma");
const { enqueueNotification } = require("./queue");
const logger = require("../lib/logger");

const NOT_COMPLETABLE = ["completed", "cancelled"];

async function markBookingsCompleted() {
  const now = new Date();

  const due = await prisma.booking.findMany({
    where: {
      status: { notIn: NOT_COMPLETABLE },
      deletedAt: null,
      endTime: { lte: now },
    },
    select: { id: true, applicationId: true },
    orderBy: { endTime: "asc" },
  });

  let completed = 0;
  for (const booking of due) {
    try {
      // Claim: only succeeds if nobody else completed/cancelled it meanwhile.
      const { count } = await prisma.booking.updateMany({
        where: { id: booking.id, status: { notIn: NOT_COMPLETABLE } },
        data: { status: "completed" },
      });
      if (count === 0) continue;

      await enqueueNotification(
        "booking.completed",
        { bookingId: booking.id },
        { jobId: `booking.completed-${booking.id}` },
      );
      completed += 1;
    } catch (err) {
      logger.error(
        { err, applicationId: booking.applicationId },
        "failed to complete booking",
      );
    }
  }

  logger.info({ found: due.length, completed }, "markBookingsCompleted done");
  return { found: due.length, completed };
}

module.exports = markBookingsCompleted;
