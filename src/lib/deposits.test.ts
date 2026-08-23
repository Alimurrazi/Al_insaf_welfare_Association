import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { MemberNotFoundError } from "./members";
import {
  createDeposit,
  DepositNotFoundError,
  filterDeposits,
  listDeposits,
  listDepositsForMember,
  updateDeposit,
  validateDepositInput,
} from "./deposits";
import type { MonthlyDepositModel } from "@/generated/prisma/models/MonthlyDeposit";

// Distinguishing prefix so cleanup can find (and only find) rows this file created,
// following the existing pattern in `./members.test.ts` and `./member-shares.test.ts`.
const PREFIX = "deposits-svc-test-";

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

describe("deposits service", () => {
  afterAll(async () => {
    // ActivityLog and MonthlyDeposit rows reference members via required FKs,
    // so delete them first, in FK-safe order.
    await prisma.activityLog.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
    await prisma.monthlyDeposit.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  describe("validateDepositInput", () => {
    it("rejects a missing memberId", () => {
      const error = validateDepositInput(
        { month: 1, year: 2026, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects an empty-string memberId", () => {
      const error = validateDepositInput(
        { memberId: "", month: 1, year: 2026, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a month of 0", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 0, year: 2026, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a month of 13", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 13, year: 2026, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a non-integer month", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 1.5, year: 2026, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a year below 2000", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 1, year: 1999, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a non-integer year", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 1, year: 2026.5, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a zero amount", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 1, year: 2026, amount: 0, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a negative amount", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 1, year: 2026, amount: -50, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a non-numeric amount", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 1, year: 2026, amount: "100", paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a missing paidDate", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 1, year: 2026, amount: 100 },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects an invalid paidDate", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 1, year: 2026, amount: 100, paidDate: "not-a-date" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a non-string note when present", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 1, year: 2026, amount: 100, paidDate: "2026-01-01", note: 123 },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("accepts a fully valid combination", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 1, year: 2026, amount: 100, paidDate: "2026-01-01", note: "on time" },
        { partial: false },
      );
      expect(error).toBeNull();
    });

    it("accepts a valid combination with a Date instance for paidDate", () => {
      const error = validateDepositInput(
        { memberId: "m1", month: 1, year: 2026, amount: 100, paidDate: new Date("2026-01-01") },
        { partial: false },
      );
      expect(error).toBeNull();
    });

    it("in partial mode, an empty object is valid", () => {
      const error = validateDepositInput({}, { partial: true });
      expect(error).toBeNull();
    });

    it("in partial mode, a present-and-invalid field is still rejected", () => {
      const error = validateDepositInput({ amount: -5 }, { partial: true });
      expect(typeof error).toBe("string");
    });

    it("in partial mode, a present-and-invalid month is still rejected", () => {
      const error = validateDepositInput({ month: 13 }, { partial: true });
      expect(typeof error).toBe("string");
    });
  });

  describe("createDeposit", () => {
    it("creates the row and writes a correct ActivityLog CREATE row", async () => {
      const actor = await makeActor("create-1");
      const member = await makeTargetMember("create-1");
      const paidDate = new Date("2026-01-05");

      const created = await createDeposit(actor.id, {
        memberId: member.id,
        month: 1,
        year: 2026,
        amount: 500,
        paidDate,
        note: "January deposit",
      });

      expect(created.memberId).toBe(member.id);
      expect(created.month).toBe(1);
      expect(created.year).toBe(2026);
      expect(Number(created.amount)).toBe(500);
      expect(created.note).toBe("January deposit");
      expect(created.createdById).toBe(actor.id);

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "MonthlyDeposit", entityId: created.id, action: "CREATE" },
      });

      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(actor.id);
      expect(log?.oldValue).toBeNull();
      expect(log?.newValue).toMatchObject({
        memberId: member.id,
        month: 1,
        year: 2026,
        note: "January deposit",
      });
    });

    it("rejects an unknown memberId", async () => {
      const actor = await makeActor("create-unknown");

      await expect(
        createDeposit(actor.id, {
          memberId: "does-not-exist-id",
          month: 2,
          year: 2026,
          amount: 200,
          paidDate: new Date("2026-02-01"),
        }),
      ).rejects.toThrow(MemberNotFoundError);
    });
  });

  describe("updateDeposit", () => {
    it("updates fields and writes an ActivityLog UPDATE row with old vs new values", async () => {
      const actor = await makeActor("update-1");
      const member = await makeTargetMember("update-1");

      const deposit = await createDeposit(actor.id, {
        memberId: member.id,
        month: 3,
        year: 2026,
        amount: 300,
        paidDate: new Date("2026-03-01"),
        note: "typo'd amount",
      });

      const updated = await updateDeposit(actor.id, deposit.id, {
        amount: 350,
        note: "corrected amount",
      });

      expect(Number(updated.amount)).toBe(350);
      expect(updated.note).toBe("corrected amount");
      // Untouched fields should be preserved.
      expect(updated.month).toBe(3);
      expect(updated.year).toBe(2026);

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "MonthlyDeposit", entityId: deposit.id, action: "UPDATE" },
        orderBy: { createdAt: "desc" },
      });

      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(actor.id);
      expect(log?.oldValue).toMatchObject({ note: "typo'd amount" });
      expect(log?.newValue).toMatchObject({ note: "corrected amount" });
    });

    it("rejects an unknown deposit id", async () => {
      const actor = await makeActor("update-unknown");

      await expect(
        updateDeposit(actor.id, "does-not-exist-id", { amount: 100 }),
      ).rejects.toThrow(DepositNotFoundError);
    });
  });

  describe("listDeposits", () => {
    it("returns deposits ordered most-recent first (year desc, then month desc)", async () => {
      const actor = await makeActor("list-1");
      const member = await makeTargetMember("list-1");

      const depositA = await createDeposit(actor.id, {
        memberId: member.id,
        month: 6,
        year: 2025,
        amount: 100,
        paidDate: new Date("2025-06-01"),
      });
      const depositB = await createDeposit(actor.id, {
        memberId: member.id,
        month: 1,
        year: 2026,
        amount: 100,
        paidDate: new Date("2026-01-01"),
      });
      const depositC = await createDeposit(actor.id, {
        memberId: member.id,
        month: 3,
        year: 2026,
        amount: 100,
        paidDate: new Date("2026-03-01"),
      });

      const deposits = await listDeposits();
      const testIds = new Set([depositA.id, depositB.id, depositC.id]);
      const testDeposits = deposits.filter((d: MonthlyDepositModel) => testIds.has(d.id));

      expect(testDeposits.map((d: MonthlyDepositModel) => d.id)).toEqual([
        depositC.id,
        depositB.id,
        depositA.id,
      ]);
    });
  });

  describe("listDepositsForMember", () => {
    it("returns only the given member's deposits, ordered most-recent first", async () => {
      const actor = await makeActor("for-member-1");
      const member = await makeTargetMember("for-member-1");
      const otherMember = await makeTargetMember("for-member-1-other");

      const depositA = await createDeposit(actor.id, {
        memberId: member.id,
        month: 1,
        year: 2026,
        amount: 100,
        paidDate: new Date("2026-01-01"),
      });
      const depositB = await createDeposit(actor.id, {
        memberId: member.id,
        month: 3,
        year: 2026,
        amount: 100,
        paidDate: new Date("2026-03-01"),
      });
      await createDeposit(actor.id, {
        memberId: otherMember.id,
        month: 2,
        year: 2026,
        amount: 999,
        paidDate: new Date("2026-02-01"),
      });

      const deposits = await listDepositsForMember(member.id);

      expect(deposits.map((d: MonthlyDepositModel) => d.id)).toEqual([depositB.id, depositA.id]);
      expect(deposits.every((d: MonthlyDepositModel) => d.memberId === member.id)).toBe(true);
    });
  });

  describe("filterDeposits", () => {
    // Pure function over an already-fetched array (e.g. from `listDeposits`)
    // — no DB access, so plain fixture objects suffice.
    function deposit(id: string, month: number, year: number) {
      return { id, memberId: "m1", month, year } as unknown as MonthlyDepositModel;
    }

    const fixtures = [
      deposit("a", 1, 2025),
      deposit("b", 3, 2026),
      deposit("c", 3, 2025),
    ];

    it("returns everything when no filter is given", () => {
      expect(filterDeposits(fixtures, {}).map((d) => d.id)).toEqual(["a", "b", "c"]);
    });

    it("filters by month only", () => {
      expect(filterDeposits(fixtures, { month: 3 }).map((d) => d.id)).toEqual(["b", "c"]);
    });

    it("filters by year only", () => {
      expect(filterDeposits(fixtures, { year: 2025 }).map((d) => d.id)).toEqual(["a", "c"]);
    });

    it("filters by both month and year", () => {
      expect(filterDeposits(fixtures, { month: 3, year: 2025 }).map((d) => d.id)).toEqual(["c"]);
    });

    it("returns an empty array when nothing matches", () => {
      expect(filterDeposits(fixtures, { month: 12 })).toEqual([]);
    });
  });
});
