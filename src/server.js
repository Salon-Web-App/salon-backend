// Starts the API process. On SIGTERM (sent by Docker/ECS before stopping a
// container) it stops accepting connections, lets in-flight requests finish,
// closes Redis/Prisma/BullMQ cleanly and exits 0 — well inside ECS's 30s
// stopTimeout, so tasks never get SIGKILLed mid-request.
require("./config");
require("node:dns").setDefaultResultOrder("ipv4first");
const buildApp = require("./app");
const lifecycle = require("./lib/lifecycle");
const logger = require("./lib/logger");
const prisma = require("./lib/prisma");
const redis = require("./lib/redis");
const { notificationsQueue, maintenanceQueue } = require("./jobs/queue");

const PORT = Number(process.env.PORT || 3000);
const SHUTDOWN_TIMEOUT_MS = 25_000; // must stay below ECS stopTimeout (30s)

async function closeResources() {
  // Order matters: queues use the Redis connection, so close them first.
  await Promise.allSettled([
    notificationsQueue.close(),
    maintenanceQueue.close(),
  ]);
  await prisma.$disconnect();
  await redis.quit();
}

function start(app) {
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, "API listening");
  });

  // The ALB keeps idle connections open for 60s. If Node closed them first
  // (its default is 5s), the ALB could send a request down a socket Node is
  // closing and return a random 502. Keep Node's timeout longer than the ALB's.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000; // must be > keepAliveTimeout

  async function shutdown(signal) {
    if (lifecycle.shuttingDown) {
      // Second Ctrl+C in dev: stop waiting.
      logger.warn({ signal }, "second signal received, forcing exit");
      process.exit(1);
    }
    lifecycle.shuttingDown = true; // /ready now returns 503
    logger.info({ signal }, "shutting down");

    // Safety net: if something hangs (a stuck request, a dead DB socket),
    // exit before ECS escalates to SIGKILL. unref() so this timer alone
    // doesn't keep the process alive.
    setTimeout(() => {
      logger.error("shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    // Stop accepting new connections. The callback fires once every
    // existing connection has closed, i.e. all in-flight requests are done.
    server.close(async (err) => {
      if (err) logger.error({ err }, "error closing HTTP server");
      try {
        await closeResources();
        logger.info("shutdown complete");
        process.exit(err ? 1 : 0);
      } catch (closeErr) {
        logger.error({ err: closeErr }, "error closing resources");
        process.exit(1);
      }
    });

    // Idle keep-alive sockets would otherwise hold server.close() open for up
    // to 65s. Close the idle ones now; busy ones close after their response.
    server.closeIdleConnections();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// A crash should be loud and leave a clean, non-zero exit code so ECS
// replaces the task and the Phase 6 alarms can tell crashes from deploys.
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled promise rejection");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  process.exit(1);
});

buildApp()
  .then(start)
  .catch((err) => {
    logger.fatal({ err }, "failed to start server");
    process.exit(1);
  });
