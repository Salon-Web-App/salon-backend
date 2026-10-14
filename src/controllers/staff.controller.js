const prisma = require("../lib/prisma");
const { getAvailableSlots } = require("../services/availability.service");
const { toPublicReview, PUBLIC_REVIEW_INCLUDE } = require("../utils/publicReview");

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
    const { staffId, serviceId, packageId, date } = req.query;
    const slots = await getAvailableSlots({ staffId, serviceId, packageId, date });
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
      include: PUBLIC_REVIEW_INCLUDE,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    res.json({ ...staff, reviews: reviews.map(toPublicReview) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listStaff, getAvailability, getStaffDetail };
