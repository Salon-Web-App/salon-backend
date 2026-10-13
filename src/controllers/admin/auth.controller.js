// Admin login only — customers never authenticate in this app (they use
// OTP + Application ID instead). This issues the JWT used by the
// requireAdmin middleware on every other /admin/* route.
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');

// Never used to log in — just gives the "user not found" path a bcrypt
// hash to compare against, so it takes roughly as long as the real
// lookup+compare and doesn't leak which emails exist via response timing.
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8Q/6yGa5eXeI5EofrOakYFdhaVwYbW';

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, admin?.passwordHash || DUMMY_HASH);
    if (!admin || !valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { sub: admin.id, email: admin.email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ADMIN_EXPIRES_IN || '8h', algorithm: 'HS256' }
    );

    res.json({ token });
  } catch (err) {
    next(err);
  }
}

module.exports = { login };
