const request = require("supertest");
const {
  buildApp,
  resetDb,
  createService,
  createPackage,
  createStaff,
  createBookingRow,
  adminToken,
  futureSlot,
  closeAll,
} = require("./helpers");

let app;
beforeAll(async () => {
  app = await buildApp();
});
beforeEach(resetDb);
afterAll(closeAll);

const auth = () => ({ Authorization: `Bearer ${adminToken()}` });

describe("PATCH /api/admin/bookings/:id/status", () => {
  test("rejects an unknown status", async () => {
    const service = await createService();
    const booking = await createBookingRow({ serviceId: service.id, start: futureSlot() });

    const res = await request(app)
      .patch(`/api/admin/bookings/${booking.id}/status`)
      .set(auth())
      .send({ status: "whatever" });

    expect(res.status).toBe(400);
  });

  test("a completed booking can't change status", async () => {
    const service = await createService();
    const booking = await createBookingRow({
      serviceId: service.id,
      start: futureSlot(),
      status: "completed",
    });

    const res = await request(app)
      .patch(`/api/admin/bookings/${booking.id}/status`)
      .set(auth())
      .send({ status: "cancelled" });

    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/admin/bookings/:id/reschedule", () => {
  test("works for package bookings and keeps the package duration", async () => {
    const service = await createService();
    const pkg = await createPackage([service], { durationMinutes: 90 });
    const booking = await createBookingRow({
      packageId: pkg.id,
      start: futureSlot(),
      minutes: 90,
    });

    const res = await request(app)
      .patch(`/api/admin/bookings/${booking.id}/reschedule`)
      .set(auth())
      .send({ startTime: futureSlot(5) });

    expect(res.status).toBe(200);
    expect(new Date(res.body.endTime) - new Date(res.body.startTime)).toBe(90 * 60 * 1000);
  });

  test("won't double-book the assigned staff member", async () => {
    const service = await createService();
    const staff = await createStaff([service]);
    await createBookingRow({ serviceId: service.id, staffId: staff.id, start: futureSlot(5) });
    const booking = await createBookingRow({
      serviceId: service.id,
      staffId: staff.id,
      start: futureSlot(3),
    });

    const res = await request(app)
      .patch(`/api/admin/bookings/${booking.id}/reschedule`)
      .set(auth())
      .send({ startTime: futureSlot(5) });

    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/admin/bookings/:id/assign-staff", () => {
  test("won't assign staff who are busy at that time", async () => {
    const service = await createService();
    const busy = await createStaff([service], { name: "Busy" });
    await createBookingRow({ serviceId: service.id, staffId: busy.id, start: futureSlot() });
    const booking = await createBookingRow({ serviceId: service.id, start: futureSlot() });

    const res = await request(app)
      .patch(`/api/admin/bookings/${booking.id}/assign-staff`)
      .set(auth())
      .send({ staffId: busy.id });

    expect(res.status).toBe(409);
  });
});
