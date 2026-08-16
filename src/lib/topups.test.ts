import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { MemberNotFoundError } from "./members";
import {
  createTopup,
  listTopups,
  listTopupsForMember,
  TopupNotFoundError,
  updateTopup,
  validateTopupInput,
} from "./topups";
import type { AnnualTopupModel } from "@/generated/prisma/models/AnnualTopup";

// Distinguishing prefix so cleanup can find (and only find) rows this file created,
// following the existing pattern in `./deposits.test.ts`.
const PREFIX = "topups-svc-test-";

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

describe("topups service", () => {
  afterAll(async () => {
    // ActivityLog and AnnualTopup rows reference members via required FKs,
    // so delete them first, in FK-safe order.
    await prisma.activityLog.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
    await prisma.annualTopup.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  describe("validateTopupInput", () => {
    it("rejects a missing memberId", () => {
      const error = validateTopupInput(
        { year: 2026, otpNumber: 1, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects an empty-string memberId", () => {
      const error = validateTopupInput(
        { memberId: "", year: 2026, otpNumber: 1, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a year below 2000", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 1999, otpNumber: 1, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a non-integer year", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026.5, otpNumber: 1, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a missing otpNumber", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a zero otpNumber", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, otpNumber: 0, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a negative otpNumber", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, otpNumber: -1, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a non-integer otpNumber", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, otpNumber: 1.5, amount: 100, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a zero amount", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, otpNumber: 1, amount: 0, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a negative amount", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, otpNumber: 1, amount: -50, paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a non-numeric amount", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, otpNumber: 1, amount: "100", paidDate: "2026-01-01" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a missing paidDate", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, otpNumber: 1, amount: 100 },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects an invalid paidDate", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, otpNumber: 1, amount: 100, paidDate: "not-a-date" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a non-string note when present", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, otpNumber: 1, amount: 100, paidDate: "2026-01-01", note: 123 },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("accepts a fully valid combination", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, otpNumber: 1, amount: 100, paidDate: "2026-01-01", note: "OTP-1" },
        { partial: false },
      );
      expect(error).toBeNull();
    });

    it("accepts a valid combination with a Date instance for paidDate", () => {
      const error = validateTopupInput(
        { memberId: "m1", year: 2026, otpNumber: 1, amount: 100, paidDate: new Date("2026-01-01") },
        { partial: false },
      );
      expect(error).toBeNull();
    });

    it("in partial mode, an empty object is valid", () => {
      const error = validateTopupInput({}, { partial: true });
      expect(error).toBeNull();
    });

    it("in partial mode, a present-and-invalid field is still rejected", () => {
      const error = validateTopupInput({ amount: -5 }, { partial: true });
      expect(typeof error).toBe("string");
    });

    it("in partial mode, a present-and-invalid otpNumber is still rejected", () => {
      const error = validateTopupInput({ otpNumber: 0 }, { partial: true });
      expect(typeof error).toBe("string");
    });
  });

  describe("createTopup", () => {
    it("creates the row and writes a correct ActivityLog CREATE row", async () => {
      const actor = await makeActor("create-1");
      const member = await makeTargetMember("create-1");
      const paidDate = new Date("2026-01-05");

      const created = await createTopup(actor.id, {
        memberId: member.id,
        year: 2026,
        otpNumber: 1,
        amount: 5000,
        paidDate,
        note: "First OTP",
      });

      expect(created.memberId).toBe(member.id);
      expect(created.year).toBe(2026);
      expect(created.otpNumber).toBe(1);
      expect(Number(created.amount)).toBe(5000);
      expect(created.note).toBe("First OTP");
      expect(created.createdById).toBe(actor.id);

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "AnnualTopup", entityId: created.id, action: "CREATE" },
      });

      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(actor.id);
      expect(log?.oldValue).toBeNull();
      expect(log?.newValue).toMatchObject({
        memberId: member.id,
        year: 2026,
        otpNumber: 1,
        note: "First OTP",
      });
    });

    it("rejects an unknown memberId", async () => {
      const actor = await makeActor("create-unknown");

      await expect(
        createTopup(actor.id, {
          memberId: "does-not-exist-id",
          year: 2026,
          otpNumber: 2,
          amount: 2000,
          paidDate: new Date("2026-02-01"),
        }),
      ).rejects.toThrow(MemberNotFoundError);
    });
  });

  describe("updateTopup", () => {
    it("updates fields and writes an ActivityLog UPDATE row with old vs new values", async () => {
      const actor = await makeActor("update-1");
      const member = await makeTargetMember("update-1");

      const topup = await createTopup(actor.id, {
        memberId: member.id,
        year: 2026,
        otpNumber: 3,
        amount: 3000,
        paidDate: new Date("2026-03-01"),
        note: "typo'd amount",
      });

      const updated = await updateTopup(actor.id, topup.id, {
        amount: 3500,
        note: "corrected amount",
      });

      expect(Number(updated.amount)).toBe(3500);
      expect(updated.note).toBe("corrected amount");
      // Untouched fields should be preserved.
      expect(updated.year).toBe(2026);
      expect(updated.otpNumber).toBe(3);

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "AnnualTopup", entityId: topup.id, action: "UPDATE" },
        orderBy: { createdAt: "desc" },
      });

      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(actor.id);
      expect(log?.oldValue).toMatchObject({ note: "typo'd amount" });
      expect(log?.newValue).toMatchObject({ note: "corrected amount" });
    });

    it("rejects an unknown topup id", async () => {
      const actor = await makeActor("update-unknown");

      await expect(
        updateTopup(actor.id, "does-not-exist-id", { amount: 100 }),
      ).rejects.toThrow(TopupNotFoundError);
    });
  });

  describe("listTopups", () => {
    it("returns top-ups ordered most-recent first (year desc, then otpNumber desc)", async () => {
      const actor = await makeActor("list-1");
      const member = await makeTargetMember("list-1");

      const topupA = await createTopup(actor.id, {
        memberId: member.id,
        year: 2025,
        otpNumber: 2,
        amount: 100,
        paidDate: new Date("2025-06-01"),
      });
      const topupB = await createTopup(actor.id, {
        memberId: member.id,
        year: 2026,
        otpNumber: 1,
        amount: 100,
        paidDate: new Date("2026-01-01"),
      });
      const topupC = await createTopup(actor.id, {
        memberId: member.id,
        year: 2026,
        otpNumber: 3,
        amount: 100,
        paidDate: new Date("2026-03-01"),
      });

      const topups = await listTopups();
      const testIds = new Set([topupA.id, topupB.id, topupC.id]);
      const testTopups = topups.filter((t: AnnualTopupModel) => testIds.has(t.id));

      expect(testTopups.map((t: AnnualTopupModel) => t.id)).toEqual([
        topupC.id,
        topupB.id,
        topupA.id,
      ]);
    });
  });

  describe("listTopupsForMember", () => {
    it("returns only the given member's top-ups, ordered most-recent first", async () => {
      const actor = await makeActor("for-member-1");
      const member = await makeTargetMember("for-member-1");
      const otherMember = await makeTargetMember("for-member-1-other");

      const topupA = await createTopup(actor.id, {
        memberId: member.id,
        year: 2026,
        otpNumber: 1,
        amount: 100,
        paidDate: new Date("2026-01-01"),
      });
      const topupB = await createTopup(actor.id, {
        memberId: member.id,
        year: 2026,
        otpNumber: 2,
        amount: 100,
        paidDate: new Date("2026-06-01"),
      });
      await createTopup(actor.id, {
        memberId: otherMember.id,
        year: 2026,
        otpNumber: 1,
        amount: 999,
        paidDate: new Date("2026-01-01"),
      });

      const topups = await listTopupsForMember(member.id);

      expect(topups.map((t: AnnualTopupModel) => t.id)).toEqual([topupB.id, topupA.id]);
      expect(topups.every((t: AnnualTopupModel) => t.memberId === member.id)).toBe(true);
    });
  });
});
