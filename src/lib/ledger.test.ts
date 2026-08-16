import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { getLedgerGrid } from "./ledger";
import type { LedgerEntry, LedgerRow } from "./ledger";
import type { MonthlyDepositModel } from "@/generated/prisma/models/MonthlyDeposit";
import type { AnnualTopupModel } from "@/generated/prisma/models/AnnualTopup";

// Distinguishing prefix so cleanup can find (and only find) rows this file created,
// following the existing pattern in `./deposits.test.ts` / `./topups.test.ts`.
const PREFIX = "ledger-svc-test-";

async function makeMember(suffix: string) {
  return prisma.member.create({
    data: {
      name: `${PREFIX}member-${suffix}`,
      email: `${PREFIX}member-${suffix}@example.com`,
      role: "MEMBER",
    },
  });
}

// Seeded directly with Prisma (not via createDeposit/createTopup) since this
// module is a read-only aggregation and doesn't need activity-log rows —
// keeps the test fast and avoids an activityLog cleanup step entirely.
async function makeDeposit(
  memberId: string,
  month: number,
  year: number,
  amount: number,
  paidDate: string,
): Promise<MonthlyDepositModel> {
  return prisma.monthlyDeposit.create({
    data: { memberId, month, year, amount, paidDate: new Date(paidDate), createdById: memberId },
  });
}

async function makeTopup(
  memberId: string,
  otpNumber: number,
  year: number,
  amount: number,
  paidDate: string,
): Promise<AnnualTopupModel> {
  return prisma.annualTopup.create({
    data: { memberId, year, otpNumber, amount, paidDate: new Date(paidDate), createdById: memberId },
  });
}

describe("getLedgerGrid", () => {
  afterAll(async () => {
    // MonthlyDeposit/AnnualTopup rows reference members via required FKs,
    // so delete them first, in FK-safe order.
    await prisma.monthlyDeposit.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.annualTopup.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("places a deposit and an OTP-1 topup in the right cells, leaving everything else empty", async () => {
    const member = await makeMember("single-cell");
    const deposit = await makeDeposit(member.id, 3, 2026, 250, "2026-03-10");
    const topup = await makeTopup(member.id, 1, 2026, 5000, "2026-04-01");

    const grid = await getLedgerGrid(2026);
    const row = grid.find((r: LedgerRow) => r.memberId === member.id);

    expect(row).toBeDefined();
    expect(row!.months).toHaveLength(12);

    // month 3 => index 2
    expect(row!.months[2]).toHaveLength(1);
    expect(row!.months[2][0]).toMatchObject({
      id: deposit.id,
      amount: 250,
    });
    expect(row!.months[2][0].paidDate).toBeInstanceOf(Date);
    expect(new Date(row!.months[2][0].paidDate).toISOString().slice(0, 10)).toBe("2026-03-10");
    expect(typeof row!.months[2][0].amount).toBe("number");

    // every other month is empty
    for (let i = 0; i < 12; i++) {
      if (i === 2) continue;
      expect(row!.months[i]).toEqual([]);
    }

    expect(row!.otp1).toHaveLength(1);
    expect(row!.otp1[0]).toMatchObject({ id: topup.id, amount: 5000 });
    expect(row!.otp2).toEqual([]);
  });

  it("keeps both rows when a member has two deposits in the same month/year (no unique constraint)", async () => {
    const member = await makeMember("dup-month");
    const depositA = await makeDeposit(member.id, 5, 2026, 100, "2026-05-01");
    const depositB = await makeDeposit(member.id, 5, 2026, 40, "2026-05-15");

    const grid = await getLedgerGrid(2026);
    const row = grid.find((r: LedgerRow) => r.memberId === member.id);

    expect(row).toBeDefined();
    // month 5 => index 4
    expect(row!.months[4]).toHaveLength(2);

    const amounts = row!.months[4]
      .map((e: LedgerEntry) => e.amount)
      .sort((a: number, b: number) => a - b);
    expect(amounts).toEqual([40, 100]);

    const ids = row!.months[4].map((e: LedgerEntry) => e.id);
    expect(ids).toContain(depositA.id);
    expect(ids).toContain(depositB.id);
  });

  it("scopes results strictly to the requested year, excluding a same-month deposit from a different year", async () => {
    const member = await makeMember("year-scope");
    const deposit2025 = await makeDeposit(member.id, 7, 2025, 111, "2025-07-01");
    const deposit2026 = await makeDeposit(member.id, 7, 2026, 222, "2026-07-01");

    const grid = await getLedgerGrid(2026);
    const row = grid.find((r: LedgerRow) => r.memberId === member.id);

    expect(row).toBeDefined();
    // month 7 => index 6
    const ids = row!.months[6].map((e: LedgerEntry) => e.id);
    expect(ids).toContain(deposit2026.id);
    expect(ids).not.toContain(deposit2025.id);
    expect(row!.months[6]).toHaveLength(1);
    expect(row!.months[6][0].amount).toBe(222);
  });

  it("still returns a row with all-empty cells for a member with zero deposits/topups", async () => {
    const member = await makeMember("zero-activity");

    const grid = await getLedgerGrid(2026);
    const row = grid.find((r: LedgerRow) => r.memberId === member.id);

    expect(row).toBeDefined();
    expect(row!.memberName).toBe(member.name);
    expect(row!.months).toHaveLength(12);
    for (const month of row!.months) {
      expect(month).toEqual([]);
    }
    expect(row!.otp1).toEqual([]);
    expect(row!.otp2).toEqual([]);
  });

  it("scopes each member's row to their own data only, without cross-member leakage", async () => {
    const memberA = await makeMember("scope-a");
    const memberB = await makeMember("scope-b");

    const depositA = await makeDeposit(memberA.id, 9, 2026, 700, "2026-09-01");
    const topupB = await makeTopup(memberB.id, 2, 2026, 800, "2026-10-01");

    const grid = await getLedgerGrid(2026);
    const rowA = grid.find((r: LedgerRow) => r.memberId === memberA.id);
    const rowB = grid.find((r: LedgerRow) => r.memberId === memberB.id);

    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();

    // month 9 => index 8
    expect(rowA!.months[8].map((e: LedgerEntry) => e.id)).toEqual([depositA.id]);
    expect(rowB!.months[8]).toEqual([]);

    expect(rowB!.otp2.map((e: LedgerEntry) => e.id)).toEqual([topupB.id]);
    expect(rowA!.otp2).toEqual([]);
    expect(rowA!.otp1).toEqual([]);
  });

  it("returns rows ordered by member name ascending", async () => {
    // Names deliberately created out of alphabetical order.
    const memberZ = await makeMember("zzz-order");
    const memberA = await makeMember("aaa-order");
    const memberM = await makeMember("mmm-order");

    const grid = await getLedgerGrid(2026);
    const testIds = new Set([memberZ.id, memberA.id, memberM.id]);
    const testRows = grid.filter((r: LedgerRow) => testIds.has(r.memberId));

    expect(testRows.map((r: LedgerRow) => r.memberId)).toEqual([memberA.id, memberM.id, memberZ.id]);
  });
});
