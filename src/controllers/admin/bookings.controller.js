// Admin management of bookings: view/filter all bookings, assign staff,
// change status, and reschedule. Every mutation logs to BookingHistory and
// enqueues a customer notification, mirroring the customer-facing flow.
const prisma = require('../../lib/prisma');
const bookingService = require('../../services/booking.service');
const { enqueueNotification } = require('../../jobs/queue');

async function list(req, res, next) {
  try {
    const { status, staffId, from, to } = req.query;

    const where = {};
    if (status) where.status = status;
    if (staffId) where.staffId = staffId;
    if (from || to) {
      where.startTime = {};
      if (from) where.startTime.gte = new Date(from);
      if (to) where.startTime.lte = new Date(to);
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: { service: true, staff: true },
      orderBy: { startTime: 'asc' },
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

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id },
        data: { staffId, status: 'staff_assigned' },
      });
      await tx.bookingHistory.create({
        data: { bookingId: id, changeType: 'staff_assigned', oldValue: existing.staffId, newValue: staffId, changedBy: 'admin' },
      });
      return result;
    });

    await enqueueNotification('booking.staff_assigned', { bookingId: id });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function changeStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body; // "confirmed" | "completed" | "cancelled"

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({ where: { id }, data: { status } });
      await tx.bookingHistory.create({
        data: { bookingId: id, changeType: 'status_change', oldValue: existing.status, newValue: status, changedBy: 'admin' },
      });
      return result;
    });

    if (status === 'cancelled') {
      await enqueueNotification('booking.cancelled', { bookingId: id });
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

    const existing = await prisma.booking.findUnique({ where: { id }, include: { service: true } });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    const newStart = new Date(startTime);
    const newEnd = new Date(newStart.getTime() + existing.service.durationMinutes * 60 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id },
        data: { startTime: newStart, endTime: newEnd, status: 'rescheduled' },
      });
      await tx.bookingHistory.create({
        data: { bookingId: id, changeType: 'reschedule', oldValue: existing.startTime.toISOString(), newValue: newStart.toISOString(), changedBy: 'admin' },
      });
      return result;
    });

    await enqueueNotification('booking.rescheduled', { bookingId: id });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, assignStaff, changeStatus, reschedule };
