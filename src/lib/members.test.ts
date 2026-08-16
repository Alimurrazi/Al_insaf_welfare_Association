import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { createMember, listMembers, updateMember } from "./members";
import type { MemberModel } from "@/generated/prisma/models/Member";

// Distinguishing prefix so cleanup can find (and only find) rows this file created,
// following the existing pattern in `./prisma.test.ts`.
const PREFIX = "members-svc-test-";

async function makeActor(suffix: string) {
  return prisma.member.create({
    data: { name: `${PREFIX}actor-${suffix}`, email: `${PREFIX}actor-${suffix}@example.com`, role: "ADMIN" },
  });
}

describe("members service", () => {
  afterAll(async () => {
    // ActivityLog rows reference members via a required FK, so delete them first.
    await prisma.activityLog.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  describe("listMembers", () => {
    it("returns members ordered by name ascending", async () => {
      await prisma.member.create({
        data: { name: `${PREFIX}Zed`, email: `${PREFIX}zed@example.com`, role: "MEMBER" },
      });
      await prisma.member.create({
        data: { name: `${PREFIX}Amber`, email: `${PREFIX}amber@example.com`, role: "MEMBER" },
      });
      await prisma.member.create({
        data: { name: `${PREFIX}Mona`, email: `${PREFIX}mona@example.com`, role: "MEMBER" },
      });

      const members = await listMembers();
      const testNames = members
        .filter((m: MemberModel) => m.email.startsWith(PREFIX))
        .map((m: MemberModel) => m.name);

      expect(testNames).toEqual([...testNames].sort((a, b) => a.localeCompare(b)));
      expect(testNames).toContain(`${PREFIX}Amber`);
      expect(testNames).toContain(`${PREFIX}Mona`);
      expect(testNames).toContain(`${PREFIX}Zed`);
    });
  });

  describe("createMember", () => {
    it("creates a member and writes a correct ActivityLog row", async () => {
      const actor = await makeActor("create-1");

      const created = await createMember(actor.id, {
        name: `${PREFIX}New Member`,
        email: `${PREFIX}new-member@example.com`,
        role: "MEMBER",
      });

      expect(created.name).toBe(`${PREFIX}New Member`);
      expect(created.email).toBe(`${PREFIX}new-member@example.com`);
      expect(created.role).toBe("MEMBER");

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "Member", entityId: created.id, action: "CREATE" },
      });

      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(actor.id);
      expect(log?.oldValue).toBeNull();
      expect(log?.newValue).toMatchObject({
        name: `${PREFIX}New Member`,
        email: `${PREFIX}new-member@example.com`,
        role: "MEMBER",
      });
    });

    it("rejects a duplicate email", async () => {
      const actor = await makeActor("create-dup");
      const email = `${PREFIX}dup@example.com`;

      await createMember(actor.id, { name: `${PREFIX}Dup One`, email, role: "MEMBER" });

      await expect(
        createMember(actor.id, { name: `${PREFIX}Dup Two`, email, role: "MEMBER" }),
      ).rejects.toThrow();
    });
  });

  describe("updateMember", () => {
    it("updates fields and writes an ActivityLog row with old vs new values", async () => {
      const actor = await makeActor("update-1");
      const member = await prisma.member.create({
        data: {
          name: `${PREFIX}Before Update`,
          email: `${PREFIX}before-update@example.com`,
          role: "MEMBER",
        },
      });

      const updated = await updateMember(actor.id, member.id, {
        name: `${PREFIX}After Update`,
        role: "ADMIN",
      });

      expect(updated.name).toBe(`${PREFIX}After Update`);
      expect(updated.email).toBe(`${PREFIX}before-update@example.com`);
      expect(updated.role).toBe("ADMIN");

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "Member", entityId: member.id, action: "UPDATE" },
        orderBy: { createdAt: "desc" },
      });

      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(actor.id);
      expect(log?.oldValue).toMatchObject({
        name: `${PREFIX}Before Update`,
        email: `${PREFIX}before-update@example.com`,
        role: "MEMBER",
      });
      expect(log?.newValue).toMatchObject({
        name: `${PREFIX}After Update`,
        email: `${PREFIX}before-update@example.com`,
        role: "ADMIN",
      });
    });

    it("rejects an unknown member id", async () => {
      const actor = await makeActor("update-unknown");

      await expect(
        updateMember(actor.id, "does-not-exist-id", { name: `${PREFIX}Nope` }),
      ).rejects.toThrow();
    });

    it("rejects when the new email collides with a different existing member", async () => {
      const actor = await makeActor("update-collide");
      const memberOne = await prisma.member.create({
        data: { name: `${PREFIX}Collide One`, email: `${PREFIX}collide-1@example.com`, role: "MEMBER" },
      });
      const memberTwo = await prisma.member.create({
        data: { name: `${PREFIX}Collide Two`, email: `${PREFIX}collide-2@example.com`, role: "MEMBER" },
      });

      await expect(
        updateMember(actor.id, memberTwo.id, { email: memberOne.email }),
      ).rejects.toThrow();
    });
  });
});
