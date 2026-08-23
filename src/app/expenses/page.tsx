import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Search } from "lucide-react";
import { auth } from "@/auth";
import {
  createExpense,
  filterExpenses,
  listExpenses,
  sumExpenseAmounts,
  updateExpense,
  withRunningTotal,
} from "@/lib/expenses";
import {
  cardClasses,
  EXPENSES_ROW_GRID_CLASSES,
  inputClasses,
  pageContainerClasses,
  primaryButtonClasses,
} from "@/components/styles";
import { formatCurrency, matchesQuery } from "@/lib/format";
import { AddExpenseForm } from "./add-expense-form";
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
  searchParams: Promise<{ q?: string; category?: string; year?: string }>;
}) {
  const session = await auth();
  const isAdmin = session!.user.role === "ADMIN";

  const { q, category, year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : undefined;

  const allExpenses = await listExpenses();
  const categories = Array.from(new Set(allExpenses.map((expense) => expense.category))).sort();
  const years = Array.from(
    new Set(allExpenses.map((expense) => new Date(expense.date).getFullYear())),
  ).sort((a, b) => b - a);

  // Running totals are computed over every expense (chronological order)
  // before filtering, then filtered for display — so a category/year filter
  // narrows which rows are shown without changing what each row's running
  // total means ("fund spend to date"). Nothing is stored; this is
  // render-time-only (see UI-IMPROVEMENTS.md item 12).
  const byPeriod = filterExpenses(withRunningTotal(allExpenses), { category, year });
  const filtered = q
    ? byPeriod.filter((expense) => matchesQuery(expense.note ?? expense.category, q))
    : byPeriod;
  const total = sumExpenseAmounts(filtered);

  return (
    <main className={pageContainerClasses}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Group Expenses</h1>
          <p className="text-sm text-ink-soft">Collective expenditures logged from the land fund.</p>
        </div>
        {isAdmin && <AddExpenseForm addExpense={addExpense} />}
      </div>

      <form action="/expenses" method="GET" className={`flex flex-wrap items-end gap-4 ${cardClasses} p-4`}>
        <label className="relative flex flex-col gap-2 text-sm text-ink">
          <span className="sr-only">Search expense</span>
          <Search className="pointer-events-none absolute bottom-2.5 left-3 size-3.5 text-ink-soft" />
          <input
            name="q"
            type="text"
            placeholder="Search expense…"
            defaultValue={q ?? ""}
            className={`${inputClasses} w-56 pl-9`}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="sr-only">Category</span>
          <select name="category" defaultValue={category ?? ""} className={inputClasses}>
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="sr-only">Year</span>
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
        <p className="ml-auto font-mono text-sm font-semibold tabular-nums text-ink">
          Total: {formatCurrency(total)}
        </p>
      </form>

      <section className={`flex flex-col gap-0 overflow-hidden ${cardClasses} p-0`}>
        <div className={`${EXPENSES_ROW_GRID_CLASSES} bg-paper px-6 py-3 text-xs font-semibold text-ink-soft`}>
          <span>Date</span>
          <span>Description</span>
          <span>Category</span>
          <span>Amount</span>
          <span>Running Total</span>
          <span className="text-right">Actions</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">No expenses match these filters.</p>
        ) : (
          filtered.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={{ ...expense, amount: Number(expense.amount) }}
              runningTotal={expense.runningTotal}
              editExpense={isAdmin ? editExpense : undefined}
            />
          ))
        )}
      </section>
    </main>
  );
}
