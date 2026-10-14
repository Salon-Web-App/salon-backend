// Create needs a booking_create verification token; modify and cancel need a
// fresh booking_modify token as the 2FA step.
const bookingService = require("../services/booking.service");
const otpService = require("../services/otp.service");
const availabilityService = require("../services/availability.service");
const { resolveOffering } = require("../services/catalog.service");

async function getAvailability(req, res, next) {
  try {
    const { serviceId, packageId, date } = req.query;
    const slots = await availabilityService.getAvailableSlots({ serviceId, packageId, date });
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

    const offering = await resolveOffering({ serviceId, packageId });

    const start = new Date(startTime);
    const end = new Date(start.getTime() + offering.durationMinutes * 60 * 1000);

    const staff = await bookingService.availableStaff(offering, start, end);
    if (staff.length === 0) {
      return res.status(409).json({ error: "No staff member is available for the selected time" });
    }

    const booking = await bookingService.createBooking({
      offering,
      staffId: staff[0].id,
      customerName,
      customerPhone,
      customerEmail,
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
