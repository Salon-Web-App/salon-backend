// Runs once before all test files: applies migrations to the test database.
const { execSync } = require("node:child_process");

module.exports = async () => {
  const url = process.env.DATABASE_URL || "";
  // Tests TRUNCATE every table. Refuse to run against anything that isn't
  // obviously a test database.
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error(`Refusing to run tests against non-test database: ${url}`);
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
};
