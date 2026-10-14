// Admin CRUD for staff members: profile info, workingHours (used by the
// availability engine), and photo (uploaded to Cloudinary via multer).
const prisma = require("../../lib/prisma");
const { uploadImageBuffer } = require("../../lib/cloudinary");

async function list(req, res, next) {
  try {
    const staff = await prisma.staff.findMany({
      include: { services: true },
      orderBy: { name: "asc" },
    });
    res.json(staff);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, bio, workingHours, serviceIds } = req.body;
    let photoUrl;

    if (req.file) {
      photoUrl = await uploadImageBuffer(req.file.buffer, "staff");
    }

    const staff = await prisma.staff.create({
      data: {
        name,
        bio,
        photoUrl,
        workingHours: workingHours ? JSON.parse(workingHours) : {},
        services: serviceIds
          ? { connect: JSON.parse(serviceIds).map((id) => ({ id })) }
          : undefined,
      },
    });

    res.status(201).json(staff);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, bio, active, workingHours, serviceIds } = req.body;
    let photoUrl;

    if (req.file) {
      photoUrl = await uploadImageBuffer(req.file.buffer, "staff");
    }

    const staff = await prisma.staff.update({
      where: { id },
      data: {
        name,
        bio,
        active: active !== undefined ? active === "true" || active === true : undefined,
        photoUrl,
        workingHours: workingHours ? JSON.parse(workingHours) : undefined,
        services: serviceIds
          ? { set: JSON.parse(serviceIds).map((sid) => ({ id: sid })) }
          : undefined,
      },
    });

    res.json(staff);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    // Soft delete preferred over hard delete so past bookings keep their
    // staff reference intact.
    const staff = await prisma.staff.update({
      where: { id: req.params.id },
      data: { active: false },
    });
    res.json(staff);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
