// Builds and configures the Express app. Exported as an async function
// (not a ready-to-use app) because mounting the AdminJS panel requires an
// await (see src/admin/setupAdmin.js) — and it must be mounted BEFORE the
// catch-all 404 handler below, or every /backoffice request would be
// swallowed by that handler instead of reaching AdminJS.
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { randomUUID } = require("node:crypto");
const pinoHttp = require("pino-http");
const logger = require("./lib/logger");
const prisma = require("./lib/prisma");
const redis = require("./lib/redis");
const lifecycle = require("./lib/lifecycle");
const routes = require("./routes");
const { errorHandler } = require("./middlewares/errorHandler.middleware");
const { csrfOriginCheck } = require("./middlewares/csrfOriginCheck.middleware");
const {
  backofficeLoginLimiter,
} = require("./middlewares/rateLimit.middleware");
const { mountAdminPanel } = require("./admin/setupAdmin");

async function buildApp() {
  const app = express();

  // Off by default (safe for local/dev with no proxy in front). When
  // deployed behind a reverse proxy/load balancer, set TRUST_PROXY (e.g.
  // "1" for one hop) so req.ip resolves to the real client IP instead of
  // the proxy's — otherwise every request looks like it comes from the
  // same IP and IP-keyed rate limiters (login, OTP, etc.) collapse into a
  // single shared bucket for the whole site.
  if (process.env.TRUST_PROXY) {
    const trustProxy = Number.isNaN(Number(process.env.TRUST_PROXY))
      ? process.env.TRUST_PROXY
      : Number(process.env.TRUST_PROXY);
    app.set("trust proxy", trustProxy);
  }

  // /backoffice gets its own relaxed helmet config below (registered right
  // before mountAdminPanel) — the full default config breaks it two ways:
  //   - default CSP is `script-src 'self'` with no 'unsafe-inline', but
  //     AdminJS boots itself via an inline <script>window.REDUX_STATE = ...
  //     </script> on every page, so the page loads a blank shell with no JS.
  //   - default Cross-Origin-Opener-Policy + Origin-Agent-Cluster isolate
  //     the page into a fresh browsing context, which makes Chromium send
  //     `Origin: null` on the login form's POST navigation instead of the
  //     real origin — that trips csrfOriginCheck below and login just fails.
  // Every other route here only ever returns JSON, so the full strict
  // defaults are safe (and CSP is moot) there.
  app.use((req, res, next) => {
    if (req.path.startsWith("/backoffice")) return next();
    helmet()(req, res, next);
  });
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));

  app.use((req, res, next) => {
    if (req.path.startsWith("/backoffice")) return next();
    express.json({ limit: "10mb" })(req, res, next);
  });

  // One JSON log line per request, each with a request id. The id comes from
  // the ALB's X-Amzn-Trace-Id when present, so app logs can be matched to
  // ALB access logs; otherwise a fresh UUID. It's echoed back as
  // X-Request-Id so a user reporting an error can quote it.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id =
          req.headers["x-request-id"] ||
          req.headers["x-amzn-trace-id"] ||
          randomUUID();
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

  const lifecycle = require("./lib/lifecycle");

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  if (process.env.NODE_ENV !== "production") {
    // Dev-only: simulates a slow request so graceful shutdown can be tested.
    app.get("/debug/slow", (req, res) => {
      setTimeout(() => res.json({ ok: true, finishedAfterMs: 5000 }), 5000);
    });
  }

  app.get("/ready", async (req, res) => {
    if (lifecycle.shuttingDown)
      return res.status(503).json({ status: "draining" });

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
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? "ready" : "not ready", checks });
  });

  app.use("/api", routes);

  // Origin/Referer check for every /backoffice write — defense-in-depth
  // alongside the session cookie's SameSite=strict setting (see
  // setupAdmin.js). Must be registered before mountAdminPanel so it runs
  // ahead of AdminJS's own router.
  app.use("/backoffice", csrfOriginCheck);

  // AdminJS owns the actual POST /backoffice/login handler internally (via
  // buildAuthenticatedRouter in setupAdmin.js) — there's no route of ours
  // to attach a limiter to directly, so this runs first, ahead of it, on
  // the same path+method, and just falls through to AdminJS's own handler
  // when under the limit (same interception pattern as csrfOriginCheck
  // above).
  app.post("/backoffice/login", backofficeLoginLimiter);

  // AdminJS-specific helmet config — see comment above for why the full
  // defaults break the login flow and the page bootstrap.
  app.use(
    "/backoffice",
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "script-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:", "https://res.cloudinary.com"],
          "upgrade-insecure-requests": null, // disable the auto-HTTPS-upgrade
        },
      },
      // Helmet's default `no-referrer` also suppresses the Origin header
      // on same-origin POSTs in Chromium (Origin-on-POST is tied to the
      // referrer policy) — Chrome sends `Origin: null` instead, which
      // csrfOriginCheck correctly rejects, breaking login. `same-origin`
      // still strips the referrer on cross-origin requests but keeps a
      // real Origin on same-origin ones.
      referrerPolicy: { policy: "same-origin" },
    }),
  );

  // Must be mounted before the 404 handler — see comment above.
  await mountAdminPanel(app);

  // 404 for anything unmatched
  app.use((req, res) => res.status(404).json({ error: "Not found" }));

  // Must be registered last — catches errors passed via next(err) from any route.
  app.use(errorHandler);

  return app;
}

module.exports = buildApp;
