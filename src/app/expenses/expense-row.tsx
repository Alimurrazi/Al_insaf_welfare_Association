"use client";

import { useState } from "react";
import { inputClasses, primaryButtonClasses, secondaryButtonClasses } from "@/components/styles";

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
}

function formatDate(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

// Editing toggles into a labeled form on demand rather than always rendering
// one, following the same pattern as DepositRow/TopupRow/MemberRow.
export function ExpenseRow({ expense, editExpense }: ExpenseRowProps) {
  const [editing, setEditing] = useState(false);

  if (!editing || !editExpense) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-3 text-sm text-ink">
        <span className="flex items-center gap-2 font-mono tabular-nums">
          {formatDate(expense.date)} — {expense.category} — ${expense.amount.toFixed(2)}
          {expense.note ? ` — ${expense.note}` : ""}
        </span>
        {editExpense && (
          <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClasses}>
            Edit
          </button>
        )}
      </li>
    );
  }

  return (
    <li className="rounded-md border border-line bg-surface p-3">
      <form
        action={async (formData) => {
          await editExpense(formData);
          setEditing(false);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="id" value={expense.id} />
        <label className="flex flex-col gap-1 text-sm text-ink">
          Date
          <input
            name="date"
            type="date"
            defaultValue={formatDate(expense.date)}
            required
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Category
          <input name="category" type="text" defaultValue={expense.category} required className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
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
        <label className="flex flex-col gap-1 text-sm text-ink">
          Note
          <input name="note" type="text" defaultValue={expense.note ?? ""} className={inputClasses} />
        </label>
        <button type="submit" className={primaryButtonClasses}>
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className={secondaryButtonClasses}>
          Cancel
        </button>
      </form>
    </li>
  );
}
