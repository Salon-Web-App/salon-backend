const request = require("supertest");
const {
  buildApp,
  prisma,
  notificationsQueue,
  resetDb,
  createService,
  createStaff,
  bookingPayload,
  verificationToken,
  closeAll,
} = require("./helpers");

let app;
beforeAll(async () => {
  app = await buildApp();
});
beforeEach(resetDb);
afterAll(closeAll);

const create = (body) => request(app).post("/api/bookings").send(body);

describe("POST /api/bookings", () => {
  test("creates a confirmed booking, assigns staff, queues a notification", async () => {
    const service = await createService();
    const staff = await createStaff([service]);

    const res = await create(bookingPayload(service));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ applicationId: expect.any(String), status: "confirmed" });

    const row = await prisma.booking.findUnique({
      where: { applicationId: res.body.applicationId },
    });
    expect(row.staffId).toBe(staff.id);
    expect(row.phoneVerified).toBe(true);
    expect(row.endTime.getTime() - row.startTime.getTime()).toBe(60 * 60 * 1000);

    const jobs = await notificationsQueue.getJobs(["waiting", "delayed"]);
    expect(
      jobs.some((j) => j.name === "booking.created" && j.data.bookingId === row.id),
    ).toBe(true);
  });

  test("missing / invalid fields -> 400", async () => {
    const service = await createService();
    const res = await create({
      ...bookingPayload(service),
      customerEmail: "not-an-email",
      startTime: "tomorrow",
    });
    expect(res.status).toBe(400);
    expect(await prisma.booking.count()).toBe(0);
  });

  test("token issued for a different contact -> 401", async () => {
    const service = await createService();
    await createStaff([service]);
    const res = await create(
      bookingPayload(service, { verificationToken: verificationToken("+9779811111111") }),
    );
    expect(res.status).toBe(401);
    expect(await prisma.booking.count()).toBe(0);
  });

  test("booking_modify token can't create a booking -> 401", async () => {
    const service = await createService();
    await createStaff([service]);
    const phone = "+9779800000001";
    const res = await create(
      bookingPayload(service, { verificationToken: verificationToken(phone, "booking_modify") }),
    );
    expect(res.status).toBe(401);
  });

  test("unknown service -> 400", async () => {
    const service = await createService();
    const res = await create(
      bookingPayload(service, { serviceId: "00000000-0000-0000-0000-000000000000" }),
    );
    expect(res.status).toBe(400);
  });

  test("no staff offers the service -> 409", async () => {
    const service = await createService();
    const res = await create(bookingPayload(service));
    expect(res.status).toBe(409);
  });

  test("same slot twice with only one staff -> second is 409", async () => {
    const service = await createService();
    await createStaff([service]);
    const body = bookingPayload(service);

    expect((await create(body)).status).toBe(201);
    expect((await create(body)).status).toBe(409);
    expect(await prisma.booking.count()).toBe(1);
  });

  test("assigns a free staff member when another is already booked", async () => {
    const service = await createService();
    const busy = await createStaff([service], { name: "Busy" });
    const free = await createStaff([service], { name: "Free" });
    const body = bookingPayload(service);

    const first = await create(body);
    expect(first.status).toBe(201);
    // Pin the first booking to "busy" regardless of selection order.
    await prisma.booking.update({
      where: { applicationId: first.body.applicationId },
      data: { staffId: busy.id },
    });

    const second = await create(body);
    expect(second.status).toBe(201);
    const row = await prisma.booking.findUnique({
      where: { applicationId: second.body.applicationId },
    });
    expect(row.staffId).toBe(free.id);
  });
});

describe("GET /api/bookings/:applicationId", () => {
  test("returns status without customer contact details", async () => {
    const service = await createService();
    await createStaff([service]);
    const created = await create(bookingPayload(service));

    const res = await request(app).get(`/api/bookings/${created.body.applicationId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      applicationId: created.body.applicationId,
      status: "confirmed",
    });
    const json = JSON.stringify(res.body);
    expect(json).not.toContain("+9779800000001");
    expect(json).not.toContain("customer@test.local");
  });

  test("unknown applicationId -> 404", async () => {
    const res = await request(app).get("/api/bookings/DOES-NOT-EXIST");
    expect(res.status).toBe(404);
  });
});
