const request = require("supertest");
const {
  buildApp,
  prisma,
  resetDb,
  createService,
  createPackage,
  createStaff,
  verificationToken,
  futureSlot,
  localDate,
  closeAll,
} = require("./helpers");

let app;
beforeAll(async () => {
  app = await buildApp();
});
beforeEach(resetDb);
afterAll(closeAll);

async function packageSetup() {
  const makeup = await createService({ name: "Makeup" });
  const hair = await createService({ name: "Hair" });
  const both = await createStaff([makeup, hair], { name: "Both" });
  const makeupOnly = await createStaff([makeup], { name: "Makeup Only" });
  const pkg = await createPackage([makeup, hair]);
  return { pkg, both, makeupOnly };
}

const phone = "+9779800000001";
const packageBooking = (pkg, overrides = {}) => ({
  customerName: "Test Customer",
  customerPhone: phone,
  customerEmail: "customer@test.local",
  packageId: pkg.id,
  startTime: futureSlot(),
  verifiedContact: phone,
  verificationToken: verificationToken(phone),
  ...overrides,
});

describe("GET /api/availability with a package", () => {
  test("only offers slots from staff who do every service in the package", async () => {
    const { pkg, both } = await packageSetup();

    const res = await request(app)
      .get("/api/availability")
      .query({ packageId: pkg.id, date: localDate() });

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const slot of res.body) {
      expect(slot.staffId).toBe(both.id);
      expect(new Date(slot.endTime) - new Date(slot.startTime)).toBe(90 * 60 * 1000);
    }
  });

  test("unknown package -> 404", async () => {
    const res = await request(app)
      .get("/api/availability")
      .query({ packageId: "00000000-0000-0000-0000-000000000000", date: localDate() });
    expect(res.status).toBe(404);
  });

  test("serviceId and packageId together -> 400", async () => {
    const res = await request(app)
      .get("/api/availability")
      .query({ serviceId: "a", packageId: "b", date: localDate() });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/bookings with a package", () => {
  test("creates the booking with the package duration and a qualified staff member", async () => {
    const { pkg, both } = await packageSetup();

    const res = await request(app).post("/api/bookings").send(packageBooking(pkg));

    expect(res.status).toBe(201);
    const row = await prisma.booking.findUnique({
      where: { applicationId: res.body.applicationId },
    });
    expect(row.packageId).toBe(pkg.id);
    expect(row.serviceId).toBeNull();
    expect(row.staffId).toBe(both.id);
    expect(row.endTime - row.startTime).toBe(90 * 60 * 1000);
  });

  test("serviceId and packageId together -> 400", async () => {
    const { pkg } = await packageSetup();
    const res = await request(app)
      .post("/api/bookings")
      .send(packageBooking(pkg, { serviceId: pkg.id }));
    expect(res.status).toBe(400);
  });

  test("neither serviceId nor packageId -> 400", async () => {
    const { pkg } = await packageSetup();
    const res = await request(app)
      .post("/api/bookings")
      .send(packageBooking(pkg, { packageId: undefined }));
    expect(res.status).toBe(400);
  });
});
