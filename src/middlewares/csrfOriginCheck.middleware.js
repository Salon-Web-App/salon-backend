// Defense-in-depth CSRF check for /backoffice (AdminJS), on top of the
// session cookie's SameSite=strict setting. Rejects any state-changing
// request whose Origin/Referer doesn't match the host the browser actually
// used to reach this server — the same check SameSite is meant to enforce,
// applied explicitly so it still holds if a browser ever mishandles
// SameSite (older versions, unusual proxy setups, etc).
//
// Safe methods (GET/HEAD/OPTIONS) are never state-changing, so they pass
// through untouched — this only guards POST/PUT/PATCH/DELETE.
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function originHost(value) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch (err) {
    return null;
  }
}

function csrfOriginCheck(req, res, next) {
  if (!UNSAFE_METHODS.has(req.method)) {
    return next();
  }

  const expectedHost = req.headers.host;
  const sourceHost = originHost(req.headers.origin) || originHost(req.headers.referer);

  if (!sourceHost || sourceHost !== expectedHost) {
    return res.status(403).json({ error: "Request origin could not be verified." });
  }

  return next();
}

module.exports = { csrfOriginCheck };
