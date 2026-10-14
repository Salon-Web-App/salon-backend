const request = require("supertest");
const {
  buildApp,
  prisma,
  resetDb,
  createService,
  createBookingRow,
  futureSlot,
  closeAll,
} = require("./helpers");

let app;
beforeAll(async () => {
  app = await buildApp();
});
beforeEach(resetDb);
afterAll(closeAll);

async function completedBooking(customerName = "Sita Kumari Sharma") {
  const service = await createService({ name: "Bridal Makeup" });
  return createBookingRow({
    serviceId: service.id,
    start: futureSlot(-3),
    status: "completed",
    customerName,
  });
}

describe("POST /api/reviews", () => {
  test("one review per booking: the second is 409", async () => {
    const booking = await completedBooking();
    const body = { applicationId: booking.applicationId, rating: 5, comment: "Lovely" };

    expect((await request(app).post("/api/reviews").send(body)).status).toBe(201);
    expect((await request(app).post("/api/reviews").send(body)).status).toBe(409);
    expect(await prisma.review.count()).toBe(1);
  });

  test("a booking that isn't completed can't be reviewed", async () => {
    const service = await createService();
    const booking = await createBookingRow({ serviceId: service.id, start: futureSlot() });

    const res = await request(app)
      .post("/api/reviews")
      .send({ applicationId: booking.applicationId, rating: 5 });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/reviews", () => {
  test("returns approved reviews with a shortened name, in admin order", async () => {
    const first = await completedBooking("Sita Kumari Sharma");
    const second = await completedBooking("Gita");
    await prisma.review.create({
      data: { bookingId: first.id, rating: 5, comment: "A", approved: true, order: 2 },
    });
    await prisma.review.create({
      data: { bookingId: second.id, rating: 4, comment: "B", approved: true, order: 1 },
    });

    const res = await request(app).get("/api/reviews");

    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.comment)).toEqual(["B", "A"]);
    expect(res.body[1]).toMatchObject({
      customerName: "Sita S.",
      serviceName: "Bridal Makeup",
      rating: 5,
    });
    expect(res.body[0].customerName).toBe("Gita");
    expect(JSON.stringify(res.body)).not.toContain("Sharma");
  });

  test("unapproved reviews are hidden", async () => {
    const booking = await completedBooking();
    await prisma.review.create({ data: { bookingId: booking.id, rating: 1, approved: false } });

    const res = await request(app).get("/api/reviews");
    expect(res.body).toEqual([]);
  });
});
