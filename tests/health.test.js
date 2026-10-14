const request = require("supertest");
const { buildApp, closeAll } = require("./helpers");

let app;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(closeAll);

test("GET /health returns ok", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok" });
});

test("GET /ready reports db and redis healthy", async () => {
  const res = await request(app).get("/ready");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ready", checks: { db: "ok", redis: "ok" } });
});
