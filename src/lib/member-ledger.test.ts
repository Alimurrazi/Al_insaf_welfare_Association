import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { MemberNotFoundError } from "./members";
import { getMemberLedger } from "./member-ledger";
import { getShareCountAsOf } from "./member-shares";
import type { MonthlyDepositModel } from "@/generated/prisma/models/MonthlyDeposit";
import type { AnnualTopupModel } from "@/generated/prisma/models/AnnualTopup";
import type { MemberShareModel } from "@/generated/prisma/models/MemberShare";

// Distinguishing prefix so cleanup can find (and only find) rows this file created,
// following the existing pattern in `./deposits.test.ts` / `./member-shares.test.ts`.
const PREFIX = "member-ledger-svc-test-";

async function makeActor(suffix: string) {
  return prisma.member.create({
    data: { name: `${PREFIX}actor-${suffix}`, email: `${PREFIX}actor-${suffix}@example.com`, role: "ADMIN" },
  });
}

async function makeTargetMember(suffix: string) {
  return prisma.member.create({
    data: { name: `${PREFIX}target-${suffix}`, email: `${PREFIX}target-${suffix}@example.com`, role: "MEMBER" },
  });
}

// Seeded directly with Prisma (not via createDeposit/createTopup/addMemberShare),
// since this module is a read-only aggregation and doesn't need activity-log
// rows — mirrors `./ledger.test.ts`'s lightweight-seeding approach. createdById
// is a required FK on MonthlyDeposit/AnnualTopup, so every call needs an actor id.
async function makeDeposit(
  actorId: string,
  memberId: string,
  month: number,
  year: number,
  amount: number,
  paidDate: string,
) {
  return prisma.monthlyDeposit.create({
    data: { memberId, month, year, amount, paidDate: new Date(paidDate), createdById: actorId },
  });
}

async function makeTopup(
  actorId: string,
  memberId: string,
  otpNumber: number,
  year: number,
  amount: number,
  paidDate: string,
) {
  return prisma.annualTopup.create({
    data: { memberId, year, otpNumber, amount, paidDate: new Date(paidDate), createdById: actorId },
  });
}

async function makeShare(memberId: string, shareCount: number, effectiveFrom: string) {
  return prisma.memberShare.create({
    data: { memberId, shareCount, effectiveFrom: new Date(effectiveFrom) },
  });
}

