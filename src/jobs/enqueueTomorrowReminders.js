// Queues a reminder for every active booking that starts "tomorrow" in the
// business timezone. Relies on the process TZ (set TZ=Asia/Kathmandu on the
// worker) so setHours/setDate operate in local business time.
const prisma = require("../lib/prisma");
const { enqueueNotification } = require("./queue");
const logger = require("../lib/logger");

async function enqueueTomorrowReminders() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1); // next midnight, used with lt (no 23:59:59.999 edge)

  const bookings = await prisma.booking.findMany({
    where: {
      startTime: { gte: start, lt: end },
      status: { notIn: ["cancelled", "completed"] },
      deletedAt: null,
    },
    select: { id: true },
  });

  // jobId includes the date so a booking rescheduled to another day still
  // gets its new reminder, but the same day can never be reminded twice.
  const day = start.toISOString().slice(0, 10);
  for (const b of bookings) {
    await enqueueNotification(
      "booking.reminder",
      { bookingId: b.id },
      { jobId: `booking.reminder-${b.id}-${day}` },
    );
  }

  logger.info({ count: bookings.length, day }, "reminders enqueued");
  return { count: bookings.length };
}

module.exports = enqueueTomorrowReminders;
