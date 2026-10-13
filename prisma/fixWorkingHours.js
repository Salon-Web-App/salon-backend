// One-time repair for Staff rows whose workingHours was accidentally
// stored as a JSON string instead of an object (see setupAdmin.js fix).
// Safe to run multiple times — it skips rows that are already objects.
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.staff.findMany();
  let fixed = 0;

  for (const member of staff) {
    if (typeof member.workingHours === "string") {
      try {
        const parsed = JSON.parse(member.workingHours);
        await prisma.staff.update({
          where: { id: member.id },
          data: { workingHours: parsed },
        });
        console.log(`Fixed ${member.name} (${member.id})`);
        fixed += 1;
      } catch (err) {
        console.error(
          `Could not parse workingHours for ${member.name} (${member.id}):`,
          member.workingHours,
        );
      }
    }
  }

  console.log(`Done. Fixed ${fixed} record(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
