"use client";

import { useState } from "react";
import {
  fieldHintClasses,
  fieldLabelClasses,
  formActionsClasses,
  formClasses,
  inputClasses,
  primaryButtonClasses,
} from "@/components/styles";
import { Modal } from "@/components/modal";
import { FormFeedback } from "@/components/form-feedback";
import { useServerActionFeedback } from "@/components/use-server-action-feedback";
import { MONTH_NAMES } from "@/lib/month-names";

interface AddDepositFormProps {
  members: { id: string; name: string }[];
  addDeposit: (formData: FormData) => Promise<void>;
  // Pre-selects a member and opens the modal automatically — used by the
  // dashboard's per-row "Log Payment" shortcut (`/deposits?memberId=...`),
  // so an admin doesn't have to re-find the member in the dropdown.
  defaultMemberId?: string;
}

// Month/year are deliberately separate from paid date (a payment can be
// early/late, or one paid-date can cover several months — see the "Paid
// date" hint below), so they stay independently editable. But the common
// case is "paid on time", so picking a paid date fills in a matching
// month/year as a starting guess — entering a second month for the same
// payment (the lump-sum/advance-payment case) is then just: submit, then
// change only the Month dropdown before submitting again.
//
// Every field is controlled and submission is handled manually (rather
// than passing `addDeposit` straight to the form's `action` prop) so nothing
// gets cleared after a successful submit — React 19 auto-resets a form's
// *uncontrolled* fields once a declarative form action succeeds, which both
// fights a controlled <select> (it can get stuck showing the reset option)
// and would undo the "keep everything, just change Month" workflow this
// form exists for. The modal itself stays open after a successful save for
// the same reason — closing it would kill the "add another month" flow.
export function AddDepositForm({ members, addDeposit, defaultMemberId }: AddDepositFormProps) {
  const [memberId, setMemberId] = useState(defaultMemberId ?? "");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [note, setNote] = useState("");
  const { feedback, pending, run } = useServerActionFeedback();

  function handlePaidDateChange(value: string) {
    setPaidDate(value);
    if (!value) return;
    const [y, m] = value.split("-");
    setYear(y);
    setMonth(String(Number(m)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const memberName = members.find((member) => member.id === memberId)?.name ?? "the member";
    const monthLabel = month ? MONTH_NAMES[Number(month) - 1] : "";
    run(() => addDeposit(formData), `Deposit saved for ${memberName} — ${monthLabel} ${year}`.trim());
  }

  return (
    <Modal triggerLabel="+ Add deposit" title="Add a deposit" defaultOpen={!!defaultMemberId}>
      <form onSubmit={handleSubmit} className={formClasses}>
        <label className={fieldLabelClasses}>
          Member
          <select
            name="memberId"
            required
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className={inputClasses}
          >
            <option value="" disabled>
              Select member
            </option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabelClasses}>
          Month
          <select
            name="month"
            required
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={inputClasses}
          >
            <option value="" disabled>
              Select month
            </option>
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
            required
            value={year}
            onChange={(e) => setYear(e.target.value)}
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
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClasses}
          />
        </label>
        <label className={fieldLabelClasses}>
          Paid date
          <input
            name="paidDate"
            type="date"
            required
            value={paidDate}
            onChange={(e) => handlePaidDateChange(e.target.value)}
            className={inputClasses}
          />
          <span className={fieldHintClasses}>
            The actual date payment was received — fills in the period above to match, but it stays
            changeable (e.g. one payment covering two periods)
          </span>
        </label>
        <label className={fieldLabelClasses}>
          Note
          <input
            name="note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClasses}
          />
        </label>
        <div className={`flex flex-col gap-3 ${formActionsClasses}`}>
          <FormFeedback feedback={feedback} />
          <button
            type="submit"
            disabled={pending}
            className={`${primaryButtonClasses} w-full disabled:opacity-60`}
          >
            {pending ? "Adding…" : "Add deposit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
