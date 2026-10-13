// Core booking business logic, kept separate from the controllers so it
// can be reused by both the public routes and, if needed later, admin
// routes or background jobs.
const prisma = require("../lib/prisma");
const { generateApplicationId } = require("../utils/applicationId");
const { enqueueNotification } = require("../jobs/queue");

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
    if (!pkg || !pkg.active) {
      const err = new Error("Package not found or unavailable");
      err.status = 404;
      err.expose = true;
      throw err;
    }
    durationMinutes = pkg.durationMinutes;
  } else if (serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service || !service.active) {
      const err = new Error("Service not found or unavailable");
      err.status = 404;
      err.expose = true;
      throw err;
    }
    durationMinutes = service.durationMinutes;
  } else {
    const err = new Error("Either serviceId or packageId is required");
    err.status = 400;
    err.expose = true;
    throw err;
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
        const err = new Error(
          "This time slot was just booked. Please pick another.",
        );
        err.status = 409;
        err.expose = true;
        throw err;
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

  if (!booking) {
    const err = new Error("Application not found");
    err.status = 404;
    err.expose = true;
    throw err;
  }

  return booking;
}

async function modifyBooking(
  applicationId,
  { startTime, serviceId, changedBy = "customer" },
) {
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
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });
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
      if (conflict) {
        const err = new Error("This time slot is no longer available.");
        err.status = 409;
        err.expose = true;
        throw err;
      }
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
      await tx.bookingHistory.create({
        data: { bookingId: booking.id, ...entry },
      });
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
async function availableStaff(serviceID, start, end) {
  const availibleStaffs = await prisma.staff.findMany({
    where: {
      active: true,

      ...(serviceID && {
        services: {
          some: {
            id: serviceID,
          },
        },
      }),

      // bookings: {
      //   none: {
      //     deletedAt: null,
      //     status: {
      //       notIn: ["cancelled"],
      //     },
      //     startTime: {
      //       lt: end,
      //     },
      //     endTime: {
      //       gt: start,
      //     },
      //   },
      // },
    },

    select: {
      id: true,
      name: true,
    },
  });
  // if (availibleStaffs.length === 0) {
  //   return res.status(409).json({
  //     message: "No staff member is available for the selected time",
  //   });
  // }
  return availibleStaffs;
}
module.exports = {
  createBooking,
  getByApplicationId,
  modifyBooking,
  cancelBooking,
  availableStaff,
};
