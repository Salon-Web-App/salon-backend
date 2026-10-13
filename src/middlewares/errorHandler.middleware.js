// Last middleware in the chain. Logs the error once, at the right level,
// with the request id, and returns a safe JSON body. 5xx responses include
// the request id so a user report can be matched to the exact log line.
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
  if (status >= 500 && req.id) body.requestId = req.id;

  res.status(status).json(body);
}

module.exports = { errorHandler };
