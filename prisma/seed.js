// Creates the admin user from ADMIN_EMAIL / ADMIN_PASSWORD. Safe to re-run:
// an existing admin is left untouched unless SEED_RESET_ADMIN_PASSWORD=true.
//
// Usage: npm run db:seed
if (process.env.NODE_ENV !== "production") require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const resetPassword = process.env.SEED_RESET_ADMIN_PASSWORD === "true";

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (existing && !resetPassword) {
    console.log(`Admin ${email} already exists, leaving password unchanged.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, role: "admin" },
  });

  console.log(
    existing ? `Admin ${email} password reset.` : `Admin ${email} created.`,
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
