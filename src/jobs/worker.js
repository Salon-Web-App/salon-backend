// Worker process: consumes the notifications and maintenance queues and
// registers recurring schedules. Same image as the API, started with
// `node src/jobs/worker.js`. Safe to run any number of replicas.
require("../config");
require("node:dns").setDefaultResultOrder("ipv4first");
const { Worker } = require("bullmq");
const redis = require("../lib/redis");
const prisma = require("../lib/prisma");
const logger = require("../lib/logger");
const { notificationsQueue, maintenanceQueue } = require("./queue");
const { processNotificationJob } = require("./notificationProcessor");
const { processMaintenanceJob } = require("./maintenanceProcessor");
const { registerSchedules } = require("./schedules");

function attachLogging(worker, label) {
  worker.on("completed", (job, result) =>
    logger.info(
      { queue: label, jobId: job.id, name: job.name, result },
      "job completed",
    ),
  );
  worker.on("failed", (job, err) =>
    logger.error(
      { queue: label, jobId: job?.id, name: job?.name, err },
      "job failed",
    ),
  );
  worker.on("error", (err) =>
    logger.error({ queue: label, err }, "worker error"),
  );
}

async function main() {
  await registerSchedules();

  const notificationsWorker = new Worker(
    "notifications",
    processNotificationJob,
    {
      connection: redis,
      concurrency: 5,
    },
  );
  const maintenanceWorker = new Worker("maintenance", processMaintenanceJob, {
    connection: redis,
    concurrency: 1,
  });
  attachLogging(notificationsWorker, "notifications");
  attachLogging(maintenanceWorker, "maintenance");

  logger.info({ tz: process.env.TZ }, "worker started");

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "worker shutting down");
    setTimeout(() => process.exit(1), 25_000).unref();
    try {
      // close() stops taking new jobs and waits for in-flight ones to finish
      await Promise.all([
        notificationsWorker.close(),
        maintenanceWorker.close(),
      ]);
      await Promise.all([notificationsQueue.close(), maintenanceQueue.close()]);
      await prisma.$disconnect();
      await redis.quit();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "error during shutdown");
      process.exit(1);
    }
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, "worker failed to start");
  process.exit(1);
});
