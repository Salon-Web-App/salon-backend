const { randomUUID } = require("node:crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pinoHttp = require("pino-http");

const logger = require("./lib/logger");
const lifecycle = require("./lib/lifecycle");
const prisma = require("./lib/prisma");
const redis = require("./lib/redis");
const routes = require("./routes");
const { errorHandler } = require("./middlewares/errorHandler.middleware");
const { csrfOriginCheck } = require("./middlewares/csrfOriginCheck.middleware");
const { backofficeLoginLimiter } = require("./middlewares/rateLimit.middleware");
const { mountAdminPanel } = require("./admin/setupAdmin");

async function buildApp() {
  const app = express();

  // Set TRUST_PROXY behind a load balancer so req.ip is the client, not the
  // proxy. Without it all IP-keyed rate limits share one bucket.
  if (process.env.TRUST_PROXY) {
    const trustProxy = Number.isNaN(Number(process.env.TRUST_PROXY))
      ? process.env.TRUST_PROXY
      : Number(process.env.TRUST_PROXY);
    app.set("trust proxy", trustProxy);
  }

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.get("/ready", async (req, res) => {
    if (lifecycle.shuttingDown) return res.status(503).json({ status: "draining" });

    const checks = {};
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = "ok";
    } catch (err) {
      checks.db = "fail";
      logger.warn({ err }, "readiness: database check failed");
    }
    try {
      await redis.ping();
      checks.redis = "ok";
    } catch (err) {
      checks.redis = "fail";
      logger.warn({ err }, "readiness: redis check failed");
    }

    const ready = Object.values(checks).every((v) => v === "ok");
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not ready", checks });
  });

  if (process.env.NODE_ENV !== "production") {
    // For testing graceful shutdown with an in-flight request.
    app.get("/debug/slow", (req, res) => {
      setTimeout(() => res.json({ ok: true, finishedAfterMs: 5000 }), 5000);
    });
  }

  // /backoffice gets its own helmet config further down: the strict default
  // CSP blocks AdminJS's inline bootstrap script, and COOP makes Chromium
  // send `Origin: null` on the login POST, which csrfOriginCheck rejects.
  app.use((req, res, next) => {
    if (req.path.startsWith("/backoffice")) return next();
    helmet()(req, res, next);
  });
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));

  app.use((req, res, next) => {
    if (req.path.startsWith("/backoffice")) return next();
    express.json({ limit: "10mb" })(req, res, next);
  });

  app.use(
    pinoHttp({
      logger,
      // Reuse the proxy's id so app logs line up with ALB/nginx logs.
      genReqId: (req, res) => {
        const id = req.headers["x-request-id"] || req.headers["x-amzn-trace-id"] || randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.url === "/ready",
      },
      customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      customSuccessMessage: (req, res) =>
        `${req.method} ${req.originalUrl || req.url} ${res.statusCode}`,
      customErrorMessage: (req, res) =>
        `${req.method} ${req.originalUrl || req.url} ${res.statusCode}`,
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use("/api", routes);

  app.use("/backoffice", csrfOriginCheck);

  // AdminJS owns the login handler; this runs first and falls through when
  // under the limit.
  app.post("/backoffice/login", backofficeLoginLimiter);

  app.use(
    "/backoffice",
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "script-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:", "https://res.cloudinary.com"],
          // TODO: remove once served over HTTPS
          "upgrade-insecure-requests": null,
        },
      },
      // no-referrer makes Chromium send `Origin: null` on same-origin POSTs.
      referrerPolicy: { policy: "same-origin" },
    }),
  );

  // AdminJS is ESM-only (dynamic import), which Jest's CommonJS runtime
  // can't load. API tests don't need it.
  if (process.env.NODE_ENV !== "test") {
    // Must be mounted before the 404 handler.
    await mountAdminPanel(app);
  }

  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);

  return app;
}

module.exports = buildApp;
