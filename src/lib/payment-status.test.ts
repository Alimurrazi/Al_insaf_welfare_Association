import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { getPaidMonths, getUnpaidMembers } from "./payment-status";

describe("getPaidMonths", () => {
  // Pure function over an already-fetched deposit list (e.g. from
  // getMemberLedger) — no DB access, so plain fixture objects suffice.
  it("returns the set of months paid in the given year", () => {
    const deposits = [
      { month: 1, year: 2026 },
      { month: 3, year: 2026 },
      { month: 12, year: 2025 },
    ];
    expect(getPaidMonths(deposits, 2026)).toEqual(new Set([1, 3]));
  });

  it("excludes deposits from other years", () => {
    const deposits = [{ month: 6, year: 2025 }];
    expect(getPaidMonths(deposits, 2026)).toEqual(new Set());
  });

  it("returns an empty set for no deposits", () => {
    expect(getPaidMonths([], 2026)).toEqual(new Set());
  });

  it("de-duplicates a month paid more than once (e.g. a correction)", () => {
    const deposits = [
      { month: 4, year: 2026 },
      { month: 4, year: 2026 },
    ];
    expect(getPaidMonths(deposits, 2026)).toEqual(new Set([4]));
  });
});

describe("getUnpaidMembers", () => {
  const PREFIX = "payment-status-svc-test-";

  async function makeMember(suffix: string) {
    return prisma.member.create({
      data: { name: `${PREFIX}${suffix}`, email: `${PREFIX}${suffix}@example.com`, role: "MEMBER" },
    });
  }

  afterAll(async () => {
    await prisma.monthlyDeposit.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("returns only members with no deposit for the given month/year", async () => {
    const paidMember = await makeMember("paid");
    const unpaidMember = await makeMember("unpaid");

    await prisma.monthlyDeposit.create({
      data: {
        memberId: paidMember.id,
        month: 8,
        year: 2026,
        amount: 3000,
        paidDate: new Date("2026-08-05"),
        createdById: paidMember.id,
      },
    });

    const unpaid = await getUnpaidMembers(8, 2026);
    const unpaidIds = unpaid.map((m) => m.id);

    expect(unpaidIds).toContain(unpaidMember.id);
    expect(unpaidIds).not.toContain(paidMember.id);
  });

  it("does not count a deposit for a different month/year as paid", async () => {
    const member = await makeMember("wrong-month");

    await prisma.monthlyDeposit.create({
      data: {
        memberId: member.id,
        month: 7,
        year: 2026,
        amount: 3000,
        paidDate: new Date("2026-07-05"),
        createdById: member.id,
      },
    });

    const unpaid = await getUnpaidMembers(8, 2026);
    expect(unpaid.map((m) => m.id)).toContain(member.id);
  });
});
