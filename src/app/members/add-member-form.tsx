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

interface AddMemberFormProps {
  addMember: (formData: FormData) => Promise<void>;
}

export function AddMemberForm({ addMember }: AddMemberFormProps) {
  const { feedback, pending, run } = useServerActionFeedback();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "");
    run(() => addMember(formData), `Member added — ${name}`, () => form.reset());
  }

  return (
    <Modal triggerLabel="+ Add member" title="Add a member">
      <form onSubmit={handleSubmit} className={formClasses}>
        <label className={fieldLabelClasses}>
          Name
          <input name="name" type="text" required className={inputClasses} />
        </label>
        <label className={fieldLabelClasses}>
          Email
          <input name="email" type="email" required className={inputClasses} />
        </label>
        <label className={fieldLabelClasses}>
          Role
          <select name="role" defaultValue="MEMBER" className={inputClasses}>
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>
        <div className={`flex flex-col gap-3 ${formActionsClasses}`}>
          <FormFeedback feedback={feedback} />
          <button
            type="submit"
            disabled={pending}
            className={`${primaryButtonClasses} w-full disabled:opacity-60`}
          >
            {pending ? "Adding…" : "Add member"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
