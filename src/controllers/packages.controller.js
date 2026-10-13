const prisma = require("../lib/prisma");

async function list(req, res, next) {
  try {
    const packages = await prisma.package.findMany({
      where: { active: true },
      include: { services: { where: { active: true } } },
      orderBy: { order: "asc" },
    });
    res.json(packages);
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
