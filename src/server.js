require("./config");
require("node:dns").setDefaultResultOrder("ipv4first");
const buildApp = require("./app");
const lifecycle = require("./lib/lifecycle");
const logger = require("./lib/logger");
const prisma = require("./lib/prisma");
const redis = require("./lib/redis");
const { notificationsQueue, maintenanceQueue } = require("./jobs/queue");

const PORT = Number(process.env.PORT || 3000);
const SHUTDOWN_TIMEOUT_MS = 25_000; // below ECS stopTimeout (30s)

async function closeResources() {
  // Queues share the Redis connection, so close them before Redis.
  await Promise.allSettled([notificationsQueue.close(), maintenanceQueue.close()]);
  await prisma.$disconnect();
  await redis.quit();
}

function start(app) {
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, "API listening");
  });

  // Must outlive the ALB idle timeout (60s), otherwise the ALB can reuse a
  // socket Node is closing and return a 502.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  async function shutdown(signal) {
    if (lifecycle.shuttingDown) {
      logger.warn({ signal }, "second signal received, forcing exit");
      process.exit(1);
    }
    lifecycle.shuttingDown = true;
    logger.info({ signal }, "shutting down");

    setTimeout(() => {
      logger.error("shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

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

    // Idle keep-alive sockets would otherwise hold server.close() open.
    server.closeIdleConnections();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

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
