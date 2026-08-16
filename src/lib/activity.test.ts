import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { listActivity, summarizeActivityEntry } from "./activity";

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
