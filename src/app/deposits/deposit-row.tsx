"use client";

import { useState } from "react";
import {
  fieldHintClasses,
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

function formatDate(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

// Editing toggles into a labeled form on demand rather than always rendering
// one, following the same pattern as MemberRow.
export function DepositRow({ deposit, memberName, members, editDeposit }: DepositRowProps) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-4 text-sm text-ink">
        <span className="flex flex-wrap items-center gap-x-2 font-mono tabular-nums">
          <span className={rowPrimaryClasses}>{memberName}</span>
          <span className={rowMutedClasses}>
            — {deposit.month}/{deposit.year} —
          </span>
          <span className={rowAmountClasses}>Tk {deposit.amount.toFixed(2)}</span>
          <span className={rowMutedClasses}>— paid {formatDate(deposit.paidDate)}</span>
          {deposit.note && <span className={rowNoteClasses}>— {deposit.note}</span>}
        </span>
        <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClasses}>
          Edit
        </button>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-line bg-surface p-4">
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
            defaultValue={formatDate(deposit.paidDate)}
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
    </li>
  );
}
