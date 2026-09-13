import { prisma } from "./prisma";
import type { Role } from "@/generated/prisma/enums";

export interface MemberInput {
  name: string;
  email: string;
  role: Role;
}

export class MemberNotFoundError extends Error {
  constructor(id: string) {
    super(`Member not found: ${id}`);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES: Role[] = ["ADMIN", "MEMBER"];

// Shared by both /api/members and /api/members/[id] since they validate the
// same shape — `partial: true` allows omitted fields (PATCH) but still
// rejects an invalid value for any field that IS present.
export function validateMemberInput(
  input: Record<string, unknown>,
  { partial }: { partial: boolean },
): string | null {
  const { name, email, role } = input;

  if (!partial || name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return "name is required and must be a non-empty string";
    }
  }
  if (!partial || email !== undefined) {
    if (typeof email !== "string" || !EMAIL_RE.test(email)) {
      return "email is required and must be a valid email address";
    }
  }
  if (!partial || role !== undefined) {
    if (typeof role !== "string" || !VALID_ROLES.includes(role as Role)) {
      return `role is required and must be one of: ${VALID_ROLES.join(", ")}`;
    }
  }

  return null;
}

export async function listMembers() {
  return prisma.member.findMany({ orderBy: { name: "asc" } });
}

export async function createMember(actorId: string, input: MemberInput) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.create({ data: input });
    await tx.activityLog.create({
      data: {
        actorId,
        action: "CREATE",
        entityType: "Member",
        entityId: member.id,
        newValue: { name: member.name, email: member.email, role: member.role },
      },
    });
    return member;
  });
}

export interface InitialMemberShare {
  shareCount: number;
  effectiveFrom: Date | string;
}

// Used by the Add Member form's optional "Initial shares" fields. One
// transaction (not createMember + a separate addMemberShare call) so the
// member and its opening share row commit atomically — still two writes,
// never a field on Member itself, since a share change must always be its
// own dated member_shares row (see CLAUDE.md).
export async function createMemberWithInitialShare(
  actorId: string,
  input: MemberInput,
  initialShare?: InitialMemberShare | null,
) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.create({ data: input });
    await tx.activityLog.create({
      data: {
        actorId,
        action: "CREATE",
        entityType: "Member",
        entityId: member.id,
        newValue: { name: member.name, email: member.email, role: member.role },
      },
    });

    if (initialShare && initialShare.shareCount > 0) {
      const effectiveFrom = new Date(initialShare.effectiveFrom);
      const share = await tx.memberShare.create({
        data: { memberId: member.id, shareCount: initialShare.shareCount, effectiveFrom },
      });
      await tx.activityLog.create({
        data: {
          actorId,
          action: "CREATE",
          entityType: "MemberShare",
          entityId: share.id,
          newValue: { shareCount: share.shareCount, effectiveFrom: share.effectiveFrom },
        },
      });
    }

    return member;
  });
}

export async function updateMember(
  actorId: string,
  id: string,
  input: Partial<MemberInput>,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.member.findUnique({ where: { id } });
    if (!existing) {
      throw new MemberNotFoundError(id);
    }

    const updated = await tx.member.update({ where: { id }, data: input });

    await tx.activityLog.create({
      data: {
        actorId,
        action: "UPDATE",
        entityType: "Member",
        entityId: id,
        oldValue: { name: existing.name, email: existing.email, role: existing.role },
        newValue: { name: updated.name, email: updated.email, role: updated.role },
      },
    });

    return updated;
  });
}
