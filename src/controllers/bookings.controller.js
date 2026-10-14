// Create needs a booking_create verification token; modify and cancel need a
// fresh booking_modify token as the 2FA step.
const bookingService = require("../services/booking.service");
const otpService = require("../services/otp.service");
const availabilityService = require("../services/availability.service");
const prisma = require("../lib/prisma");

async function getAvailability(req, res, next) {
  try {
    const { serviceId, date } = req.query;

    if (!serviceId || !date) {
      const err = new Error("serviceId and date are required query parameters");
      err.status = 400;
      err.expose = true;
      throw err;
    }

    const slots = await availabilityService.getAvailableSlots({ serviceId, date });
    res.json(slots);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      serviceId,
      packageId,
      startTime,
      verificationToken,
      verifiedContact,
      notes,
    } = req.body;

    otpService.assertVerificationToken(verificationToken, {
      contact: verifiedContact,
      purpose: "booking_create",
    });

    const start = new Date(startTime);

    const service = serviceId
      ? await prisma.service.findUnique({
          where: { id: serviceId },
          select: { durationMinutes: true },
        })
      : null;
    const packageData = packageId
      ? await prisma.package.findUnique({
          where: { id: packageId },
          select: { durationMinutes: true },
        })
      : null;

    if (!service && !packageData) {
      return res.status(400).json({ message: "Invalid package or service" });
    }

    const durationMinutes = packageData?.durationMinutes ?? service?.durationMinutes;
    if (!durationMinutes) {
      return res.status(400).json({ message: "Unable to determine booking duration" });
    }
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const staffs = await bookingService.availableStaff(serviceId, start, end);
    if (!staffs || staffs.length === 0) {
      return res.status(409).json({
        message: "No staff member is available for the selected time",
      });
    }
    const staffId = staffs[0].id;

    const booking = await bookingService.createBooking({
      customerName,
      customerPhone,
      customerEmail,
      serviceId,
      packageId,
      staffId,
      startTime,
      verifiedContact,
      notes,
    });

    res.status(201).json({
      applicationId: booking.applicationId,
      status: booking.status,
      startTime: booking.startTime,
    });
  } catch (err) {
    next(err);
  }
}

async function getStatus(req, res, next) {
  try {
    const booking = await bookingService.getByApplicationId(req.params.applicationId);
    // Public endpoint: no customer contact details.
    res.json({
      applicationId: booking.applicationId,
      status: booking.status,
      service: booking.service?.name ?? booking.package?.title,
      staff: booking.staff?.name || null,
      startTime: booking.startTime,
      endTime: booking.endTime,
    });
  } catch (err) {
    next(err);
  }
}

async function requestModifyOtp(req, res, next) {
  try {
    const { channel, contact } = req.body;
    const booking = await bookingService.getByApplicationId(req.params.applicationId);

    const dbContact = channel === "email" ? booking.customerEmail : booking.customerPhone;

    // Same response whether or not the contact matches, so this can't be
    // used to probe which phone/email belongs to a booking.
    if (dbContact === contact) {
      await otpService.sendOtp({
        contact,
        channel: channel || "sms",
        purpose: "booking_modify",
      });
    }
    res.json({ sent: true });
  } catch (err) {
    next(err);
  }
}

async function modify(req, res, next) {
  try {
    const { startTime, serviceId, verificationToken, verifiedContact } = req.body;
    otpService.assertVerificationToken(verificationToken, {
      contact: verifiedContact,
      purpose: "booking_modify",
    });

    const updated = await bookingService.modifyBooking(req.params.applicationId, {
      startTime,
      serviceId,
      changedBy: "customer",
    });

    res.json({
      applicationId: updated.applicationId,
      status: updated.status,
      startTime: updated.startTime,
    });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const { verificationToken, verifiedContact } = req.body;
    otpService.assertVerificationToken(verificationToken, {
      contact: verifiedContact,
      purpose: "booking_modify",
    });

    const updated = await bookingService.cancelBooking(req.params.applicationId, {
      changedBy: "customer",
    });
    res.json({ applicationId: updated.applicationId, status: updated.status });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  getStatus,
  requestModifyOtp,
  modify,
  cancel,
  getAvailability,
};
