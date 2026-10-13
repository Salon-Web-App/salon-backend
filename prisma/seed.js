// Creates (or updates) the single admin user from ADMIN_EMAIL /
// ADMIN_PASSWORD in .env. Safe to re-run — it upserts, so running it again
// after changing ADMIN_PASSWORD in .env will reset the password.
//
// Usage: npm run seed
require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env before seeding.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('ADMIN_PASSWORD should be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, role: 'admin' },
  });

  console.log(`Admin user ready: ${admin.email} (id: ${admin.id})`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
