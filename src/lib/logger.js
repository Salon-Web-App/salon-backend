// Structured JSON logs to stdout (CloudWatch-friendly). In local dev,
// pretty-prints if pino-pretty is installed; falls back to JSON otherwise
// (e.g. images built with --omit=dev).
const pino = require("pino");

function devTransport() {
  if (process.env.NODE_ENV === "production") return undefined;
  try {
    require.resolve("pino-pretty");
    return { target: "pino-pretty", options: { colorize: true } };
  } catch {
    return undefined;
  }
}

module.exports = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: ["req.headers.authorization", "req.headers.cookie"],
  transport: devTransport(),
});