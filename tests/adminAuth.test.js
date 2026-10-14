const request = require("supertest");
const {
  buildApp,
  resetDb,
  createAdmin,
  adminToken,
  closeAll,
} = require("./helpers");

let app;
beforeAll(async () => {
  app = await buildApp();
});
beforeEach(resetDb);
afterAll(closeAll);

describe("POST /api/admin/auth/login", () => {
  test("valid credentials return a JWT", async () => {
    const { email, password } = await createAdmin();
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test("wrong password returns 401", async () => {
    const { email } = await createAdmin();
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  test("unknown email and wrong password are indistinguishable", async () => {
    const { email } = await createAdmin();
    const wrongPw = await request(app)
      .post("/api/admin/auth/login")
      .send({ email, password: "nope-nope" });
    const noUser = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: "ghost@test.local", password: "nope-nope" });
    expect(noUser.status).toBe(wrongPw.status);
    expect(noUser.body).toEqual(wrongPw.body);
  });

  test("malformed email is rejected by validation", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: "not-an-email", password: "x" });
    expect(res.status).toBe(400);
  });
});

describe("protected admin routes", () => {
  const path = "/api/admin/bookings";

  test("no token -> 401", async () => {
    expect((await request(app).get(path)).status).toBe(401);
  });

  test("valid admin token -> 200", async () => {
    const res = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
  });

  test("token signed with another secret -> 401", async () => {
    const forged = adminToken({}, "attacker-secret");
    const res = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  test("token without admin role -> 401", async () => {
    const res = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${adminToken({ role: "customer" })}`);
    expect(res.status).toBe(401);
  });
});
