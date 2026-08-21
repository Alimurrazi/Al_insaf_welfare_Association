import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { describeActivityEntry, getShareEntryMemberIds, listActivity, summarizeActivityEntry } from "./activity";

// Distinguishing prefix so cleanup can find (and only find) rows this file
// created, following the existing pattern in `./deposits.test.ts`.
const PREFIX = "activity-svc-test-";

async function makeActor(suffix: string) {
  return prisma.member.create({
    data: { name: `${PREFIX}actor-${suffix}`, email: `${PREFIX}actor-${suffix}@example.com`, role: "ADMIN" },
  });
}

describe("listActivity", () => {
  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("returns entries ordered most-recent first, with the actor's name included", async () => {
    const actor = await makeActor("order");

    const entryA = await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: "CREATE",
        entityType: "Member",
        entityId: "entity-a",
        newValue: { name: "A" },
      },
    });
    const entryB = await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: "UPDATE",
        entityType: "Member",
        entityId: "entity-b",
        oldValue: { name: "Old" },
        newValue: { name: "New" },
      },
    });

    const entries = await listActivity();
    const testIds = new Set([entryA.id, entryB.id]);
    const testEntries = entries.filter((e) => testIds.has(e.id));

    // entryB was created after entryA, so it sorts first.
    expect(testEntries.map((e) => e.id)).toEqual([entryB.id, entryA.id]);
    expect(testEntries[0].actor.name).toBe(actor.name);
  });
});

describe("summarizeActivityEntry", () => {
  it("lists every field for a CREATE action", () => {
    const lines = summarizeActivityEntry({
      action: "CREATE",
      oldValue: null,
      newValue: { name: "Amber", role: "MEMBER" },
    });

    expect(lines).toContain("name: Amber");
    expect(lines).toContain("role: MEMBER");
  });

  it("returns an empty list for a CREATE action with no newValue", () => {
    expect(summarizeActivityEntry({ action: "CREATE", oldValue: null, newValue: null })).toEqual([]);
  });

  it("lists only the fields that actually changed for an UPDATE action", () => {
    const lines = summarizeActivityEntry({
      action: "UPDATE",
      oldValue: { name: "Old Name", role: "MEMBER" },
      newValue: { name: "New Name", role: "MEMBER" },
    });

    expect(lines).toEqual(["name: Old Name → New Name"]);
  });

  it("returns an empty list for an UPDATE action where nothing changed", () => {
    const lines = summarizeActivityEntry({
      action: "UPDATE",
      oldValue: { name: "Same" },
      newValue: { name: "Same" },
    });

    expect(lines).toEqual([]);
  });

  it("stringifies non-primitive field values", () => {
    const lines = summarizeActivityEntry({
      action: "UPDATE",
      oldValue: { effectiveFrom: "2025-01-01T00:00:00.000Z" },
      newValue: { effectiveFrom: "2026-01-01T00:00:00.000Z" },
    });

    expect(lines).toEqual(["effectiveFrom: 2025-01-01T00:00:00.000Z → 2026-01-01T00:00:00.000Z"]);
  });
});

