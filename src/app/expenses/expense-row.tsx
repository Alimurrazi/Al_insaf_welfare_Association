"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  EXPENSES_ROW_GRID_CLASSES,
  fieldLabelClasses,
  formActionsClasses,
  formClasses,
  inputClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "@/components/styles";
import { FormFeedback } from "@/components/form-feedback";
import { useServerActionFeedback } from "@/components/use-server-action-feedback";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";

interface ExpenseRowProps {
  expense: {
    id: string;
    date: Date;
    category: string;
    amount: number;
    note: string | null;
  };
  // Members get a read-only row (no Edit button, no mutation capability) —
  // omit this prop entirely for a Member-role viewer rather than passing a
  // server action that would just reject at the auth boundary anyway.
  editExpense?: (formData: FormData) => Promise<void>;
  // Cumulative fund spend as of this expense's date — computed at render
  // time by `withRunningTotal`, not stored (see UI-IMPROVEMENTS.md item 12).
  runningTotal: number;
}

// Editing toggles into a labeled form on demand rather than always rendering
// one, following the same pattern as DepositRow/TopupRow/MemberRow.
export function ExpenseRow({ expense, editExpense, runningTotal }: ExpenseRowProps) {
  const [editing, setEditing] = useState(false);
  const { feedback, pending, run } = useServerActionFeedback();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editExpense) return;
    const formData = new FormData(event.currentTarget);
    run(() => editExpense(formData), `Expense updated — ${expense.category}`, () => setEditing(false));
  }

  if (!editing || !editExpense) {
    return (
      <div className={`${EXPENSES_ROW_GRID_CLASSES} border-t border-line px-6 py-3.5 text-sm`}>
        <span className="text-ink-soft">{formatDate(expense.date)}</span>
        <span className="truncate font-semibold text-ink">{expense.note ?? expense.category}</span>
        <span className="w-fit rounded-md bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
          {expense.category}
        </span>
        <span className="font-mono font-semibold tabular-nums text-ink">{formatCurrency(expense.amount)}</span>
        <span className="font-mono text-ink-soft tabular-nums">{formatCurrency(runningTotal)}</span>
        <span className="flex justify-end">
          {editExpense && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Edit expense: ${expense.category}`}
              className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent"
            >
              <Pencil className="size-4" />
            </button>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="border-t border-line p-4">
      <form onSubmit={handleSubmit} className={formClasses}>
        <input type="hidden" name="id" value={expense.id} />
        <label className={fieldLabelClasses}>
          Date
          <input
            name="date"
            type="date"
            defaultValue={toDateInputValue(expense.date)}
            required
            className={inputClasses}
          />
        </label>
        <label className={fieldLabelClasses}>
          Category
          <input name="category" type="text" defaultValue={expense.category} required className={inputClasses} />
        </label>
        <label className={fieldLabelClasses}>
          Amount
          <input
            name="amount"
            type="number"
            min={0.01}
            step={0.01}
            defaultValue={expense.amount}
            required
            className={inputClasses}
          />
        </label>
        <label className={fieldLabelClasses}>
          Note
          <input name="note" type="text" defaultValue={expense.note ?? ""} className={inputClasses} />
        </label>
        <div className={`flex flex-col gap-3 ${formActionsClasses}`}>
          <FormFeedback feedback={feedback} />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className={`${primaryButtonClasses} flex-1 disabled:opacity-60`}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className={`${secondaryButtonClasses} flex-1 disabled:opacity-60`}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
