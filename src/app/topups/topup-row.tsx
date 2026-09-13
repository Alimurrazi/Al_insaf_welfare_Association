"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  fieldHintClasses,
  fieldLabelClasses,
  formActionsClasses,
  formClasses,
  inputClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
  TOPUPS_ROW_GRID_CLASSES,
} from "@/components/styles";
import { FormFeedback } from "@/components/form-feedback";
import { useServerActionFeedback } from "@/components/use-server-action-feedback";
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
  const { feedback, pending, run } = useServerActionFeedback();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => editTopup(formData), `Top-up updated for ${memberName}`, () => setEditing(false));
  }

  if (!editing) {
    return (
      <div className={`${TOPUPS_ROW_GRID_CLASSES} border-t border-line px-6 py-3.5 text-sm`}>
        <span className="font-semibold text-ink">{memberName}</span>
        <span className="text-ink-soft">{topup.year}</span>
        <span className="text-ink-soft">Installment #{topup.otpNumber}</span>
        <span className="font-mono font-semibold tabular-nums text-accent">{formatCurrency(topup.amount)}</span>
        <span className="text-ink-soft">{formatDate(topup.paidDate)}</span>
        <span className="truncate italic text-ink-soft">{topup.note}</span>
        <span className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit top-up for ${memberName}`}
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
