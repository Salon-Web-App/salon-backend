const { execSync } = require("node:child_process");

module.exports = async () => {
  const url = process.env.DATABASE_URL || "";
  // Tests truncate every table.
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error(`Refusing to run tests against non-test database: ${url}`);
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
};