describe("getShareEntryMemberIds", () => {
  const PREFIX = "activity-svc-share-test-";

  afterAll(async () => {
    await prisma.memberShare.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("maps each MemberShare row's id to its memberId, for only the given ids", async () => {
    const member = await prisma.member.create({
      data: { name: `${PREFIX}member`, email: `${PREFIX}member@example.com`, role: "MEMBER" },
    });
    const share = await prisma.memberShare.create({
      data: { memberId: member.id, shareCount: 3, effectiveFrom: new Date("2026-01-01") },
    });
    const otherMember = await prisma.member.create({
      data: { name: `${PREFIX}other`, email: `${PREFIX}other@example.com`, role: "MEMBER" },
    });
    const otherShare = await prisma.memberShare.create({
      data: { memberId: otherMember.id, shareCount: 1, effectiveFrom: new Date("2026-01-01") },
    });

    const result = await getShareEntryMemberIds([share.id]);

    expect(result.get(share.id)).toBe(member.id);
    expect(result.has(otherShare.id)).toBe(false);
  });

  it("returns an empty map for an empty id list", async () => {
    const result = await getShareEntryMemberIds([]);
    expect(result.size).toBe(0);
  });
});

describe("describeActivityEntry", () => {
  // Pure function over an already-fetched entry plus a pre-resolved member
  // lookup — no DB access needed here, so plain fixture objects suffice.
  const membersById = new Map([["member-1", { name: "Karim" }]]);
  const shareEntryMemberIds = new Map([["share-1", "member-1"]]);
  const actor = { name: "Razi" };

  it("describes creating a member", () => {
    const summary = describeActivityEntry(
      {
        action: "CREATE",
        entityType: "Member",
        entityId: "member-1",
        oldValue: null,
        newValue: { name: "Karim", email: "karim@example.com", role: "MEMBER" },
        actor,
      },
      { membersById, shareEntryMemberIds },
    );
    expect(summary).toBe("Razi added a new member — Karim (MEMBER)");
  });

  it("describes updating a member", () => {
    const summary = describeActivityEntry(
      {
        action: "UPDATE",
        entityType: "Member",
        entityId: "member-1",
        oldValue: { name: "Karim", email: "karim@example.com", role: "MEMBER" },
        newValue: { name: "Karim", email: "karim@example.com", role: "ADMIN" },
        actor,
      },
      { membersById, shareEntryMemberIds },
    );
    expect(summary).toBe("Razi updated member Karim");
  });

  it("describes recording a member's share count, resolving the member via shareEntryMemberIds", () => {
    const summary = describeActivityEntry(
      {
        action: "CREATE",
        entityType: "MemberShare",
        entityId: "share-1",
        oldValue: null,
        newValue: { shareCount: 3, effectiveFrom: "2026-01-01T00:00:00.000Z" },
        actor,
      },
      { membersById, shareEntryMemberIds },
    );
    expect(summary).toBe("Razi recorded 3 shares for Karim, effective 1 Jan 2026");
  });

  it("describes adding a deposit, resolving the member via memberId in newValue", () => {
    const summary = describeActivityEntry(
      {
        action: "CREATE",
        entityType: "MonthlyDeposit",
        entityId: "deposit-1",
        oldValue: null,
        newValue: { memberId: "member-1", month: 8, year: 2026, amount: 3000, paidDate: "2026-08-05", note: null },
        actor,
      },
      { membersById, shareEntryMemberIds },
    );
    expect(summary).toBe("Razi added a deposit of Tk 3,000.00 for Karim (Aug 2026)");
  });

  it("describes updating a deposit", () => {
    const summary = describeActivityEntry(
      {
        action: "UPDATE",
        entityType: "MonthlyDeposit",
        entityId: "deposit-1",
        oldValue: { memberId: "member-1", month: 8, year: 2026, amount: 3000, paidDate: "2026-08-05", note: null },
        newValue: { memberId: "member-1", month: 8, year: 2026, amount: 3500, paidDate: "2026-08-05", note: null },
        actor,
      },
      { membersById, shareEntryMemberIds },
    );
    expect(summary).toBe("Razi updated a deposit for Karim (Aug 2026)");
  });

  it("describes adding a top-up", () => {
    const summary = describeActivityEntry(
      {
        action: "CREATE",
        entityType: "AnnualTopup",
        entityId: "topup-1",
        oldValue: null,
        newValue: {
          memberId: "member-1",
          year: 2026,
          otpNumber: 1,
          amount: 7000,
          paidDate: "2026-01-15",
          note: null,
        },
        actor,
      },
      { membersById, shareEntryMemberIds },
    );
    expect(summary).toBe("Razi added a top-up of Tk 7,000.00 for Karim (2026, installment 1)");
  });

  it("describes adding an expense (group-level, no member involved)", () => {
    const summary = describeActivityEntry(
      {
        action: "CREATE",
        entityType: "Expense",
        entityId: "expense-1",
        oldValue: null,
        newValue: { date: "2026-01-20", category: "Land survey", amount: 2000, note: null },
        actor,
      },
      { membersById, shareEntryMemberIds },
    );
    expect(summary).toBe("Razi added an expense of Tk 2,000.00 — Land survey");
  });

  it("falls back to 'a member' when the member can't be resolved", () => {
    const summary = describeActivityEntry(
      {
        action: "CREATE",
        entityType: "MonthlyDeposit",
        entityId: "deposit-2",
        oldValue: null,
        newValue: { memberId: "unknown-member", month: 8, year: 2026, amount: 100, paidDate: "2026-08-05", note: null },
        actor,
      },
      { membersById, shareEntryMemberIds },
    );
    expect(summary).toBe("Razi added a deposit of Tk 100.00 for a member (Aug 2026)");
  });
});
