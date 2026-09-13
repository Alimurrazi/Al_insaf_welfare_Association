import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { createMemberWithInitialShare } from "./members";

// Distinguishing prefix so cleanup can find (and only find) rows this file
// created, following the existing pattern in `./members.test.ts` and
// `./member-shares.test.ts`.
const PREFIX = "members-with-shares-svc-test-";

async function makeActor(suffix: string) {
  return prisma.member.create({
    data: { name: `${PREFIX}actor-${suffix}`, email: `${PREFIX}actor-${suffix}@example.com`, role: "ADMIN" },
  });
}

describe("createMemberWithInitialShare", () => {
  afterAll(async () => {
    // ActivityLog and MemberShare rows reference members via required FKs,
    // so delete them first, in FK-safe order.
    await prisma.activityLog.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
    await prisma.memberShare.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("creates only the member when initialShare is omitted (no MemberShare row, exactly one ActivityLog row)", async () => {
    const actor = await makeActor("omitted");

    const created = await createMemberWithInitialShare(actor.id, {
      name: `${PREFIX}Omitted`,
      email: `${PREFIX}omitted@example.com`,
      role: "MEMBER",
    });

    expect(created.name).toBe(`${PREFIX}Omitted`);
    expect(created.email).toBe(`${PREFIX}omitted@example.com`);
    expect(created.role).toBe("MEMBER");

    const shares = await prisma.memberShare.findMany({ where: { memberId: created.id } });
    expect(shares).toHaveLength(0);

    const logs = await prisma.activityLog.findMany({ where: { actorId: actor.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: "CREATE",
      entityType: "Member",
      entityId: created.id,
      oldValue: null,
    });
    expect(logs[0].newValue).toMatchObject({
      name: `${PREFIX}Omitted`,
      email: `${PREFIX}omitted@example.com`,
      role: "MEMBER",
    });
  });

  it("behaves the same as omitted when initialShare is explicitly null", async () => {
    const actor = await makeActor("null");

    const created = await createMemberWithInitialShare(
      actor.id,
      { name: `${PREFIX}Null Share`, email: `${PREFIX}null-share@example.com`, role: "MEMBER" },
      null,
    );

    expect(created.email).toBe(`${PREFIX}null-share@example.com`);

    const shares = await prisma.memberShare.findMany({ where: { memberId: created.id } });
    expect(shares).toHaveLength(0);

    const logs = await prisma.activityLog.findMany({ where: { actorId: actor.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: "CREATE",
      entityType: "Member",
      entityId: created.id,
    });
  });

  it("behaves the same as omitted when initialShare.shareCount is 0 (blank form field)", async () => {
    const actor = await makeActor("zero-count");

    const created = await createMemberWithInitialShare(
      actor.id,
      { name: `${PREFIX}Zero Count`, email: `${PREFIX}zero-count@example.com`, role: "MEMBER" },
      { shareCount: 0, effectiveFrom: new Date("2025-01-01") },
    );

    expect(created.email).toBe(`${PREFIX}zero-count@example.com`);

    const shares = await prisma.memberShare.findMany({ where: { memberId: created.id } });
    expect(shares).toHaveLength(0);

    const logs = await prisma.activityLog.findMany({ where: { actorId: actor.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: "CREATE",
      entityType: "Member",
      entityId: created.id,
    });
  });

  it("creates the member AND an initial MemberShare row (plus its own ActivityLog entry) when a valid initialShare is given", async () => {
    const actor = await makeActor("valid-share");
    const effectiveFrom = "2025-01-01";

    const created = await createMemberWithInitialShare(
      actor.id,
      { name: `${PREFIX}Valid Share`, email: `${PREFIX}valid-share@example.com`, role: "MEMBER" },
      { shareCount: 4, effectiveFrom },
    );

    expect(created.name).toBe(`${PREFIX}Valid Share`);
    expect(created.email).toBe(`${PREFIX}valid-share@example.com`);
    expect(created.role).toBe("MEMBER");

    const shares = await prisma.memberShare.findMany({ where: { memberId: created.id } });
    expect(shares).toHaveLength(1);
    expect(shares[0].shareCount).toBe(4);
    expect(new Date(shares[0].effectiveFrom).toISOString()).toBe(new Date(effectiveFrom).toISOString());

    const logs = await prisma.activityLog.findMany({
      where: { actorId: actor.id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs).toHaveLength(2);

    const memberLog = logs.find((l) => l.entityType === "Member");
    expect(memberLog).toBeTruthy();
    expect(memberLog).toMatchObject({
      action: "CREATE",
      entityType: "Member",
      entityId: created.id,
      oldValue: null,
    });
    expect(memberLog?.newValue).toMatchObject({
      name: `${PREFIX}Valid Share`,
      email: `${PREFIX}valid-share@example.com`,
      role: "MEMBER",
    });

    const shareLog = logs.find((l) => l.entityType === "MemberShare");
    expect(shareLog).toBeTruthy();
    expect(shareLog).toMatchObject({
      action: "CREATE",
      entityType: "MemberShare",
      entityId: shares[0].id,
    });
    expect(shareLog?.newValue).toMatchObject({ shareCount: 4 });
  });

  it("rejects a duplicate email regardless of whether initialShare is passed, without creating a share row", async () => {
    const actor = await makeActor("dup");
    const email = `${PREFIX}dup@example.com`;

    const first = await createMemberWithInitialShare(actor.id, {
      name: `${PREFIX}Dup One`,
      email,
      role: "MEMBER",
    });

    await expect(
      createMemberWithInitialShare(actor.id, { name: `${PREFIX}Dup Two`, email, role: "MEMBER" }),
    ).rejects.toThrow();

    await expect(
      createMemberWithInitialShare(
        actor.id,
        { name: `${PREFIX}Dup Three`, email, role: "MEMBER" },
        { shareCount: 2, effectiveFrom: new Date("2025-01-01") },
      ),
    ).rejects.toThrow();

    // Neither failed attempt should have left behind a Member row, a
    // MemberShare row, or an ActivityLog row beyond the original success.
    const members = await prisma.member.findMany({ where: { email } });
    expect(members).toHaveLength(1);
    expect(members[0].id).toBe(first.id);

    const shares = await prisma.memberShare.findMany({ where: { memberId: first.id } });
    expect(shares).toHaveLength(0);

    const logs = await prisma.activityLog.findMany({ where: { actorId: actor.id } });
    expect(logs).toHaveLength(1);
  });
});
