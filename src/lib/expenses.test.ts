import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import {
  createExpense,
  ExpenseNotFoundError,
  filterExpenses,
  listExpenses,
  sumExpenseAmounts,
  updateExpense,
  validateExpenseInput,
  withRunningTotal,
} from "./expenses";
import type { ExpenseModel } from "@/generated/prisma/models/Expense";

// Distinguishing prefix so cleanup can find (and only find) rows this file
// created, following the existing pattern in `./deposits.test.ts`.
const PREFIX = "expenses-svc-test-";

async function makeActor(suffix: string) {
  return prisma.member.create({
    data: { name: `${PREFIX}actor-${suffix}`, email: `${PREFIX}actor-${suffix}@example.com`, role: "ADMIN" },
  });
}

describe("expenses service", () => {
  afterAll(async () => {
    // ActivityLog and Expense rows reference members via required FKs, so
    // delete them first, in FK-safe order.
    await prisma.activityLog.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
    await prisma.expense.deleteMany({ where: { createdBy: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  describe("validateExpenseInput", () => {
    it("rejects a missing date", () => {
      const error = validateExpenseInput(
        { category: "Land survey", amount: 100 },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects an invalid date string", () => {
      const error = validateExpenseInput(
        { date: "not-a-date", category: "Land survey", amount: 100 },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a missing category", () => {
      const error = validateExpenseInput(
        { date: "2026-01-01", amount: 100 },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects an empty-string category", () => {
      const error = validateExpenseInput(
        { date: "2026-01-01", category: "", amount: 100 },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a missing amount", () => {
      const error = validateExpenseInput(
        { date: "2026-01-01", category: "Land survey" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a zero amount", () => {
      const error = validateExpenseInput(
        { date: "2026-01-01", category: "Land survey", amount: 0 },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a negative amount", () => {
      const error = validateExpenseInput(
        { date: "2026-01-01", category: "Land survey", amount: -50 },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a non-numeric amount", () => {
      const error = validateExpenseInput(
        { date: "2026-01-01", category: "Land survey", amount: "100" },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a non-finite amount", () => {
      const error = validateExpenseInput(
        { date: "2026-01-01", category: "Land survey", amount: Infinity },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("rejects a non-string note when present", () => {
      const error = validateExpenseInput(
        { date: "2026-01-01", category: "Land survey", amount: 100, note: 123 },
        { partial: false },
      );
      expect(typeof error).toBe("string");
    });

    it("accepts a fully valid combination", () => {
      const error = validateExpenseInput(
        { date: "2026-01-01", category: "Land survey", amount: 100, note: "surveyor fee" },
        { partial: false },
      );
      expect(error).toBeNull();
    });

    it("accepts a valid combination with a Date instance for date", () => {
      const error = validateExpenseInput(
        { date: new Date("2026-01-01"), category: "Land survey", amount: 100 },
        { partial: false },
      );
      expect(error).toBeNull();
    });

    it("in partial mode, an empty object is valid", () => {
      const error = validateExpenseInput({}, { partial: true });
      expect(error).toBeNull();
    });

    it("in partial mode, a present-and-invalid field is still rejected", () => {
      const error = validateExpenseInput({ amount: -5 }, { partial: true });
      expect(typeof error).toBe("string");
    });

    it("in partial mode, a present-and-invalid category is still rejected", () => {
      const error = validateExpenseInput({ category: "" }, { partial: true });
      expect(typeof error).toBe("string");
    });
  });

  describe("createExpense", () => {
    it("creates the row and writes a correct ActivityLog CREATE row", async () => {
      const actor = await makeActor("create-1");
      const date = new Date("2026-01-05");

      const created = await createExpense(actor.id, {
        date,
        category: "Land survey",
        amount: 500,
        note: "surveyor fee",
      });

      expect(created.category).toBe("Land survey");
      expect(Number(created.amount)).toBe(500);
      expect(created.note).toBe("surveyor fee");
      expect(created.createdById).toBe(actor.id);

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "Expense", entityId: created.id, action: "CREATE" },
      });

      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(actor.id);
      expect(log?.oldValue).toBeNull();
      expect(log?.newValue).toMatchObject({
        category: "Land survey",
        note: "surveyor fee",
      });
    });
  });

  describe("updateExpense", () => {
    it("updates fields and writes an ActivityLog UPDATE row with old vs new values", async () => {
      const actor = await makeActor("update-1");

      const expense = await createExpense(actor.id, {
        date: new Date("2026-03-01"),
        category: "Legal fees",
        amount: 300,
        note: "typo'd amount",
      });

      const updated = await updateExpense(actor.id, expense.id, {
        amount: 350,
        note: "corrected amount",
      });

      expect(Number(updated.amount)).toBe(350);
      expect(updated.note).toBe("corrected amount");
      // Untouched fields should be preserved.
      expect(updated.category).toBe("Legal fees");

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "Expense", entityId: expense.id, action: "UPDATE" },
        orderBy: { createdAt: "desc" },
      });

      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(actor.id);
      expect(log?.oldValue).toMatchObject({ note: "typo'd amount" });
      expect(log?.newValue).toMatchObject({ note: "corrected amount" });
    });

    it("rejects an unknown expense id", async () => {
      const actor = await makeActor("update-unknown");

      await expect(
        updateExpense(actor.id, "does-not-exist-id", { amount: 100 }),
      ).rejects.toThrow(ExpenseNotFoundError);
    });
  });

  describe("listExpenses", () => {
    it("returns expenses ordered most-recent-date-first", async () => {
      const actor = await makeActor("list-1");

      const expenseA = await createExpense(actor.id, {
        date: new Date("2025-06-01"),
        category: "Misc",
        amount: 100,
      });
      const expenseB = await createExpense(actor.id, {
        date: new Date("2026-01-01"),
        category: "Misc",
        amount: 100,
      });
      const expenseC = await createExpense(actor.id, {
        date: new Date("2026-03-01"),
        category: "Misc",
        amount: 100,
      });

      const expenses = await listExpenses();
      const testIds = new Set([expenseA.id, expenseB.id, expenseC.id]);
      const testExpenses = expenses.filter((e: ExpenseModel) => testIds.has(e.id));

      expect(testExpenses.map((e: ExpenseModel) => e.id)).toEqual([
        expenseC.id,
        expenseB.id,
        expenseA.id,
      ]);
    });
  });

  describe("filterExpenses", () => {
    // Pure functions over an already-fetched array (e.g. from
    // `listExpenses`) — no DB access, so plain fixture objects suffice.
    function expense(id: string, category: string, dateStr: string, amount: number) {
      return { id, category, date: new Date(dateStr), amount } as unknown as ExpenseModel;
    }

    const fixtures = [
      expense("a", "Land survey", "2025-06-01", 100),
      expense("b", "Legal fees", "2026-01-01", 200),
      expense("c", "Land survey", "2026-03-01", 300),
    ];

    it("returns everything when no filter is given", () => {
      expect(filterExpenses(fixtures, {}).map((e) => e.id)).toEqual(["a", "b", "c"]);
    });

    it("filters by category only", () => {
      expect(filterExpenses(fixtures, { category: "Land survey" }).map((e) => e.id)).toEqual([
        "a",
        "c",
      ]);
    });

    it("filters by year only", () => {
      expect(filterExpenses(fixtures, { year: 2026 }).map((e) => e.id)).toEqual(["b", "c"]);
    });

    it("filters by both category and year", () => {
      expect(
        filterExpenses(fixtures, { category: "Land survey", year: 2026 }).map((e) => e.id),
      ).toEqual(["c"]);
    });

    it("returns an empty array when nothing matches", () => {
      expect(filterExpenses(fixtures, { category: "Nonexistent" })).toEqual([]);
    });
  });

  describe("sumExpenseAmounts", () => {
    function expense(amount: number) {
      return { amount } as unknown as ExpenseModel;
    }

    it("sums the amounts as a plain number", () => {
      const total = sumExpenseAmounts([expense(100), expense(50.5), expense(25)]);
      expect(typeof total).toBe("number");
      expect(total).toBe(175.5);
    });

    it("returns 0 for an empty array", () => {
      expect(sumExpenseAmounts([])).toBe(0);
    });
  });

  describe("withRunningTotal", () => {
    // Pure function over an already-fetched array — no DB access, so plain
    // fixture objects suffice.
    function expense(id: string, dateStr: string, amount: number) {
      return { id, date: new Date(dateStr), amount } as unknown as ExpenseModel;
    }

    it("computes each row's cumulative total as of its date, regardless of input order", () => {
      // listExpenses returns most-recent-first; running totals must still
      // reflect the chronological (oldest-first) accumulation.
      const rows = [
        expense("c", "2026-03-01", 300),
        expense("b", "2026-02-01", 200),
        expense("a", "2026-01-01", 100),
      ];

      const withTotals = withRunningTotal(rows);

      expect(withTotals.map((r) => ({ id: r.id, runningTotal: r.runningTotal }))).toEqual([
        { id: "c", runningTotal: 600 },
        { id: "b", runningTotal: 300 },
        { id: "a", runningTotal: 100 },
      ]);
    });

    it("preserves the input array's order and length", () => {
      const rows = [expense("b", "2026-02-01", 200), expense("a", "2026-01-01", 100)];
      expect(withRunningTotal(rows).map((r) => r.id)).toEqual(["b", "a"]);
    });

    it("returns an empty array for an empty input", () => {
      expect(withRunningTotal([])).toEqual([]);
    });

    it("accumulates same-date rows together rather than resetting", () => {
      const rows = [expense("a", "2026-01-01", 100), expense("b", "2026-01-01", 50)];
      const totals = withRunningTotal(rows).map((r) => r.runningTotal);
      expect(new Set(totals)).toEqual(new Set([100, 150]));
    });
  });
});
