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
      <form
        action={async (formData) => {
          await editExpense(formData);
          setEditing(false);
        }}
        className={formClasses}
      >
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
        <div className={`flex gap-3 ${formActionsClasses}`}>
          <button type="submit" className={`${primaryButtonClasses} flex-1`}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className={`${secondaryButtonClasses} flex-1`}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
