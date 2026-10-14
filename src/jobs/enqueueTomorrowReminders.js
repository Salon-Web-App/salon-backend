// Relies on the process TZ being the business timezone.
const prisma = require("../lib/prisma");
const { enqueueNotification } = require("./queue");
const logger = require("../lib/logger");

async function enqueueTomorrowReminders() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const bookings = await prisma.booking.findMany({
    where: {
      startTime: { gte: start, lt: end },
      status: { notIn: ["cancelled", "completed"] },
      deletedAt: null,
    },
    select: { id: true },
  });

  // Date in the id: a booking moved to another day still gets a reminder,
  // but never two for the same day.
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
