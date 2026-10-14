const request = require("supertest");
const {
  buildApp,
  resetDb,
  createService,
  createStaff,
  createBookingRow,
  verificationToken,
  futureSlot,
  localDate,
  localTime,
  closeAll,
} = require("./helpers");

let app;
beforeAll(async () => {
  app = await buildApp();
});
beforeEach(resetDb);
afterAll(closeAll);

const phone = "+9779800000001";
const modifyAuth = {
  verifiedContact: phone,
  verificationToken: verificationToken(phone, "booking_modify"),
};

describe("customer changes to finished bookings", () => {
  test("a completed booking can't be rescheduled", async () => {
    const service = await createService();
    const booking = await createBookingRow({
      serviceId: service.id,
      start: futureSlot(),
      status: "completed",
    });

    const res = await request(app)
      .patch(`/api/bookings/${booking.applicationId}`)
      .send({ ...modifyAuth, startTime: futureSlot(4) });

    expect(res.status).toBe(409);
  });

  test("a cancelled booking can't be cancelled again", async () => {
    const service = await createService();
    const booking = await createBookingRow({
      serviceId: service.id,
      start: futureSlot(),
      status: "cancelled",
    });

    const res = await request(app)
      .delete(`/api/bookings/${booking.applicationId}`)
      .send(modifyAuth);

    expect(res.status).toBe(409);
  });

  test("a soft-deleted booking is not found", async () => {
    const service = await createService();
    const booking = await createBookingRow({
      serviceId: service.id,
      start: futureSlot(),
      deletedAt: new Date(),
    });

    const res = await request(app).get(`/api/bookings/${booking.applicationId}`);
    expect(res.status).toBe(404);
  });
});

describe("availability", () => {
  test("soft-deleted bookings don't block slots, live ones do", async () => {
    const service = await createService();
    const staff = await createStaff([service]);
    const date = localDate();
    const tenAm = localTime(date, "10:00");

    const getSlots = async () =>
      (await request(app).get("/api/availability").query({ serviceId: service.id, date })).body;

    const deleted = await createBookingRow({
      serviceId: service.id,
      staffId: staff.id,
      start: tenAm,
      deletedAt: new Date(),
    });
    expect((await getSlots()).map((s) => s.startTime)).toContain(tenAm);

    await createBookingRow({ serviceId: service.id, staffId: staff.id, start: tenAm });
    expect((await getSlots()).map((s) => s.startTime)).not.toContain(tenAm);
    expect(deleted.deletedAt).not.toBeNull();
  });

  test("invalid date format -> 400", async () => {
    const service = await createService();
    const res = await request(app)
      .get("/api/availability")
      .query({ serviceId: service.id, date: "tomorrow" });
    expect(res.status).toBe(400);
  });
});
