const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const buildApp = require("../src/app");
const prisma = require("../src/lib/prisma");
const redis = require("../src/lib/redis");
const { notificationsQueue, maintenanceQueue } = require("../src/jobs/queue");

const ALL_WEEK = Object.fromEntries(
  ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, ["09:00-18:00"]]),
);

async function resetDb() {
  // CASCADE also clears history, reviews and the implicit join tables.
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Booking", "Staff", "Service", "Package", "AdminUser", "Transformation" CASCADE',
  );
  await redis.flushdb();
}

function createService(overrides = {}) {
  return prisma.service.create({
    data: { name: "Bridal Makeup", price: "5000", durationMinutes: 60, ...overrides },
  });
}

function createPackage(services = [], overrides = {}) {
  return prisma.package.create({
    data: {
      title: "Bridal Package",
      originalPrice: "9000",
      offerPrice: "7500",
      durationMinutes: 90,
      services: { connect: services.map((s) => ({ id: s.id })) },
      ...overrides,
    },
  });
}

function createStaff(services = [], overrides = {}) {
  return prisma.staff.create({
    data: {
      name: "Asha",
      workingHours: ALL_WEEK,
      services: { connect: services.map((s) => ({ id: s.id })) },
      ...overrides,
    },
  });
}

let bookingSeq = 0;
function createBookingRow({
  serviceId = null,
  packageId = null,
  staffId = null,
  start,
  minutes = 60,
  status = "confirmed",
  deletedAt = null,
  customerName = "Test Customer",
} = {}) {
  bookingSeq += 1;
  const startTime = new Date(start);
  return prisma.booking.create({
    data: {
      applicationId: `APP-T${Date.now().toString(36)}${bookingSeq}`.toUpperCase(),
      customerName,
      customerPhone: "+9779800000001",
      customerEmail: "customer@test.local",
      serviceId,
      packageId,
      staffId,
      startTime,
      endTime: new Date(startTime.getTime() + minutes * 60 * 1000),
      status,
      deletedAt,
    },
  });
}

async function createAdmin(email = "admin@test.local", password = "correct-horse-battery") {
  const passwordHash = await bcrypt.hash(password, 4);
  await prisma.adminUser.create({ data: { email, passwordHash, role: "admin" } });
  return { email, password };
}

// Same token POST /api/otp/verify issues; otpFlow.test.js covers the real flow.
function verificationToken(contact, purpose = "booking_create", secret = process.env.JWT_SECRET) {
  return jwt.sign({ contact, purpose }, secret, { expiresIn: "10m" });
}

function adminToken(overrides = {}, secret = process.env.JWT_SECRET) {
  return jwt.sign(
    { sub: "test-admin", email: "admin@test.local", role: "admin", ...overrides },
    secret,
    { expiresIn: "1h", algorithm: "HS256" },
  );
}

function futureSlot(daysAhead = 3, hourUtc = 5) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

// YYYY-MM-DD in the process (business) timezone.
function localDate(daysAhead = 3) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toLocaleDateString("en-CA");
}

// ISO timestamp for a local wall-clock time on a given YYYY-MM-DD.
function localTime(date, hhmm) {
  return new Date(`${date}T${hhmm}:00`).toISOString();
}

function bookingPayload(service, overrides = {}) {
  const customerPhone = overrides.customerPhone || "+9779800000001";
  return {
    customerName: "Test Customer",
    customerPhone,
    customerEmail: "customer@test.local",
    serviceId: service.id,
    startTime: futureSlot(),
    verifiedContact: customerPhone,
    verificationToken: verificationToken(customerPhone),
    ...overrides,
  };
}

async function closeAll() {
  await Promise.allSettled([notificationsQueue.close(), maintenanceQueue.close()]);
  await prisma.$disconnect();
  await redis.quit();
}

module.exports = {
  buildApp,
  prisma,
  redis,
  notificationsQueue,
  resetDb,
  createService,
  createPackage,
  createStaff,
  createBookingRow,
  createAdmin,
  verificationToken,
  adminToken,
  futureSlot,
  localDate,
  localTime,
  bookingPayload,
  closeAll,
};
