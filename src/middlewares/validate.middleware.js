// Run after express-validator's `check(...)` chains on a route. Collects
// validation errors into a consistent 400 response so controllers never
// have to check `validationResult` themselves.
const { validationResult } = require("express-validator");

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

module.exports = { validate };
