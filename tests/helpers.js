// Shared test utilities: app factory, database reset, data factories,
// token helpers, and teardown.
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const buildApp = require("../src/app");
const prisma = require("../src/lib/prisma");
const redis = require("../src/lib/redis");
const { notificationsQueue, maintenanceQueue } = require("../src/jobs/queue");

async function resetDb() {
  // CASCADE also clears BookingHistory, Review and the implicit
  // Staff<->Service / Package<->Service join tables.
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Booking", "Staff", "Service", "Package", "AdminUser", "Transformation" CASCADE',
  );
  await redis.flushdb(); // OTPs, rate-limit counters, sessions, queued jobs
}

function createService(overrides = {}) {
  return prisma.service.create({
    data: {
      name: "Bridal Makeup",
      price: "5000",
      durationMinutes: 60,
      ...overrides,
    },
  });
}

function createStaff(services = [], overrides = {}) {
  return prisma.staff.create({
    data: {
      name: "Asha",
      services: { connect: services.map((s) => ({ id: s.id })) },
      ...overrides,
    },
  });
}

async function createAdmin(
  email = "admin@test.local",
  password = "correct-horse-battery",
) {
  const passwordHash = await bcrypt.hash(password, 4); // low cost: fast tests
  await prisma.adminUser.create({
    data: { email, passwordHash, role: "admin" },
  });
  return { email, password };
}

// Same token POST /api/otp/verify issues. Lets booking tests skip the OTP
// round-trip; the real round-trip is covered in otpFlow.test.js.
function verificationToken(
  contact,
  purpose = "booking_create",
  secret = process.env.JWT_SECRET,
) {
  return jwt.sign({ contact, purpose }, secret, { expiresIn: "10m" });
}

function adminToken(overrides = {}, secret = process.env.JWT_SECRET) {
  return jwt.sign(
    {
      sub: "test-admin",
      email: "admin@test.local",
      role: "admin",
      ...overrides,
    },
    secret,
    { expiresIn: "1h", algorithm: "HS256" },
  );
}

// A fixed slot a few days ahead, so tests don't depend on the current time.
function futureSlot(daysAhead = 3, hourUtc = 5) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
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
  await Promise.allSettled([
    notificationsQueue.close(),
    maintenanceQueue.close(),
  ]);
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
  createStaff,
  createAdmin,
  verificationToken,
  adminToken,
  futureSlot,
  bookingPayload,
  closeAll,
};
