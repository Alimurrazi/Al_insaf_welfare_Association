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
import { FormFeedback } from "@/components/form-feedback";
import { useServerActionFeedback } from "@/components/use-server-action-feedback";
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
  const { feedback, pending, run } = useServerActionFeedback();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => editDeposit(formData), `Deposit updated for ${memberName}`, () => setEditing(false));
  }

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
      <form onSubmit={handleSubmit} className={formClasses}>
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
