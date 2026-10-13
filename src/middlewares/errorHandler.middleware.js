// Last middleware in the chain (registered after all routes in app.js).
// Catches anything thrown or passed to next(err) and returns a clean JSON
// error instead of leaking stack traces to the client.
function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || 500;
  const message = err.expose ? err.message : 'Something went wrong. Please try again.';

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
