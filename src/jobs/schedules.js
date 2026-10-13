// Registers recurring schedules in Redis. upsertJobScheduler is idempotent:
// every worker calls it at boot, Redis keeps exactly one scheduler per id,
// and exactly one job is created per tick regardless of worker count.
// Changing a pattern here and redeploying updates the existing scheduler.
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

// Ids of schedulers that used to exist — removed on boot so a deleted
// schedule doesn't keep firing from Redis forever.
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
