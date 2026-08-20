"use client";

import { useState } from "react";
import {
  fieldLabelClasses,
  formActionsClasses,
  formClasses,
  inputClasses,
  primaryButtonClasses,
  rowAmountClasses,
  rowMutedClasses,
  rowNoteClasses,
  rowPrimaryClasses,
  secondaryButtonClasses,
} from "@/components/styles";

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
      <li className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-4 text-sm text-ink">
        <span className="flex flex-wrap items-center gap-x-2 font-mono tabular-nums">
          <span className={rowMutedClasses}>{formatDate(expense.date)} —</span>
          <span className={rowPrimaryClasses}>{expense.category}</span>
          <span className={rowMutedClasses}>—</span>
          <span className={rowAmountClasses}>Tk {expense.amount.toFixed(2)}</span>
          {expense.note && <span className={rowNoteClasses}>— {expense.note}</span>}
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
    <li className="rounded-md border border-line bg-surface p-4">
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
            defaultValue={formatDate(expense.date)}
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
    </li>
  );
}
