import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { getDashboardSummary } from "./dashboard";

// Distinguishing prefix so cleanup can find (and only find) rows this file
// created, following the existing pattern in `./deposits.test.ts`.
const PREFIX = "dashboard-svc-test-";

async function makeMember(suffix: string) {
  return prisma.member.create({
    data: { name: `${PREFIX}${suffix}`, email: `${PREFIX}${suffix}@example.com`, role: "MEMBER" },
  });
}

describe("getDashboardSummary", () => {
  afterAll(async () => {
    await prisma.monthlyDeposit.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.annualTopup.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.expense.deleteMany({ where: { createdBy: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("sums deposits + topups as totalCollected, expenses as totalSpent, and computes balance", async () => {
    const member = await makeMember("summary");

    await prisma.monthlyDeposit.create({
      data: { memberId: member.id, month: 1, year: 2026, amount: 3000, paidDate: new Date("2026-01-01"), createdById: member.id },
    });
    await prisma.monthlyDeposit.create({
      data: { memberId: member.id, month: 2, year: 2026, amount: 3000, paidDate: new Date("2026-02-01"), createdById: member.id },
    });
    await prisma.annualTopup.create({
      data: { memberId: member.id, year: 2026, otpNumber: 1, amount: 7000, paidDate: new Date("2026-01-15"), createdById: member.id },
    });
    await prisma.expense.create({
      data: { date: new Date("2026-01-20"), category: "Land survey", amount: 2000, createdById: member.id },
    });

    const before = await getDashboardSummary();

    // Re-fetch after adding more to confirm the deltas are exactly what we added
    // (rather than asserting exact totals, which would break as soon as other
    // tests/seed data touch these global tables).
    await prisma.monthlyDeposit.create({
      data: { memberId: member.id, month: 3, year: 2026, amount: 500, paidDate: new Date("2026-03-01"), createdById: member.id },
    });
    await prisma.expense.create({
      data: { date: new Date("2026-02-01"), category: "Legal fees", amount: 300, createdById: member.id },
    });

    const after = await getDashboardSummary();

    expect(after.totalCollected - before.totalCollected).toBe(500);
    expect(after.totalSpent - before.totalSpent).toBe(300);
    expect(after.balance - before.balance).toBe(200);

    expect(typeof after.totalCollected).toBe("number");
    expect(typeof after.totalSpent).toBe("number");
    expect(typeof after.balance).toBe("number");
    expect(after.balance).toBe(after.totalCollected - after.totalSpent);
  });
});
