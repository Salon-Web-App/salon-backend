// Admin booking management over the JWT API. Applies the same rules as the
// backoffice actions: completed bookings are locked, staff can't be
// double-booked, and every change is logged and notified.
const prisma = require("../../lib/prisma");
const { enqueueNotification } = require("../../jobs/queue");
const { httpError } = require("../../utils/httpError");
const {
  assertEditable,
  durationFor,
  findStaffConflict,
} = require("../../services/booking.service");

const ADMIN_STATUSES = ["confirmed", "cancelled", "completed"];

async function loadBooking(id) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { service: true, package: true },
  });
  if (!booking || booking.deletedAt) throw httpError(404, "Booking not found");
  return booking;
}

async function list(req, res, next) {
  try {
    const { status, staffId, from, to } = req.query;

    const where = { deletedAt: null };
    if (status) where.status = status;
    if (staffId) where.staffId = staffId;
    if (from || to) {
      where.startTime = {};
      if (from) where.startTime.gte = new Date(from);
      if (to) where.startTime.lte = new Date(to);
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: { service: true, package: true, staff: true },
      orderBy: { startTime: "asc" },
    });

    res.json(bookings);
  } catch (err) {
    next(err);
  }
}

async function assignStaff(req, res, next) {
  try {
    const { id } = req.params;
    const { staffId } = req.body;

    const existing = await loadBooking(id);
    assertEditable(existing);

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || !staff.active) throw httpError(400, "Staff member not found or inactive");

    const conflict = await findStaffConflict({
      staffId,
      start: existing.startTime,
      end: existing.endTime,
      excludeId: id,
    });
    if (conflict) throw httpError(409, "This staff member is already booked at that time.");

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id },
        data: { staffId, status: "staff_assigned" },
      });
      await tx.bookingHistory.create({
        data: {
          bookingId: id,
          changeType: "staff_assigned",
          oldValue: existing.staffId,
          newValue: staffId,
          changedBy: "admin",
        },
      });
      return result;
    });

    await enqueueNotification("booking.staff_assigned", { bookingId: id });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function changeStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const existing = await loadBooking(id);
    // Admins may restore a cancelled booking, but completed is final.
    assertEditable(existing, { allowCancelled: true });
    if (existing.status === status) return res.json(existing);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({ where: { id }, data: { status } });
      await tx.bookingHistory.create({
        data: {
          bookingId: id,
          changeType: "status_change",
          oldValue: existing.status,
          newValue: status,
          changedBy: "admin",
        },
      });
      return result;
    });

    if (status === "cancelled") {
      await enqueueNotification("booking.cancelled", { bookingId: id });
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function reschedule(req, res, next) {
  try {
    const { id } = req.params;
    const { startTime } = req.body;

    const existing = await loadBooking(id);
    assertEditable(existing);

    const newStart = new Date(startTime);
    const newEnd = new Date(newStart.getTime() + durationFor(existing) * 60 * 1000);

    if (
      existing.staffId &&
      (await findStaffConflict({
        staffId: existing.staffId,
        start: newStart,
        end: newEnd,
        excludeId: id,
      }))
    ) {
      throw httpError(409, "The assigned staff member is already booked at that time.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id },
        data: { startTime: newStart, endTime: newEnd, status: "rescheduled" },
      });
      await tx.bookingHistory.create({
        data: {
          bookingId: id,
          changeType: "reschedule",
          oldValue: existing.startTime.toISOString(),
          newValue: newStart.toISOString(),
          changedBy: "admin",
        },
      });
      return result;
    });

    await enqueueNotification("booking.rescheduled", { bookingId: id });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, assignStaff, changeStatus, reschedule, ADMIN_STATUSES };
