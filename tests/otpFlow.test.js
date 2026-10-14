jest.mock("../src/utils/otpCode", () => ({ generateOtpCode: () => "123456" }));

const request = require("supertest");
const {
  buildApp,
  resetDb,
  createService,
  createStaff,
  futureSlot,
  closeAll,
} = require("./helpers");

let app;
beforeAll(async () => {
  app = await buildApp();
});
beforeEach(resetDb);
afterAll(closeAll);

const contact = "+9779800000099";

test("send -> verify -> create booking with the issued token", async () => {
  const service = await createService();
  await createStaff([service]);

  const sent = await request(app)
    .post("/api/otp/send")
    .send({ contact, channel: "sms", purpose: "booking_create" });
  expect(sent.status).toBe(200);

  const wrong = await request(app)
    .post("/api/otp/verify")
    .send({ contact, otp: "000000", purpose: "booking_create" });
  expect(wrong.status).toBe(400);

  const verified = await request(app)
    .post("/api/otp/verify")
    .send({ contact, otp: "123456", purpose: "booking_create" });
  expect(verified.status).toBe(200);
  expect(verified.body.verificationToken).toEqual(expect.any(String));

  const booking = await request(app).post("/api/bookings").send({
    customerName: "OTP Customer",
    customerPhone: contact,
    customerEmail: "otp@test.local",
    serviceId: service.id,
    startTime: futureSlot(),
    verifiedContact: contact,
    verificationToken: verified.body.verificationToken,
  });
  expect(booking.status).toBe(201);
});

test("an OTP can only be used once", async () => {
  await request(app)
    .post("/api/otp/send")
    .send({ contact, channel: "sms", purpose: "booking_create" });
  const first = await request(app)
    .post("/api/otp/verify")
    .send({ contact, otp: "123456", purpose: "booking_create" });
  const second = await request(app)
    .post("/api/otp/verify")
    .send({ contact, otp: "123456", purpose: "booking_create" });
  expect(first.status).toBe(200);
  expect(second.status).toBe(400);
});
