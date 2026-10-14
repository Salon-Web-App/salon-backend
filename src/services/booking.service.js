const prisma = require("../lib/prisma");
const { generateApplicationId } = require("../utils/applicationId");
const { enqueueNotification } = require("../jobs/queue");
const { httpError } = require("../utils/httpError");
const { resolveOffering, qualifiedStaffWhere } = require("./catalog.service");

const ACTIVE_BOOKING = { deletedAt: null, status: { notIn: ["cancelled"] } };

function assertEditable(booking, { allowCancelled = false } = {}) {
  if (!booking || booking.deletedAt) throw httpError(404, "Booking not found");
  if (booking.status === "completed") {
    throw httpError(409, "This booking is completed and can no longer be changed.");
  }
  if (!allowCancelled && booking.status === "cancelled") {
    throw httpError(409, "This booking has been cancelled.");
  }
}

// Falls back to the booking's current length if the service/package is gone.
function durationFor(booking) {
  return (
    booking.package?.durationMinutes ??
    booking.service?.durationMinutes ??
    (booking.endTime - booking.startTime) / 60000
  );
}

function findStaffConflict({ staffId, start, end, excludeId, client = prisma }) {
  return client.booking.findFirst({
    where: {
      ...ACTIVE_BOOKING,
      staffId,
      ...(excludeId && { id: { not: excludeId } }),
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
}

function availableStaff(offering, start, end) {
  return prisma.staff.findMany({
    where: {
      ...qualifiedStaffWhere(offering),
      bookings: {
        none: { ...ACTIVE_BOOKING, startTime: { lt: end }, endTime: { gt: start } },
      },
    },
    select: { id: true, name: true },
  });
}

async function createBooking({
  offering,
  staffId,
  customerName,
  customerPhone,
  customerEmail,
  startTime,
  verifiedContact,
  notes,
}) {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + offering.durationMinutes * 60 * 1000);

  const booking = await prisma.$transaction(async (tx) => {
    if (staffId && (await findStaffConflict({ staffId, start, end, client: tx }))) {
      throw httpError(409, "This time slot was just booked. Please pick another.");
    }

    return tx.booking.create({
      data: {
        applicationId: generateApplicationId(),
        customerName,
        customerPhone,
        customerEmail,
        phoneVerified: verifiedContact === customerPhone,
        emailVerified: verifiedContact === customerEmail,
        serviceId: offering.serviceId,
        packageId: offering.packageId,
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

  if (!booking || booking.deletedAt) throw httpError(404, "Application not found");

  return booking;
}

async function modifyBooking(applicationId, { startTime, serviceId, changedBy = "customer" }) {
  const booking = await getByApplicationId(applicationId);
  assertEditable(booking);

  const data = {};
  const historyEntries = [];
  let durationMinutes = durationFor(booking);

  if (serviceId && serviceId !== booking.serviceId) {
    const offering = await resolveOffering({ serviceId });
    durationMinutes = offering.durationMinutes;
    historyEntries.push({
      changeType: "service_change",
      oldValue: booking.serviceId ?? booking.packageId,
      newValue: serviceId,
      changedBy,
    });
    data.serviceId = serviceId;
    data.packageId = null;
  }

  if (startTime) {
    const newStart = new Date(startTime);
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);

    if (
      booking.staffId &&
      (await findStaffConflict({
        staffId: booking.staffId,
        start: newStart,
        end: newEnd,
        excludeId: booking.id,
      }))
    ) {
      throw httpError(409, "This time slot is no longer available.");
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
  assertEditable(booking);

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

module.exports = {
  assertEditable,
  durationFor,
  findStaffConflict,
  availableStaff,
  createBooking,
  getByApplicationId,
  modifyBooking,
  cancelBooking,
};
