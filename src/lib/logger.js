const os = require("node:os");
const pino = require("pino");

const isProd = process.env.NODE_ENV === "production";

function devTransport() {
  if (isProd || process.env.NODE_ENV === "test") return undefined;
  try {
    require.resolve("pino-pretty");
    return { target: "pino-pretty", options: { colorize: true } };
  } catch {
    return undefined;
  }
}

const transport = devTransport();

module.exports = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  base: {
    service: process.env.SERVICE_NAME || "api",
    hostname: os.hostname(),
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // pino can't use a custom level formatter together with a transport.
  ...(transport ? { transport } : { formatters: { level: (label) => ({ level: label }) } }),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.passwordHash",
      "*.otp",
      "*.code",
      "*.token",
      "*.verificationToken",
    ],
    censor: "[redacted]",
  },
});
