const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redis = require("../lib/redis");

const WINDOW_MS = 15 * 60 * 1000;

// Counters live in Redis so limits hold across replicas. Each limiter needs
// its own store instance; express-rate-limit rejects a shared one.
const store = (name) =>
  new RedisStore({
    prefix: `salon:rl:${name}:`,
    sendCommand: (command, ...args) => redis.call(command, ...args),
  });

function limiter(name, options) {
  return rateLimit({
    windowMs: WINDOW_MS,
    standardHeaders: true,
    legacyHeaders: false,
    store: store(name),
    ...options,
  });
}

// Keyed by contact rather than IP, so a victim can't be spammed with OTPs
// from many addresses.
function otpContactKey(req) {
  const purpose = typeof req.body?.purpose === "string" ? req.body.purpose : "unknown";
  const contact =
    typeof req.body?.contact === "string" ? req.body.contact.trim().toLowerCase() : "unknown";
  return `${purpose}:${contact}`;
}

const otpSendLimiter = limiter("otp-send", {
  limit: 5,
  keyGenerator: otpContactKey,
  message: { error: "Too many OTP requests. Please try again later." },
});

const otpVerifyLimiter = limiter("otp-verify", {
  limit: 10,
  message: { error: "Too many verification attempts. Please try again later." },
});

const bookingWriteLimiter = limiter("booking-write", {
  limit: 20,
  message: { error: "Too many requests. Please slow down." },
});

// Only failed attempts count, so an admin who mistypes once isn't locked out
// of a later successful login.
const loginLimiter = limiter("login", {
  limit: 5,
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts. Please try again later." },
});

// AdminJS answers a wrong password with 200 (re-rendered form) and a correct
// one with 302, so success has to be defined by the redirect.
const backofficeLoginLimiter = limiter("backoffice-login", {
  limit: 5,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode === 302,
  message: { error: "Too many login attempts. Please try again later." },
});

const reviewWriteLimiter = limiter("review-write", {
  limit: 10,
  message: { error: "Too many requests. Please slow down." },
});

// Caps the damage a leaked admin token can do per window.
const adminWriteLimiter = limiter("admin-write", {
  limit: 100,
  message: { error: "Too many requests. Please slow down." },
});

const publicReadLimiter = limiter("public-read", {
  limit: 300,
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
