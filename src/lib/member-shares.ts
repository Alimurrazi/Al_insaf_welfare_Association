import { prisma } from "./prisma";
import { MemberNotFoundError } from "./members";

export interface MemberShareInput {
  shareCount: number;
  effectiveFrom: Date | string;
}

// member_shares is append-only: past months must always calculate against the
// share count effective at the time, so there is no update/delete here —
// only creation of new rows and reading history.
export function validateMemberShareInput(input: Record<string, unknown>): string | null {
  const { shareCount, effectiveFrom } = input;

  if (typeof shareCount !== "number" || !Number.isInteger(shareCount) || shareCount < 1) {
    return "shareCount is required and must be a positive integer";
  }

  if (
    effectiveFrom === undefined ||
    effectiveFrom === null ||
    Number.isNaN(new Date(effectiveFrom as string | Date).getTime())
  ) {
    return "effectiveFrom is required and must be a valid date";
  }

  return null;
}

export async function addMemberShare(actorId: string, memberId: string, input: MemberShareInput) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: memberId } });
    if (!member) {
      throw new MemberNotFoundError(memberId);
    }

    const effectiveFrom = new Date(input.effectiveFrom);
    const share = await tx.memberShare.create({
      data: { memberId, shareCount: input.shareCount, effectiveFrom },
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

    return share;
  });
}

export async function listMemberShares(memberId: string) {
  return prisma.memberShare.findMany({
    where: { memberId },
    orderBy: { effectiveFrom: "desc" },
  });
}
