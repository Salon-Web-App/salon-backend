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

// Pass opts.jobId for notifications that must be sent at most once: BullMQ
// ignores an add() whose jobId already exists. Don't use it for actions that
// can legitimately repeat, like a reschedule.
async function enqueueNotification(type, payload, opts = {}) {
  return notificationsQueue.add(type, payload, {
    ...DEFAULT_NOTIFICATION_OPTS,
    ...opts,
  });
}

module.exports = { notificationsQueue, maintenanceQueue, enqueueNotification };
