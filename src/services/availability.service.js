// Computes free time slots across staff members qualified for the given
// service, for a given date. It reads each qualifying staff's workingHours
// JSON, subtracts their existing bookings for that day, and deduplicates
// the available times.
const prisma = require("../lib/prisma");

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const SLOT_STEP_MINUTES = 30;

function parseRange(range) {
  const [start, end] = range.split("-");
  return { start, end };
}

function toDate(dateStr, hhmm) {
  return new Date(`${dateStr}T${hhmm}:00`);
}

async function getAvailableSlots({ serviceId, date }) {
  // Only fetch staff who are actually linked to this service, plus the
  // service itself, concurrently.
  const [staffForService, service] = await Promise.all([
    prisma.staff.findMany({
      where: {
        active: true,
        services: { some: { id: serviceId } },
      },
    }),
    prisma.service.findUnique({ where: { id: serviceId } }),
  ]);

  if (!service) {
    const err = new Error("Service not found");
    err.status = 404;
    err.expose = true;
    throw err;
  }

  const weekday = WEEKDAYS[new Date(date).getDay()];

  if (staffForService.length === 0) {
    return []; // nobody offers this service — nothing to compute
  }

  const staffIds = staffForService.map((s) => s.id);

  // Fetch existing bookings for this date, scoped to only the staff who
  // provide this service.
  const existingBookings = await prisma.booking.findMany({
    where: {
      status: { notIn: ["cancelled"] },
      staffId: { in: staffIds },
      startTime: {
        gte: new Date(`${date}T00:00:00`),
        lt: new Date(`${date}T23:59:59`),
      },
    },
    select: { staffId: true, startTime: true, endTime: true },
  });

  const availableSlotsMap = new Map();
  const durationMs = service.durationMinutes * 60 * 1000;
  const now = new Date();

  for (const staff of staffForService) {
    let workingHours = staff.workingHours;

    if (typeof workingHours === "string") {
      try {
        workingHours = JSON.parse(workingHours);
      } catch {
        continue;
      }
    }

    const ranges = workingHours?.[weekday] || [];
    if (ranges.length === 0) continue;

    const staffBookings = existingBookings.filter(
      (b) => b.staffId === staff.id,
    );

    for (const range of ranges) {
      const { start, end } = parseRange(range);
      let cursor = toDate(date, start);
      const rangeEnd = toDate(date, end);

      while (cursor.getTime() + durationMs <= rangeEnd.getTime()) {
        const slotStart = cursor;
        const slotEnd = new Date(cursor.getTime() + durationMs);
        const isoTime = slotStart.toISOString();

        if (slotStart > now) {
          const overlaps = staffBookings.some(
            (b) => slotStart < b.endTime && slotEnd > b.startTime,
          );

          if (!overlaps && !availableSlotsMap.has(isoTime)) {
            availableSlotsMap.set(isoTime, {
              startTime: isoTime,
              endTime: slotEnd.toISOString(),
              staffId: staff.id,
            });
          }
        }

        cursor = new Date(cursor.getTime() + SLOT_STEP_MINUTES * 60 * 1000);
      }
    }
  }

  const slots = Array.from(availableSlotsMap.values()).sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime),
  );

  return slots;
}

module.exports = { getAvailableSlots };
