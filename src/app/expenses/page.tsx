import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createExpense, filterExpenses, listExpenses, sumExpenseAmounts, updateExpense } from "@/lib/expenses";
import {
  fieldLabelClasses,
  formActionsClasses,
  formClasses,
  inputClasses,
  primaryButtonClasses,
} from "@/components/styles";
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

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; year?: string }>;
}) {
  const session = await auth();
  const isAdmin = session!.user.role === "ADMIN";

  const { category, year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : undefined;

  const allExpenses = await listExpenses();
  const categories = Array.from(new Set(allExpenses.map((expense) => expense.category))).sort();
  const years = Array.from(
    new Set(allExpenses.map((expense) => new Date(expense.date).getFullYear())),
  ).sort((a, b) => b - a);

  const filtered = filterExpenses(allExpenses, { category, year });
  const total = sumExpenseAmounts(filtered);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <h1 className="font-display text-xl font-bold text-ink">Expenses</h1>

      {isAdmin && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            Add an expense
          </h2>
          <form action={addExpense} className={formClasses}>
            <label className={fieldLabelClasses}>
              Date
              <input name="date" type="date" required className={inputClasses} />
            </label>
            <label className={fieldLabelClasses}>
              Category
              <input name="category" type="text" required className={inputClasses} />
            </label>
            <label className={fieldLabelClasses}>
              Amount
              <input name="amount" type="number" min={0.01} step={0.01} required className={inputClasses} />
            </label>
            <label className={fieldLabelClasses}>
              Note
              <input name="note" type="text" className={inputClasses} />
            </label>
            <button type="submit" className={`${primaryButtonClasses} ${formActionsClasses} w-full`}>
              Add expense
            </button>
          </form>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-soft">Filter</h2>
        <form action="/expenses" method="GET" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Category
            <select name="category" defaultValue={category ?? ""} className={inputClasses}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Year
            <select name="year" defaultValue={yearParam ?? ""} className={inputClasses}>
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={primaryButtonClasses}>
            Apply
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            {filtered.length} {filtered.length === 1 ? "expense" : "expenses"}
          </p>
          <p className="font-mono text-sm tabular-nums text-ink">
            Total: Tk {total.toFixed(2)}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {filtered.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={{ ...expense, amount: Number(expense.amount) }}
              editExpense={isAdmin ? editExpense : undefined}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}
