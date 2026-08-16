import { prisma } from "./prisma";
import { MemberNotFoundError } from "./members";

export interface DepositInput {
  memberId: string;
  month: number;
  year: number;
  amount: number;
  paidDate: Date | string;
  note?: string;
}

export class DepositNotFoundError extends Error {
  constructor(id: string) {
    super(`Deposit not found: ${id}`);
  }
}

// Shared by both /api/deposits and /api/deposits/[id] since they validate the
// same shape — `partial: true` allows omitted fields (PATCH) but still
// rejects an invalid value for any field that IS present.
export function validateDepositInput(
  input: Record<string, unknown>,
  { partial }: { partial: boolean },
): string | null {
  const { memberId, month, year, amount, paidDate, note } = input;

  if (!partial || memberId !== undefined) {
    if (typeof memberId !== "string" || memberId.trim().length === 0) {
      return "memberId is required and must be a non-empty string";
    }
  }
  if (!partial || month !== undefined) {
    if (typeof month !== "number" || !Number.isInteger(month) || month < 1 || month > 12) {
      return "month is required and must be an integer between 1 and 12";
    }
  }
  if (!partial || year !== undefined) {
    if (typeof year !== "number" || !Number.isInteger(year) || year < 2000) {
      return "year is required and must be an integer of 2000 or later";
    }
  }
  if (!partial || amount !== undefined) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return "amount is required and must be a positive number";
    }
  }
  if (!partial || paidDate !== undefined) {
    if (
      paidDate === undefined ||
      paidDate === null ||
      Number.isNaN(new Date(paidDate as string | Date).getTime())
    ) {
      return "paidDate is required and must be a valid date";
    }
  }
  if (note !== undefined && typeof note !== "string") {
    return "note must be a string";
  }

  return null;
}

export async function listDeposits() {
  return prisma.monthlyDeposit.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function listDepositsForMember(memberId: string) {
  return prisma.monthlyDeposit.findMany({
    where: { memberId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function createDeposit(actorId: string, input: DepositInput) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: input.memberId } });
    if (!member) {
      throw new MemberNotFoundError(input.memberId);
    }

    const deposit = await tx.monthlyDeposit.create({
      data: {
        memberId: input.memberId,
        month: input.month,
        year: input.year,
        amount: input.amount,
        paidDate: new Date(input.paidDate),
        note: input.note,
        createdById: actorId,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId,
        action: "CREATE",
        entityType: "MonthlyDeposit",
        entityId: deposit.id,
        newValue: {
          memberId: deposit.memberId,
          month: deposit.month,
          year: deposit.year,
          amount: deposit.amount,
          paidDate: deposit.paidDate,
          note: deposit.note,
        },
      },
    });

    return deposit;
  });
}

export async function updateDeposit(
  actorId: string,
  id: string,
  input: Partial<DepositInput>,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.monthlyDeposit.findUnique({ where: { id } });
    if (!existing) {
      throw new DepositNotFoundError(id);
    }

    const updated = await tx.monthlyDeposit.update({
      where: { id },
      data: {
        ...input,
        paidDate: input.paidDate !== undefined ? new Date(input.paidDate) : undefined,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId,
        action: "UPDATE",
        entityType: "MonthlyDeposit",
        entityId: id,
        oldValue: {
          memberId: existing.memberId,
          month: existing.month,
          year: existing.year,
          amount: existing.amount,
          paidDate: existing.paidDate,
          note: existing.note,
        },
        newValue: {
          memberId: updated.memberId,
          month: updated.month,
          year: updated.year,
          amount: updated.amount,
          paidDate: updated.paidDate,
          note: updated.note,
        },
      },
    });

    return updated;
  });
}
