import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import {
  createExpense,
  ExpenseNotFoundError,
  listExpenses,
  updateExpense,
  validateExpenseInput,
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
});
