"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  DEPOSITS_ROW_GRID_CLASSES,
  fieldHintClasses,
  fieldLabelClasses,
  formActionsClasses,
  formClasses,
  inputClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "@/components/styles";
import { formatCurrency, formatDate, formatMonthYear, toDateInputValue } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/month-names";

interface DepositRowProps {
  deposit: {
    id: string;
    memberId: string;
    month: number;
    year: number;
    amount: number;
    paidDate: Date;
    note: string | null;
  };
  memberName: string;
  members: { id: string; name: string }[];
  editDeposit: (formData: FormData) => Promise<void>;
}

// Editing toggles into a labeled form on demand rather than always rendering
// one, following the same pattern as MemberRow.
export function DepositRow({ deposit, memberName, members, editDeposit }: DepositRowProps) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className={`${DEPOSITS_ROW_GRID_CLASSES} border-t border-line px-6 py-3.5 text-sm`}>
        <span className="font-semibold text-ink">{memberName}</span>
        <span className="text-ink-soft">{formatMonthYear(deposit.month, deposit.year)}</span>
        <span className="font-mono font-semibold tabular-nums text-accent">{formatCurrency(deposit.amount)}</span>
        <span className="text-ink-soft">{formatDate(deposit.paidDate)}</span>
        <span className="truncate italic text-ink-soft">{deposit.note}</span>
        <span className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit deposit for ${memberName}`}
            className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <Pencil className="size-4" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="border-t border-line p-4">
      <form
        action={async (formData) => {
          await editDeposit(formData);
          setEditing(false);
        }}
        className={formClasses}
      >
        <input type="hidden" name="id" value={deposit.id} />
        <label className={fieldLabelClasses}>
          Member
          <select name="memberId" defaultValue={deposit.memberId} className={inputClasses}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabelClasses}>
          Month
          <select name="month" defaultValue={deposit.month} required className={inputClasses}>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <span className={fieldHintClasses}>Which month this deposit counts toward</span>
        </label>
        <label className={fieldLabelClasses}>
          Year
          <input
            name="year"
            type="number"
            min={2000}
            step={1}
            defaultValue={deposit.year}
            required
            className={inputClasses}
          />
          <span className={fieldHintClasses}>Which year this deposit counts toward</span>
        </label>
        <label className={fieldLabelClasses}>
          Amount
          <input
            name="amount"
            type="number"
            min={0.01}
            step={0.01}
            defaultValue={deposit.amount}
            required
            className={inputClasses}
          />
        </label>
        <label className={fieldLabelClasses}>
          Paid date
          <input
            name="paidDate"
            type="date"
            defaultValue={toDateInputValue(deposit.paidDate)}
            required
            className={inputClasses}
          />
          <span className={fieldHintClasses}>
            The actual date payment was received — may differ from the period selected above
          </span>
        </label>
        <label className={fieldLabelClasses}>
          Note
          <input name="note" type="text" defaultValue={deposit.note ?? ""} className={inputClasses} />
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
