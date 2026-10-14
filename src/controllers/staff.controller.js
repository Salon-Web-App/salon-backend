// Public, read-only endpoints for browsing staff and checking availability.
const prisma = require("../lib/prisma");
const { getAvailableSlots } = require("../services/availability.service");

async function listStaff(req, res, next) {
  try {
    const staff = await prisma.staff.findMany({
      where: { active: true },
      include: { services: { where: { active: true } } },
      orderBy: { name: "asc" },
    });
    res.json(staff);
  } catch (err) {
    next(err);
  }
}

async function getAvailability(req, res, next) {
  try {
    const { staffId, serviceId, date } = req.query;
    if (!staffId || !serviceId || !date) {
      return res.status(400).json({ error: "staffId, serviceId and date are required" });
    }
    const slots = await getAvailableSlots({ staffId, serviceId, date });
    res.json(slots);
  } catch (err) {
    next(err);
  }
}
async function getStaffDetail(req, res, next) {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: req.params.id },
      include: { services: { where: { active: true } } },
    });

    if (!staff || !staff.active) {
      return res.status(404).json({ error: "Staff not found" });
    }

    const reviews = await prisma.review.findMany({
      where: { approved: true, booking: { staffId: staff.id } },
      include: { booking: { select: { customerName: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ...staff, reviews });
  } catch (err) {
    next(err);
  }
}
module.exports = { listStaff, getAvailability, getStaffDetail };
