// Rate limiters for the endpoints most likely to be abused: OTP requests
// (SMS/email spam cost money), booking mutation endpoints (brute force),
// login endpoints (credential brute force), other public writes, admin
// writes (abuse of a leaked/compromised token), and public reads (scraping
// / basic DoS).
const rateLimit = require("express-rate-limit");

// Keyed by contact (not IP) — an IP-keyed limit only stops one attacker
// from one address; spread across a handful of IPs it does nothing to
// protect an individual victim from being spammed with OTPs.
function otpContactKey(req) {
  const purpose = typeof req.body?.purpose === "string" ? req.body.purpose : "unknown";
  const contact =
    typeof req.body?.contact === "string"
      ? req.body.contact.trim().toLowerCase()
      : "unknown";
  return `${purpose}:${contact}`;
}

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // 5 OTP requests per contact per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: otpContactKey,
  message: { error: "Too many OTP requests. Please try again later." },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Please try again later." },
});

const bookingWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// Both admin login endpoints (/backoffice/login session-based, and
// /admin/auth/login JWT-based) had no rate limiting at all — this was a
// confirmed brute-forceable gap. Deliberately strict: these are
// credential-guessing targets, not normal traffic.
// /admin/auth/login (JWT): failure is 401, success is 200 — the default
// `requestWasSuccessful` (status < 400) draws the line in the right place,
// so plain skipSuccessfulRequests works as intended.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Only failed attempts count — otherwise a legitimate admin who mistypes
  // their password once or twice, then logs in fine, could still get
  // locked out of a later legitimate login within the same window.
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts. Please try again later." },
});

// /backoffice/login (AdminJS): the default success/failure split above
// doesn't hold here — AdminJS's own handler answers a WRONG password with
// 200 (it re-renders the login page with an inline error) and a CORRECT
// one with 302 (redirect into the panel). Plain skipSuccessfulRequests
// treats both as "< 400 = success" and would skip counting failures
// entirely, silently disabling the brute-force protection. Point
// requestWasSuccessful at the actual redirect instead.
const backofficeLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode === 302,
  message: { error: "Too many login attempts. Please try again later." },
});

// Public review submission (POST /reviews) had no limiter — same class of
// risk as booking writes.
const reviewWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// /admin/* write endpoints (staff/services/bookings/reviews CRUD) are
// already gated by requireAdmin (a valid JWT is mandatory), so this isn't
// guarding against brute force — it's a ceiling on how much damage a
// single leaked/compromised admin token can do per window.
const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// Public read-only endpoints (service/staff/package/transformation
// listings, availability, review list) had no limiter at all — generous
// ceiling, just enough to blunt scraping/basic DoS without affecting
// normal browsing.
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

module.exports = {
  otpSendLimiter,
  otpVerifyLimiter,
  bookingWriteLimiter,
  loginLimiter,
  backofficeLoginLimiter,
  reviewWriteLimiter,
  adminWriteLimiter,
  publicReadLimiter,
};
