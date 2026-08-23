import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { getNextPaymentDue, getPaidMonths, getUnpaidMembers } from "./payment-status";

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

describe("getNextPaymentDue", () => {
  // Pure function over a given date — no DB access needed.
  it("returns the 1st of the following month", () => {
    const due = getNextPaymentDue(new Date("2026-08-20T00:00:00.000Z"));
    expect(due.toISOString()).toBe(new Date("2026-09-01T00:00:00.000Z").toISOString());
  });

  it("rolls over into the next year from December", () => {
    const due = getNextPaymentDue(new Date("2026-12-05T00:00:00.000Z"));
    expect(due.toISOString()).toBe(new Date("2027-01-01T00:00:00.000Z").toISOString());
  });

  it("uses UTC fields, matching how dates are stored and formatted elsewhere", () => {
    const due = getNextPaymentDue(new Date("2026-01-31T23:00:00.000Z"));
    expect(due.getUTCFullYear()).toBe(2026);
    expect(due.getUTCMonth()).toBe(1); // February, 0-indexed
    expect(due.getUTCDate()).toBe(1);
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
    // FK-safe order: MemberShare and MonthlyDeposit reference members via
    // required FKs, so delete them first (same pattern as member-shares.test.ts).
    await prisma.memberShare.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
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

  // effectiveFrom dates below are fixed in the past (well before any
  // plausible test run date) so `getShareCountAsOf` resolves them against
  // "now" the same way regardless of when the suite runs.
  it("includes the member's current shareCount, from a single share row", async () => {
    const member = await makeMember("one-share");

    await prisma.memberShare.create({
      data: { memberId: member.id, shareCount: 3, effectiveFrom: new Date("2020-01-01") },
    });

    const unpaid = await getUnpaidMembers(8, 2026);
    const found = unpaid.find((m) => m.id === member.id);

    expect(found).toBeDefined();
    expect(found?.shareCount).toBe(3);
  });

  it("uses the latest share row when share count changed over time, ignoring the older one", async () => {
    const member = await makeMember("share-history");

    await prisma.memberShare.create({
      data: { memberId: member.id, shareCount: 1, effectiveFrom: new Date("2020-01-01") },
    });
    await prisma.memberShare.create({
      data: { memberId: member.id, shareCount: 5, effectiveFrom: new Date("2022-01-01") },
    });

    const unpaid = await getUnpaidMembers(8, 2026);
    const found = unpaid.find((m) => m.id === member.id);

    expect(found).toBeDefined();
    expect(found?.shareCount).toBe(5);
  });

  it("returns shareCount 0 for a member with no share history", async () => {
    const member = await makeMember("no-shares");

    const unpaid = await getUnpaidMembers(8, 2026);
    const found = unpaid.find((m) => m.id === member.id);

    expect(found).toBeDefined();
    expect(found?.shareCount).toBe(0);
  });
});
