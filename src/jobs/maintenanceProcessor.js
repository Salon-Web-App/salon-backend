const markBookingsCompleted = require("./markBookingsCompleted");
const enqueueTomorrowReminders = require("./enqueueTomorrowReminders");

const handlers = {
  "bookings.markCompleted": markBookingsCompleted,
  "bookings.enqueueReminders": enqueueTomorrowReminders,
};

async function processMaintenanceJob(job) {
  const handler = handlers[job.name];
  if (!handler) throw new Error(`Unknown maintenance job: ${job.name}`);
  return handler(job.data);
}

module.exports = { processMaintenanceJob, handlers };
