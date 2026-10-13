// Separate process (run with `npm run worker`, or as its own container/
// Docker service) that consumes the "notifications" queue. Kept apart from
// the API process so sending SMS/email never competes with request handling.
require("node:dns").setDefaultResultOrder("ipv4first");
require("dotenv").config();
const { Worker } = require("bullmq");
const cron = require("node-cron");
const redis = require("../lib/redis");
const prisma = require("../lib/prisma");
const { processNotificationJob } = require("./notificationProcessor");
const { enqueueNotification } = require("./queue");

const worker = new Worker("notifications", processNotificationJob, {
  connection: redis,
});

worker.on("completed", (job) =>
  console.log(`Notification job ${job.id} (${job.name}) completed`),
);
worker.on("failed", (job, err) =>
  console.error(`Notification job ${job?.id} failed:`, err.message),
);

// Daily at 9am: find tomorrow's bookings and enqueue reminders.
cron.schedule("0 9 * * *", async () => {
  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const bookings = await prisma.booking.findMany({
    where: {
      startTime: { gte: tomorrowStart, lte: tomorrowEnd },
      status: { notIn: ["cancelled"] },
    },
    select: { id: true },
  });

  for (const b of bookings) {
    await enqueueNotification("booking.reminder", { bookingId: b.id });
  }

  console.log(
    `Enqueued ${bookings.length} reminder notifications for tomorrow`,
  );
});

console.log("Notification worker started");
