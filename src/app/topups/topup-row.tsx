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
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";

interface TopupRowProps {
  topup: {
    id: string;
    memberId: string;
    year: number;
    otpNumber: number;
    amount: number;
    paidDate: Date;
    note: string | null;
  };
  memberName: string;
  members: { id: string; name: string }[];
  editTopup: (formData: FormData) => Promise<void>;
}

// Editing toggles into a labeled form on demand rather than always rendering
// one, following the same pattern as DepositRow/MemberRow.
export function TopupRow({ topup, memberName, members, editTopup }: TopupRowProps) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-4 text-sm text-ink">
        <span className="flex flex-wrap items-center gap-x-2 font-mono tabular-nums">
          <span className={rowPrimaryClasses}>{memberName}</span>
          <span className={rowMutedClasses}>
            — {topup.year} OTP #{topup.otpNumber} —
          </span>
          <span className={rowAmountClasses}>{formatCurrency(topup.amount)}</span>
          <span className={rowMutedClasses}>— paid {formatDate(topup.paidDate)}</span>
          {topup.note && <span className={rowNoteClasses}>— {topup.note}</span>}
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
          await editTopup(formData);
          setEditing(false);
        }}
        className={formClasses}
      >
        <input type="hidden" name="id" value={topup.id} />
        <label className={fieldLabelClasses}>
          Member
          <select name="memberId" defaultValue={topup.memberId} className={inputClasses}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabelClasses}>
          Year
          <input
            name="year"
            type="number"
            min={2000}
            step={1}
            defaultValue={topup.year}
            required
            className={inputClasses}
          />
          <span className={fieldHintClasses}>Which year this top-up counts toward</span>
        </label>
        <label className={fieldLabelClasses}>
          OTP number
          <input
            name="otpNumber"
            type="number"
            min={1}
            step={1}
            defaultValue={topup.otpNumber}
            required
            className={inputClasses}
          />
          <span className={fieldHintClasses}>Installment 1 or 2 of the annual top-up</span>
        </label>
        <label className={fieldLabelClasses}>
          Amount
          <input
            name="amount"
            type="number"
            min={0.01}
            step={0.01}
            defaultValue={topup.amount}
            required
            className={inputClasses}
          />
        </label>
        <label className={fieldLabelClasses}>
          Paid date
          <input
            name="paidDate"
            type="date"
            defaultValue={toDateInputValue(topup.paidDate)}
            required
            className={inputClasses}
          />
          <span className={fieldHintClasses}>When the payment was actually received</span>
        </label>
        <label className={fieldLabelClasses}>
          Note
          <input name="note" type="text" defaultValue={topup.note ?? ""} className={inputClasses} />
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
