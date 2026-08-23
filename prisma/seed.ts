// Bootstraps the first Admin member so someone can sign in at all. Not
// subject to CLAUDE.md's activity-log rule for admin edits — that rule
// covers actions taken by an existing admin through the app; this seed
// runs before any member (and thus any possible actor) exists.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [, , email, name] = process.argv;
  if (!email || !name) {
    throw new Error('Usage: prisma db seed -- "<email>" "<name>"');
  }

  const admin = await prisma.member.upsert({
    where: { email },
    update: { name },
    create: { email, name, role: "ADMIN" },
  });

  console.log(`Seeded admin member: ${admin.name} <${admin.email}> (${admin.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
