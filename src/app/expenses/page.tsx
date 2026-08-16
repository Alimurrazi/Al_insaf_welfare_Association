import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createExpense, listExpenses, updateExpense } from "@/lib/expenses";
import { inputClasses, primaryButtonClasses } from "@/components/styles";
import { ExpenseRow } from "./expense-row";

async function requireAdminSession() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    notFound();
  }
  return session;
}

async function addExpense(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  await createExpense(session.user.id, {
    date: String(formData.get("date")),
    category: String(formData.get("category") ?? ""),
    amount: Number(formData.get("amount")),
    note: formData.get("note") ? String(formData.get("note")) : undefined,
  });

  revalidatePath("/expenses");
}

async function editExpense(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  await updateExpense(session.user.id, id, {
    date: String(formData.get("date")),
    category: String(formData.get("category") ?? ""),
    amount: Number(formData.get("amount")),
    note: formData.get("note") ? String(formData.get("note")) : undefined,
  });

  revalidatePath("/expenses");
}

export default async function ExpensesPage() {
  await requireAdminSession();
  const expenses = await listExpenses();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <h1 className="font-display text-xl font-bold text-ink">Manage Expenses</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Add an expense
        </h2>
        <form action={addExpense} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Date
            <input name="date" type="date" required className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Category
            <input name="category" type="text" required className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Amount
            <input name="amount" type="number" min={0.01} step={0.01} required className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Note
            <input name="note" type="text" className={inputClasses} />
          </label>
          <button type="submit" className={primaryButtonClasses}>
            Add expense
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Expenses
        </p>
        <ul className="flex flex-col gap-2">
          {expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={{ ...expense, amount: Number(expense.amount) }}
              editExpense={editExpense}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}
