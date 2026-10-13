// Admin CRUD for services offered (name, price, duration, description, image).
const prisma = require('../../lib/prisma');
const { uploadImageBuffer } = require('../../lib/cloudinary');

async function list(req, res, next) {
  try {
    const services = await prisma.service.findMany({ orderBy: { name: 'asc' } });
    res.json(services);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, description, price, durationMinutes } = req.body;
    let imageUrl;

    if (req.file) {
      imageUrl = await uploadImageBuffer(req.file.buffer, 'services');
    }

    const service = await prisma.service.create({
      data: { name, description, price, durationMinutes: Number(durationMinutes), imageUrl },
    });

    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, price, durationMinutes, active } = req.body;
    let imageUrl;

    if (req.file) {
      imageUrl = await uploadImageBuffer(req.file.buffer, 'services');
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        name,
        description,
        price,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        active: active !== undefined ? active === 'true' || active === true : undefined,
        imageUrl,
      },
    });

    res.json(service);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    // Soft delete so past bookings keep their service reference intact.
    const service = await prisma.service.update({ where: { id: req.params.id }, data: { active: false } });
    res.json(service);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
