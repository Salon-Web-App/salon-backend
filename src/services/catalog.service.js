// A booking is for either a single service or a package of services. This
// resolves either into what booking and availability need: the duration and
// the services a staff member must offer to take it.
const prisma = require("../lib/prisma");
const { httpError } = require("../utils/httpError");

async function resolveOffering({ serviceId, packageId }) {
  if (packageId) {
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: { services: { select: { id: true } } },
    });
    if (!pkg || !pkg.active) throw httpError(404, "Package not found or unavailable");
    return {
      serviceId: null,
      packageId: pkg.id,
      durationMinutes: pkg.durationMinutes,
      requiredServiceIds: pkg.services.map((s) => s.id),
    };
  }

  if (serviceId) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || !service.active) throw httpError(404, "Service not found or unavailable");
    return {
      serviceId: service.id,
      packageId: null,
      durationMinutes: service.durationMinutes,
      requiredServiceIds: [service.id],
    };
  }

  throw httpError(400, "Either serviceId or packageId is required");
}

// Staff must offer every service in the offering.
function qualifiedStaffWhere(offering) {
  return {
    active: true,
    AND: offering.requiredServiceIds.map((id) => ({ services: { some: { id } } })),
  };
}

module.exports = { resolveOffering, qualifiedStaffWhere };
