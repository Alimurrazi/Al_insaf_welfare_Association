import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { MemberNotFoundError } from "./members";
import {
  addMemberShare,
  getShareCountAsOf,
  listMemberShares,
  listSharesForMembers,
  validateMemberShareInput,
} from "./member-shares";
import type { MemberShareModel } from "@/generated/prisma/models/MemberShare";

// Distinguishing prefix so cleanup can find (and only find) rows this file created,
// following the existing pattern in `./members.test.ts`.
const PREFIX = "member-shares-svc-test-";

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

describe("member-shares service", () => {
  afterAll(async () => {
    // ActivityLog and MemberShare rows reference members via required FKs,
    // so delete them first, in FK-safe order.
    await prisma.activityLog.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
    await prisma.memberShare.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  describe("validateMemberShareInput", () => {
    it("rejects a missing shareCount", () => {
      const error = validateMemberShareInput({ effectiveFrom: "2026-01-01" });
      expect(typeof error).toBe("string");
    });

    it("rejects a zero shareCount", () => {
      const error = validateMemberShareInput({ shareCount: 0, effectiveFrom: "2026-01-01" });
      expect(typeof error).toBe("string");
    });

    it("rejects a negative shareCount", () => {
      const error = validateMemberShareInput({ shareCount: -3, effectiveFrom: "2026-01-01" });
      expect(typeof error).toBe("string");
    });

    it("rejects a non-integer shareCount", () => {
      const error = validateMemberShareInput({ shareCount: 1.5, effectiveFrom: "2026-01-01" });
      expect(typeof error).toBe("string");
    });

    it("rejects a missing effectiveFrom", () => {
      const error = validateMemberShareInput({ shareCount: 2 });
      expect(typeof error).toBe("string");
    });

    it("rejects an invalid effectiveFrom", () => {
      const error = validateMemberShareInput({ shareCount: 2, effectiveFrom: "not-a-date" });
      expect(typeof error).toBe("string");
    });

    it("accepts a valid combination with a string date", () => {
      const error = validateMemberShareInput({ shareCount: 2, effectiveFrom: "2026-01-01" });
      expect(error).toBeNull();
    });

    it("accepts a valid combination with a Date instance", () => {
      const error = validateMemberShareInput({ shareCount: 2, effectiveFrom: new Date("2026-01-01") });
      expect(error).toBeNull();
    });
  });

  describe("addMemberShare", () => {
    it("creates the row and writes a correct ActivityLog row", async () => {
      const actor = await makeActor("add-1");
      const member = await makeTargetMember("add-1");
      const effectiveFrom = new Date("2026-01-01");

      const created = await addMemberShare(actor.id, member.id, { shareCount: 3, effectiveFrom });

      expect(created.memberId).toBe(member.id);
      expect(created.shareCount).toBe(3);
      expect(new Date(created.effectiveFrom).toISOString()).toBe(effectiveFrom.toISOString());

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "MemberShare", entityId: created.id, action: "CREATE" },
      });

      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(actor.id);
      expect(log?.oldValue).toBeNull();
      expect(log?.newValue).toMatchObject({ shareCount: 3 });
    });

    it("rejects an unknown memberId", async () => {
      const actor = await makeActor("add-unknown");

      await expect(
        addMemberShare(actor.id, "does-not-exist-id", { shareCount: 2, effectiveFrom: new Date("2026-01-01") }),
      ).rejects.toThrow(MemberNotFoundError);
    });

    it("creates two independent rows for the same member with different effectiveFrom values (append-only)", async () => {
      const actor = await makeActor("add-append");
      const member = await makeTargetMember("add-append");

      const first = await addMemberShare(actor.id, member.id, {
        shareCount: 1,
        effectiveFrom: new Date("2025-01-01"),
      });
      const second = await addMemberShare(actor.id, member.id, {
        shareCount: 5,
        effectiveFrom: new Date("2026-01-01"),
      });

      expect(first.id).not.toBe(second.id);

      const rows = await prisma.memberShare.findMany({ where: { memberId: member.id } });
      expect(rows).toHaveLength(2);
      expect(rows.map((r: MemberShareModel) => r.shareCount).sort()).toEqual([1, 5]);
    });
  });

  describe("listMemberShares", () => {
    it("returns only the given member's shares, ordered most-recent-effectiveFrom-first", async () => {
      const actor = await makeActor("list-1");
      const member = await makeTargetMember("list-1");
      const otherMember = await makeTargetMember("list-1-other");

      await addMemberShare(actor.id, member.id, { shareCount: 1, effectiveFrom: new Date("2024-01-01") });
      await addMemberShare(actor.id, member.id, { shareCount: 2, effectiveFrom: new Date("2026-01-01") });
      await addMemberShare(actor.id, member.id, { shareCount: 3, effectiveFrom: new Date("2025-01-01") });
      await addMemberShare(actor.id, otherMember.id, { shareCount: 99, effectiveFrom: new Date("2026-06-01") });

      const shares = await listMemberShares(member.id);

      expect(shares).toHaveLength(3);
      expect(shares.map((s: MemberShareModel) => s.shareCount)).toEqual([2, 3, 1]);
      expect(shares.every((s: MemberShareModel) => s.memberId === member.id)).toBe(true);
    });
  });

  describe("listSharesForMembers", () => {
    it("fetches multiple members' histories in a single query, grouped and ordered per member", async () => {
      const actor = await makeActor("list-multi");
      const memberA = await makeTargetMember("list-multi-a");
      const memberB = await makeTargetMember("list-multi-b");
      const memberC = await makeTargetMember("list-multi-c");

      await addMemberShare(actor.id, memberA.id, { shareCount: 1, effectiveFrom: new Date("2024-01-01") });
      await addMemberShare(actor.id, memberA.id, { shareCount: 2, effectiveFrom: new Date("2026-01-01") });
      await addMemberShare(actor.id, memberB.id, { shareCount: 5, effectiveFrom: new Date("2025-01-01") });

      const byMember = await listSharesForMembers([memberA.id, memberB.id, memberC.id]);

      expect(byMember.get(memberA.id)?.map((s: MemberShareModel) => s.shareCount)).toEqual([2, 1]);
      expect(byMember.get(memberB.id)?.map((s: MemberShareModel) => s.shareCount)).toEqual([5]);
      expect(byMember.get(memberC.id) ?? []).toEqual([]);
    });

    it("returns an empty map for an empty member id list", async () => {
      const byMember = await listSharesForMembers([]);
      expect(byMember.size).toBe(0);
    });
  });

  describe("getShareCountAsOf", () => {
    // Pure function over an already-fetched array (e.g. from
    // `listMemberShares`) — no DB access, so plain fixture objects suffice.
    function share(shareCount: number, effectiveFrom: string): MemberShareModel {
      return {
        id: `share-${effectiveFrom}`,
        memberId: "member-1",
        shareCount,
        effectiveFrom: new Date(effectiveFrom),
        createdAt: new Date(effectiveFrom),
      };
    }

    it("picks the row with the latest effectiveFrom on or before the given date", () => {
      const shares = [share(2, "2026-01-01"), share(3, "2025-01-01"), share(1, "2024-01-01")];
      expect(getShareCountAsOf(shares, new Date("2026-06-01"))).toBe(2);
      expect(getShareCountAsOf(shares, new Date("2025-06-01"))).toBe(3);
      expect(getShareCountAsOf(shares, new Date("2024-06-01"))).toBe(1);
    });

    it("ignores rows with an effectiveFrom in the future relative to the given date", () => {
      const shares = [share(5, "2026-01-01"), share(2, "2024-01-01")];
      expect(getShareCountAsOf(shares, new Date("2025-01-01"))).toBe(2);
    });

    it("returns 0 when every row is in the future relative to the given date", () => {
      const shares = [share(5, "2026-01-01")];
      expect(getShareCountAsOf(shares, new Date("2020-01-01"))).toBe(0);
    });

    it("returns 0 for an empty share history", () => {
      expect(getShareCountAsOf([], new Date("2026-01-01"))).toBe(0);
    });

    it("works regardless of the input array's order", () => {
      const shares = [share(1, "2024-01-01"), share(2, "2026-01-01"), share(3, "2025-01-01")];
      expect(getShareCountAsOf(shares, new Date("2025-06-01"))).toBe(3);
    });
  });
});
