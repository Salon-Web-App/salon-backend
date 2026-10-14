if (!["production", "test"].includes(process.env.NODE_ENV)) {
  require("dotenv").config();
}

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

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  require("./lib/logger").fatal({ missing }, "missing required env vars");
  process.exit(1);
}

// Throws on placeholder values like "frontend_domain".
new URL(process.env.FRONTEND_ORIGIN);

module.exports = {
  port: Number(process.env.PORT || 3000),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  tz: process.env.BUSINESS_TZ || "Asia/Kathmandu",
};
