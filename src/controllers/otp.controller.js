// Handles OTP send/verify for both booking creation and the 2FA required
// to edit/cancel an existing booking. See src/services/otp.service.js for
// the actual logic — this file just wires HTTP <-> service.
const otpService = require("../services/otp.service");

async function sendOtp(req, res, next) {
  try {
    const { contact, channel, purpose } = req.body;
    console.log(req.body);
    const result = await otpService.sendOtp({ contact, channel, purpose });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { contact, otp, purpose } = req.body;
    const result = await otpService.verifyOtp({ contact, otp, purpose });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { sendOtp, verifyOtp };
