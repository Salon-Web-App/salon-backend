// Schedules are stored in Redis. upsertJobScheduler is idempotent, so every
// worker can call it on boot and each tick still produces exactly one job.
const { maintenanceQueue } = require("./queue");
const { tz } = require("../config");

const SCHEDULES = [
  {
    id: "mark-completed",
    pattern: process.env.MARK_COMPLETED_CRON || "*/30 * * * *",
    name: "bookings.markCompleted",
  },
  {
    id: "daily-reminders",
    pattern: process.env.REMINDERS_CRON || "0 9 * * *",
    name: "bookings.enqueueReminders",
  },
];

// Removing an entry from SCHEDULES doesn't stop it; add its id here.
const RETIRED = [];

async function registerSchedules() {
  for (const s of SCHEDULES) {
    await maintenanceQueue.upsertJobScheduler(
      s.id,
      { pattern: s.pattern, tz },
      {
        name: s.name,
        opts: { removeOnComplete: 50, removeOnFail: 200 },
      },
    );
  }
  for (const id of RETIRED) {
    await maintenanceQueue.removeJobScheduler(id);
  }
}

module.exports = { registerSchedules, SCHEDULES };
