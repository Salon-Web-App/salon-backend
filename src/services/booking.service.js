const prisma = require("../lib/prisma");
const { generateApplicationId } = require("../utils/applicationId");
const { enqueueNotification } = require("../jobs/queue");

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

async function createBooking({
  customerName,
  customerPhone,
  customerEmail,
  serviceId,
  packageId,
  staffId,
  startTime,
  verifiedContact,
  notes,
}) {
  let durationMinutes;

  if (packageId) {
    const pkg = await prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.active) throw httpError(404, "Package not found or unavailable");
    durationMinutes = pkg.durationMinutes;
  } else if (serviceId) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || !service.active) throw httpError(404, "Service not found or unavailable");
    durationMinutes = service.durationMinutes;
  } else {
    throw httpError(400, "Either serviceId or packageId is required");
  }

  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const booking = await prisma.$transaction(async (tx) => {
    if (staffId) {
      const conflict = await tx.booking.findFirst({
        where: {
          staffId,
          status: { notIn: ["cancelled"] },
          AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
        },
      });
      if (conflict) {
        throw httpError(409, "This time slot was just booked. Please pick another.");
      }
    }

    return tx.booking.create({
      data: {
        applicationId: generateApplicationId(),
        customerName,
        customerPhone,
        customerEmail,
        phoneVerified: verifiedContact === customerPhone,
        emailVerified: verifiedContact === customerEmail,
        serviceId: serviceId || null,
        packageId: packageId || null,
        staffId: staffId || null,
        startTime: start,
        endTime: end,
        status: "confirmed",
        notes: notes || null,
      },
      include: { service: true, package: true, staff: true },
    });
  });

  await enqueueNotification("booking.created", { bookingId: booking.id });

  return booking;
}

async function getByApplicationId(applicationId) {
  const booking = await prisma.booking.findUnique({
    where: { applicationId },
    include: { service: true, package: true, staff: true },
  });

  if (!booking) throw httpError(404, "Application not found");

  return booking;
}

async function modifyBooking(applicationId, { startTime, serviceId, changedBy = "customer" }) {
  const booking = await getByApplicationId(applicationId);

  const data = {};
  const historyEntries = [];

  if (serviceId && serviceId !== booking.serviceId) {
    historyEntries.push({
      changeType: "service_change",
      oldValue: booking.serviceId,
      newValue: serviceId,
      changedBy,
    });
    data.serviceId = serviceId;
    data.packageId = null;
  }

  if (startTime) {
    let durationMinutes;
    if (serviceId) {
      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      durationMinutes = service.durationMinutes;
    } else if (booking.packageId) {
      durationMinutes = booking.package.durationMinutes;
    } else {
      durationMinutes = booking.service.durationMinutes;
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);

    if (booking.staffId) {
      const conflict = await prisma.booking.findFirst({
        where: {
          id: { not: booking.id },
          staffId: booking.staffId,
          status: { notIn: ["cancelled"] },
          AND: [{ startTime: { lt: newEnd } }, { endTime: { gt: newStart } }],
        },
      });
      if (conflict) throw httpError(409, "This time slot is no longer available.");
    }

    historyEntries.push({
      changeType: "reschedule",
      oldValue: booking.startTime.toISOString(),
      newValue: newStart.toISOString(),
      changedBy,
    });
    data.startTime = newStart;
    data.endTime = newEnd;
    data.status = "rescheduled";
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.booking.update({ where: { id: booking.id }, data });
    for (const entry of historyEntries) {
      await tx.bookingHistory.create({ data: { bookingId: booking.id, ...entry } });
    }
    return result;
  });

  await enqueueNotification("booking.modified", { bookingId: booking.id });

  return updated;
}

async function cancelBooking(applicationId, { changedBy = "customer" } = {}) {
  const booking = await getByApplicationId(applicationId);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled" },
    });
    await tx.bookingHistory.create({
      data: {
        bookingId: booking.id,
        changeType: "cancelled",
        oldValue: booking.status,
        newValue: "cancelled",
        changedBy,
      },
    });
    return result;
  });

  await enqueueNotification("booking.cancelled", { bookingId: booking.id });

  return updated;
}

async function availableStaff(serviceId, start, end) {
  return prisma.staff.findMany({
    where: {
      active: true,
      ...(serviceId && { services: { some: { id: serviceId } } }),
      bookings: {
        none: {
          deletedAt: null,
          status: { notIn: ["cancelled"] },
          startTime: { lt: end },
          endTime: { gt: start },
        },
      },
    },
    select: { id: true, name: true },
  });
}

module.exports = {
  createBooking,
  getByApplicationId,
  modifyBooking,
  cancelBooking,
  availableStaff,
};
