// Defines the single "notifications" queue and a small helper the rest of
// the app uses to enqueue jobs, so nothing else has to know BullMQ's API.
const { Queue } = require('bullmq');
const redis = require('../lib/redis');

const notificationsQueue = new Queue('notifications', { connection: redis });

async function enqueueNotification(type, payload) {
  return notificationsQueue.add(type, payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

module.exports = { notificationsQueue, enqueueNotification };
