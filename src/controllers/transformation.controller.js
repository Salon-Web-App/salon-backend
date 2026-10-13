const prisma = require("../lib/prisma");

async function list(req, res, next) {
  try {
    const items = await prisma.transformation.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
