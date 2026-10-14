// Free slots for a service or package on a date, across all qualified staff.
// Times are built in the process timezone, so TZ must be the business
// timezone.
const prisma = require("../lib/prisma");
const { resolveOffering, qualifiedStaffWhere } = require("./catalog.service");

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const SLOT_STEP_MINUTES = 30;

function toDate(dateStr, hhmm) {
  return new Date(`${dateStr}T${hhmm}:00`);
}

function parseWorkingHours(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function getAvailableSlots({ serviceId, packageId, staffId, date }) {
  const offering = await resolveOffering({ serviceId, packageId });

  const staffList = await prisma.staff.findMany({
    where: { ...qualifiedStaffWhere(offering), ...(staffId && { id: staffId }) },
  });
  if (staffList.length === 0) return [];

  const dayStart = toDate(date, "00:00");
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const weekday = WEEKDAYS[dayStart.getDay()];

  const existingBookings = await prisma.booking.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["cancelled"] },
      staffId: { in: staffList.map((s) => s.id) },
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
    },
    select: { staffId: true, startTime: true, endTime: true },
  });

  const durationMs = offering.durationMinutes * 60 * 1000;
  const now = new Date();
  const slots = new Map();

  for (const staff of staffList) {
    const ranges = parseWorkingHours(staff.workingHours)?.[weekday] || [];
    const staffBookings = existingBookings.filter((b) => b.staffId === staff.id);

    for (const range of ranges) {
      const [start, end] = range.split("-");
      const rangeEnd = toDate(date, end);
      let cursor = toDate(date, start);

      while (cursor.getTime() + durationMs <= rangeEnd.getTime()) {
        const slotStart = cursor;
        const slotEnd = new Date(cursor.getTime() + durationMs);
        const key = slotStart.toISOString();

        if (slotStart > now && !slots.has(key)) {
          const overlaps = staffBookings.some(
            (b) => slotStart < b.endTime && slotEnd > b.startTime,
          );
          if (!overlaps) {
            slots.set(key, {
              startTime: key,
              endTime: slotEnd.toISOString(),
              staffId: staff.id,
            });
          }
        }

        cursor = new Date(cursor.getTime() + SLOT_STEP_MINUTES * 60 * 1000);
      }
    }
  }

  return Array.from(slots.values()).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

module.exports = { getAvailableSlots };
