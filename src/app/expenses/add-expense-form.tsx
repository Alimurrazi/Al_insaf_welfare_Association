"use client";

import {
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

interface AddExpenseFormProps {
  addExpense: (formData: FormData) => Promise<void>;
}

// Unlike AddDepositForm, this form clears itself after a successful save —
// expenses are one-off entries with no "repeat with one field changed"
// workflow to preserve, so a blank form ready for the next entry is friendlier.
export function AddExpenseForm({ addExpense }: AddExpenseFormProps) {
  const { feedback, pending, run } = useServerActionFeedback();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const category = String(formData.get("category") ?? "");
    run(() => addExpense(formData), `Expense saved — ${category}`, () => form.reset());
  }

  return (
    <Modal triggerLabel="+ Add expense" title="Add an expense">
      <form onSubmit={handleSubmit} className={formClasses}>
        <label className={fieldLabelClasses}>
          Date
          <input
            name="date"
            type="date"
            required
            defaultValue={toDateInputValue(new Date())}
            className={inputClasses}
          />
        </label>
        <label className={fieldLabelClasses}>
          Category
          <input name="category" type="text" required className={inputClasses} />
        </label>
        <label className={fieldLabelClasses}>
          Amount
          <input name="amount" type="number" min={0.01} step={0.01} required className={inputClasses} />
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
            {pending ? "Adding…" : "Add expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
