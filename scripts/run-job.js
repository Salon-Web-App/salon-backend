// Usage: npm run job -- bookings.markCompleted
require("../src/config");
const { maintenanceQueue } = require("../src/jobs/queue");
const { handlers } = require("../src/jobs/maintenanceProcessor");
const redis = require("../src/lib/redis");

(async () => {
  const name = process.argv[2];
  if (!handlers[name]) {
    console.error(`Unknown job. Choose one of: ${Object.keys(handlers).join(", ")}`);
    process.exit(1);
  }
  const job = await maintenanceQueue.add(name, {}, { removeOnComplete: true });
  console.log(`Enqueued ${name} as job ${job.id}`);
  await maintenanceQueue.close();
  await redis.quit();
})();
