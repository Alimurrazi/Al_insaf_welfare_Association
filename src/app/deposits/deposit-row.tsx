"use client";

import { useState } from "react";
import { inputClasses, primaryButtonClasses, secondaryButtonClasses } from "@/components/styles";

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
      <li className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-3 text-sm text-ink">
        <span className="flex items-center gap-2 font-mono tabular-nums">
          {memberName} — {deposit.month}/{deposit.year} — ${deposit.amount.toFixed(2)} — paid{" "}
          {formatDate(deposit.paidDate)}
          {deposit.note ? ` — ${deposit.note}` : ""}
        </span>
        <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClasses}>
          Edit
        </button>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-line bg-surface p-3">
      <form
        action={async (formData) => {
          await editDeposit(formData);
          setEditing(false);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="id" value={deposit.id} />
        <label className="flex flex-col gap-1 text-sm text-ink">
          Member
          <select name="memberId" defaultValue={deposit.memberId} className={inputClasses}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Month
          <input
            name="month"
            type="number"
            min={1}
            max={12}
            step={1}
            defaultValue={deposit.month}
            required
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
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
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
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
        <label className="flex flex-col gap-1 text-sm text-ink">
          Paid date
          <input
            name="paidDate"
            type="date"
            defaultValue={formatDate(deposit.paidDate)}
            required
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Note
          <input name="note" type="text" defaultValue={deposit.note ?? ""} className={inputClasses} />
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
