// Core OTP logic used by both the public /otp routes and internally by the
// booking modify/cancel flow. OTPs live in Redis (not Postgres) with a TTL,
// so there's nothing to clean up and codes auto-expire.
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const redis = require("../lib/redis");
const { generateOtpCode } = require("../utils/otpCode");
const { sendSms } = require("../lib/twilio");
const { sendEmail } = require("../lib/brevo");

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

function otpKey(purpose, contact) {
  return `otp:${purpose}:${contact}`;
}

function otpCooldownKey(purpose, contact) {
  return `otp:cooldown:${purpose}:${contact}`;
}

// purpose: "booking_create" | "booking_modify"
// channel: "sms" | "email"
async function sendOtp({ contact, channel, purpose }) {
  const cooldownKey = otpCooldownKey(purpose, contact);

  // "SET ... NX" only succeeds if the cooldown key isn't already set, so this
  // doubles as the check-and-set — no separate GET/race window.
  const acquired = await redis.set(
    cooldownKey,
    "1",
    "EX",
    OTP_RESEND_COOLDOWN_SECONDS,
    "NX",
  );
  if (!acquired) {
    const ttl = await redis.ttl(cooldownKey);
    const err = new Error(
      `Please wait ${Math.max(ttl, 1)}s before requesting another code.`,
    );
    err.status = 429;
    err.expose = true;
    throw err;
  }

  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);

  await redis.set(
    otpKey(purpose, contact),
    JSON.stringify({ codeHash, attempts: 0 }),
    "EX",
    OTP_TTL_SECONDS,
  );

  const message = `Your Makeup Studio verification code is ${code}. It expires in 5 minutes.`;
  if (channel === "sms") {
    console.log(code);
    // await sendSms(contact, message);
  } else {
    console.log(code);
    // await sendEmail(contact, "Your verification code", `<p>${message}</p>`);
  }

  return { sent: true };
}

// Verifies the code and, on success, issues a short-lived JWT that scopes
// what the caller is allowed to do next (create or modify a booking for
// this exact contact). This token — not the OTP itself — is what the
// booking routes require, so a code can't be reused after verification.
async function verifyOtp({ contact, otp, purpose }) {
  const key = otpKey(purpose, contact);
  const raw = await redis.get(key);
  if (!raw) {
    const err = new Error(
      "OTP expired or not found. Please request a new one.",
    );
    err.status = 400;
    err.expose = true;
    throw err;
  }

  const record = JSON.parse(raw);

  if (record.attempts >= MAX_ATTEMPTS) {
    await redis.del(key);
    const err = new Error(
      "Too many incorrect attempts. Please request a new code.",
    );
    err.status = 429;
    err.expose = true;
    throw err;
  }

  const isValid = await bcrypt.compare(otp, record.codeHash);

  if (!isValid) {
    record.attempts += 1;
    await redis.set(key, JSON.stringify(record), "KEEPTTL");
    const err = new Error("Incorrect code.");
    err.status = 400;
    err.expose = true;
    throw err;
  }

  await redis.del(key); // one-time use

  const verificationToken = jwt.sign(
    { contact, purpose },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_VERIFICATION_EXPIRES_IN || "10m" },
  );

  return { verificationToken };
}

// Used by the booking routes to confirm a verificationToken is valid,
// unexpired, and matches the expected contact + purpose.
function assertVerificationToken(token, { contact, purpose }) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const e = new Error("Verification expired. Please verify again.");
    e.status = 401;
    e.expose = true;
    throw e;
  }

  if (payload.contact !== contact || payload.purpose !== purpose) {
    const e = new Error("Verification does not match this request.");
    e.status = 401;
    e.expose = true;
    throw e;
  }

  return payload;
}

module.exports = { sendOtp, verifyOtp, assertVerificationToken };
