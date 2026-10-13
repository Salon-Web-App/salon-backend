// Structured JSON logs to stdout, one object per line — what CloudWatch Logs
// Insights queries. Pretty-printed locally when pino-pretty is installed.
const os = require("node:os");
const pino = require("pino");

const isProd = process.env.NODE_ENV === "production";

function devTransport() {
  if (isProd) return undefined;
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
    service: process.env.SERVICE_NAME || "api", // "api" | "worker" | "migrate"
    hostname: os.hostname(), // which container/task wrote it
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime, // "2026-10-13T17:05:00.000Z", not epoch ms
  // String levels ("error") instead of numbers (50) make queries readable.
  // pino can't combine this with a transport, so only in JSON mode.
  ...(transport
    ? { transport }
    : { formatters: { level: (label) => ({ level: label }) } }),
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