describe("getMemberLedger", () => {
  afterAll(async () => {
    // MonthlyDeposit/AnnualTopup/MemberShare rows reference members via required FKs,
    // so delete them first, in FK-safe order.
    await prisma.monthlyDeposit.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.annualTopup.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.memberShare.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("returns full history, correct totalPaid, and correct currentShareCount for a member with deposits, topups, and share history", async () => {
    const actor = await makeActor("happy");
    const member = await makeTargetMember("happy");

    const depositA = await makeDeposit(actor.id, member.id, 1, 2026, 100, "2026-01-01");
    const depositB = await makeDeposit(actor.id, member.id, 2, 2026, 150, "2026-02-01");
    const topupA = await makeTopup(actor.id, member.id, 1, 2026, 5000, "2026-01-15");
    const topupB = await makeTopup(actor.id, member.id, 2, 2026, 6000, "2026-06-15");
    const shareA = await makeShare(member.id, 1, "2024-01-01");
    const shareB = await makeShare(member.id, 3, "2026-01-01");

    const asOfDate = new Date("2026-06-01");
    const ledger = await getMemberLedger(member.id, asOfDate);

    expect(ledger.member.id).toBe(member.id);
    expect(ledger.member.name).toBe(member.name);
    expect(ledger.member.email).toBe(member.email);
    expect(new Date(ledger.member.joinDate).toISOString()).toBe(new Date(member.joinDate).toISOString());

    expect(ledger.deposits).toHaveLength(2);
    expect(ledger.deposits.map((d: MonthlyDepositModel) => d.id).sort()).toEqual(
      [depositA.id, depositB.id].sort(),
    );

    expect(ledger.topups).toHaveLength(2);
    expect(ledger.topups.map((t: AnnualTopupModel) => t.id).sort()).toEqual(
      [topupA.id, topupB.id].sort(),
    );

    expect(ledger.shareHistory).toHaveLength(2);
    expect(ledger.shareHistory.map((s: MemberShareModel) => s.id).sort()).toEqual(
      [shareA.id, shareB.id].sort(),
    );

    expect(typeof ledger.totalPaid).toBe("number");
    expect(ledger.totalPaid).toBe(100 + 150 + 5000 + 6000);

    const expectedShareCount = getShareCountAsOf(
      [
        { shareCount: shareA.shareCount, effectiveFrom: shareA.effectiveFrom },
        { shareCount: shareB.shareCount, effectiveFrom: shareB.effectiveFrom },
      ],
      asOfDate,
    );
    expect(ledger.currentShareCount).toBe(expectedShareCount);
    expect(ledger.currentShareCount).toBe(3);
  });

  it("returns totalPaid of 0 (not NaN) for a member with no deposits/topups but with share history", async () => {
    const member = await makeTargetMember("zero-paid");
    await makeShare(member.id, 2, "2025-01-01");

    const ledger = await getMemberLedger(member.id, new Date("2026-01-01"));

    expect(ledger.deposits).toEqual([]);
    expect(ledger.topups).toEqual([]);
    expect(ledger.totalPaid).toBe(0);
    expect(Number.isNaN(ledger.totalPaid)).toBe(false);
    expect(ledger.currentShareCount).toBe(2);
  });

  it("rejects an unknown memberId with MemberNotFoundError", async () => {
    await expect(getMemberLedger("does-not-exist-id", new Date("2026-01-01"))).rejects.toThrow(
      MemberNotFoundError,
    );
  });

  it("computes currentShareCount relative to the given asOfDate, not the real current date", async () => {
    const member = await makeTargetMember("as-of");
    await makeShare(member.id, 1, "2024-01-01");
    await makeShare(member.id, 3, "2026-01-01");

    const earlyLedger = await getMemberLedger(member.id, new Date("2025-01-01"));
    expect(earlyLedger.currentShareCount).toBe(1);

    const laterLedger = await getMemberLedger(member.id, new Date("2026-06-01"));
    expect(laterLedger.currentShareCount).toBe(3);
  });

  it("scopes deposits, topups, and shareHistory strictly to the requested member, without cross-member leakage", async () => {
    const actor = await makeActor("scope");
    const member = await makeTargetMember("scope-target");
    const otherMember = await makeTargetMember("scope-other");

    const memberDeposit = await makeDeposit(actor.id, member.id, 4, 2026, 111, "2026-04-01");
    const memberTopup = await makeTopup(actor.id, member.id, 1, 2026, 2222, "2026-04-01");
    const memberShare = await makeShare(member.id, 5, "2026-01-01");

    await makeDeposit(actor.id, otherMember.id, 4, 2026, 999, "2026-04-01");
    await makeTopup(actor.id, otherMember.id, 1, 2026, 8888, "2026-04-01");
    await makeShare(otherMember.id, 9, "2026-01-01");

    const ledger = await getMemberLedger(member.id, new Date("2026-06-01"));

    expect(ledger.deposits).toHaveLength(1);
    expect(ledger.deposits[0].id).toBe(memberDeposit.id);

    expect(ledger.topups).toHaveLength(1);
    expect(ledger.topups[0].id).toBe(memberTopup.id);

    expect(ledger.shareHistory).toHaveLength(1);
    expect(ledger.shareHistory[0].id).toBe(memberShare.id);

    expect(ledger.totalPaid).toBe(111 + 2222);
    expect(ledger.currentShareCount).toBe(5);
  });
});
