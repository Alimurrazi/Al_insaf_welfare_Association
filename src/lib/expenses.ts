import { prisma } from "./prisma";

export interface ExpenseInput {
  date: Date | string;
  category: string;
  amount: number;
  note?: string;
}

export class ExpenseNotFoundError extends Error {
  constructor(id: string) {
    super(`Expense not found: ${id}`);
  }
}

// Shared by both /api/expenses and /api/expenses/[id] since they validate the
// same shape — `partial: true` allows omitted fields (PATCH) but still
// rejects an invalid value for any field that IS present. Expenses are
// group-level (CLAUDE.md), so unlike deposits/topups there is no memberId
// to validate here.
export function validateExpenseInput(
  input: Record<string, unknown>,
  { partial }: { partial: boolean },
): string | null {
  const { date, category, amount, note } = input;

  if (!partial || date !== undefined) {
    if (
      date === undefined ||
      date === null ||
      Number.isNaN(new Date(date as string | Date).getTime())
    ) {
      return "date is required and must be a valid date";
    }
  }
  if (!partial || category !== undefined) {
    if (typeof category !== "string" || category.trim().length === 0) {
      return "category is required and must be a non-empty string";
    }
  }
  if (!partial || amount !== undefined) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return "amount is required and must be a positive number";
    }
  }
  if (note !== undefined && typeof note !== "string") {
    return "note must be a string";
  }

  return null;
}

export async function listExpenses() {
  return prisma.expense.findMany({
    orderBy: { date: "desc" },
  });
}

// Pure filter/total helpers over an already-fetched list — the expenses
// page filters by category/year for display, which at this app's scale
// (15 members) is simpler and cheaper done in memory than as a second
// DB round trip per filter change.
export function filterExpenses<T extends { category: string; date: Date }>(
  expenses: T[],
  filter: { category?: string; year?: number },
): T[] {
  return expenses.filter((expense) => {
    if (filter.category && expense.category !== filter.category) return false;
    if (filter.year && new Date(expense.date).getFullYear() !== filter.year) return false;
    return true;
  });
}

export function sumExpenseAmounts<T extends { amount: unknown }>(expenses: T[]): number {
  return expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
}

export async function createExpense(actorId: string, input: ExpenseInput) {
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        date: new Date(input.date),
        category: input.category,
        amount: input.amount,
        note: input.note,
        createdById: actorId,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId,
        action: "CREATE",
        entityType: "Expense",
        entityId: expense.id,
        newValue: {
          date: expense.date,
          category: expense.category,
          amount: expense.amount,
          note: expense.note,
        },
      },
    });

    return expense;
  });
}

export async function updateExpense(actorId: string, id: string, input: Partial<ExpenseInput>) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findUnique({ where: { id } });
    if (!existing) {
      throw new ExpenseNotFoundError(id);
    }

    const updated = await tx.expense.update({
      where: { id },
      data: {
        ...input,
        date: input.date !== undefined ? new Date(input.date) : undefined,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId,
        action: "UPDATE",
        entityType: "Expense",
        entityId: id,
        oldValue: {
          date: existing.date,
          category: existing.category,
          amount: existing.amount,
          note: existing.note,
        },
        newValue: {
          date: updated.date,
          category: updated.category,
          amount: updated.amount,
          note: updated.note,
        },
      },
    });

    return updated;
  });
}
