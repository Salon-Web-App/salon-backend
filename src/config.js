// src/config.js
if (process.env.NODE_ENV !== "production") require("dotenv").config();

const required = [
  "DATABASE_URL",
  "REDIS_URL",
  "ADMIN_SESSION_SECRET",
  "JWT_SECRET",
  "FRONTEND_ORIGIN",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  require("./lib/logger").fatal({ missing }, "missing required env vars");
  process.exit(1);
}
new URL(process.env.FRONTEND_ORIGIN);

module.exports = {
  port: Number(process.env.PORT || 3000),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  tz: process.env.BUSINESS_TZ || "Asia/Kathmandu",
};
