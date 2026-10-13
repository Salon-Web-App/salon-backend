// Public, read-only endpoints for browsing services on the booking site.
const prisma = require("../lib/prisma");

async function listServices(req, res, next) {
  try {
    const services = await prisma.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    res.json(services);
  } catch (err) {
    next(err);
  }
}
async function getServiceDetail(req, res, next) {
  try {
    const service = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: { staff: { where: { active: true } } },
    });

    if (!service || !service.active) {
      return res.status(404).json({ error: "Service not found" });
    }

    res.json(service);
  } catch (err) {
    next(err);
  }
}
module.exports = { listServices, getServiceDetail };
