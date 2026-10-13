// Queue definitions. The API and the worker both import this; only the
// worker consumes. Producers never schedule — schedules live in Redis
// (see schedules.js).
const { Queue } = require("bullmq");
const redis = require("../lib/redis");

const notificationsQueue = new Queue("notifications", { connection: redis });
const maintenanceQueue = new Queue("maintenance", { connection: redis });

const DEFAULT_NOTIFICATION_OPTS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

// opts.jobId makes the enqueue idempotent: BullMQ ignores an add() whose
// jobId already exists in the queue. Only pass it for notifications that
// must happen at most once (scheduled ones). Never for admin actions like
// reschedule, which can legitimately happen several times per booking.
async function enqueueNotification(type, payload, opts = {}) {
  return notificationsQueue.add(type, payload, {
    ...DEFAULT_NOTIFICATION_OPTS,
    ...opts,
  });
}

module.exports = { notificationsQueue, maintenanceQueue, enqueueNotification };