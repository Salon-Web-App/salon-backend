const logger = require("../lib/logger");

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const log = req.log || logger;

  if (status >= 500) {
    log.error({ err }, "unhandled error");
  } else {
    log.warn({ status, message: err.message }, "request rejected");
  }

  if (res.headersSent) return next(err);

  const body = {
    error: err.expose ? err.message : "Something went wrong. Please try again.",
  };
  // Lets a user report be matched to the exact log line.
  if (status >= 500 && req.id) body.requestId = req.id;

  res.status(status).json(body);
}

module.exports = { errorHandler };
