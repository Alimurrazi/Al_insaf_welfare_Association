import { prisma } from "./prisma";
import { MemberNotFoundError } from "./members";

export interface TopupInput {
  memberId: string;
  year: number;
  otpNumber: number;
  amount: number;
  paidDate: Date | string;
  note?: string;
}

export class TopupNotFoundError extends Error {
  constructor(id: string) {
    super(`Topup not found: ${id}`);
  }
}

// Shared by both /api/topups and /api/topups/[id] since they validate the
// same shape — `partial: true` allows omitted fields (PATCH) but still
// rejects an invalid value for any field that IS present.
export function validateTopupInput(
  input: Record<string, unknown>,
  { partial }: { partial: boolean },
): string | null {
  const { memberId, year, otpNumber, amount, paidDate, note } = input;

  if (!partial || memberId !== undefined) {
    if (typeof memberId !== "string" || memberId.trim().length === 0) {
      return "memberId is required and must be a non-empty string";
    }
  }
  if (!partial || year !== undefined) {
    if (typeof year !== "number" || !Number.isInteger(year) || year < 2000) {
      return "year is required and must be an integer of 2000 or later";
    }
  }
  if (!partial || otpNumber !== undefined) {
    if (typeof otpNumber !== "number" || !Number.isInteger(otpNumber) || otpNumber < 1) {
      return "otpNumber is required and must be a positive integer";
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

export async function listTopups() {
  return prisma.annualTopup.findMany({
    orderBy: [{ year: "desc" }, { otpNumber: "desc" }],
  });
}

export async function listTopupsForMember(memberId: string) {
  return prisma.annualTopup.findMany({
    where: { memberId },
    orderBy: [{ year: "desc" }, { otpNumber: "desc" }],
  });
}

// Pure filter helper over an already-fetched list — the Top-ups page
// filters by installment cycle (otpNumber) for display, following the same
// pattern as `filterExpenses`/`filterDeposits`.
export function filterTopups<T extends { otpNumber: number }>(
  topups: T[],
  filter: { otpNumber?: number },
): T[] {
  return topups.filter((topup) => {
    if (filter.otpNumber && topup.otpNumber !== filter.otpNumber) return false;
    return true;
  });
}

export async function createTopup(actorId: string, input: TopupInput) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: input.memberId } });
    if (!member) {
      throw new MemberNotFoundError(input.memberId);
    }

    const topup = await tx.annualTopup.create({
      data: {
        memberId: input.memberId,
        year: input.year,
        otpNumber: input.otpNumber,
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
        entityType: "AnnualTopup",
        entityId: topup.id,
        newValue: {
          memberId: topup.memberId,
          year: topup.year,
          otpNumber: topup.otpNumber,
          amount: topup.amount,
          paidDate: topup.paidDate,
          note: topup.note,
        },
      },
    });

    return topup;
  });
}

export async function updateTopup(actorId: string, id: string, input: Partial<TopupInput>) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.annualTopup.findUnique({ where: { id } });
    if (!existing) {
      throw new TopupNotFoundError(id);
    }

    const updated = await tx.annualTopup.update({
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
        entityType: "AnnualTopup",
        entityId: id,
        oldValue: {
          memberId: existing.memberId,
          year: existing.year,
          otpNumber: existing.otpNumber,
          amount: existing.amount,
          paidDate: existing.paidDate,
          note: existing.note,
        },
        newValue: {
          memberId: updated.memberId,
          year: updated.year,
          otpNumber: updated.otpNumber,
          amount: updated.amount,
          paidDate: updated.paidDate,
          note: updated.note,
        },
      },
    });

    return updated;
  });
}
