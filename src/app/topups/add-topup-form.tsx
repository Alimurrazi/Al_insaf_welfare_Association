"use client";

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
import { toDateInputValue } from "@/lib/format";

interface AddTopupFormProps {
  members: { id: string; name: string }[];
  addTopup: (formData: FormData) => Promise<void>;
}

// Clears itself after a successful save — unlike deposits, top-ups have no
// "repeat with one field changed" workflow to preserve values for.
export function AddTopupForm({ members, addTopup }: AddTopupFormProps) {
  const { feedback, pending, run } = useServerActionFeedback();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const memberId = String(formData.get("memberId") ?? "");
    const memberName = members.find((member) => member.id === memberId)?.name ?? "the member";
    run(() => addTopup(formData), `Top-up saved for ${memberName}`, () => form.reset());
  }

  return (
    <Modal triggerLabel="+ Add top-up" title="Add a top-up">
      <form onSubmit={handleSubmit} className={formClasses}>
        <label className={fieldLabelClasses}>
          Member
          <select name="memberId" required defaultValue="" className={inputClasses}>
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
          Year
          <input name="year" type="number" min={2000} step={1} required className={inputClasses} />
          <span className={fieldHintClasses}>Which year this top-up counts toward</span>
        </label>
        <label className={fieldLabelClasses}>
          OTP number
          <input name="otpNumber" type="number" min={1} step={1} required className={inputClasses} />
          <span className={fieldHintClasses}>Installment 1 or 2 of the annual top-up</span>
        </label>
        <label className={fieldLabelClasses}>
          Amount
          <input name="amount" type="number" min={0.01} step={0.01} required className={inputClasses} />
        </label>
        <label className={fieldLabelClasses}>
          Paid date
          <input
            name="paidDate"
            type="date"
            required
            defaultValue={toDateInputValue(new Date())}
            className={inputClasses}
          />
          <span className={fieldHintClasses}>When the payment was actually received</span>
        </label>
        <label className={fieldLabelClasses}>
          Note
          <input name="note" type="text" className={inputClasses} />
        </label>
        <div className={`flex flex-col gap-3 ${formActionsClasses}`}>
          <FormFeedback feedback={feedback} />
          <button
            type="submit"
            disabled={pending}
            className={`${primaryButtonClasses} w-full disabled:opacity-60`}
          >
            {pending ? "Adding…" : "Add top-up"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
