// Protects /admin/* routes. Expects `Authorization: Bearer <token>` issued
// by POST /admin/auth/login. Attaches the decoded admin payload to req.admin.
const jwt = require("jsonwebtoken");

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing admin token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.role !== "admin") throw new Error("Not an admin token");
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired admin token" });
  }
}

module.exports = { requireAdmin };
