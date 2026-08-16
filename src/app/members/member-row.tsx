"use client";

import { useState } from "react";
import type { Role } from "@/generated/prisma/enums";

interface MemberRowProps {
  member: { id: string; name: string; email: string; role: Role };
  editMember: (formData: FormData) => Promise<void>;
  inputClasses: string;
  buttonClasses: string;
}

// Editing toggles into a labeled form on demand rather than always rendering
// one, so the add-member form's "Name"/"Email"/"Role" labels stay the only
// ones on the page by default (avoids one row per existing member colliding
// with them and with each other).
export function MemberRow({ member, editMember, inputClasses, buttonClasses }: MemberRowProps) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <li className="flex items-center justify-between rounded border border-black/[.08] p-3 text-sm dark:border-white/[.145]">
        <span>
          {member.name} — {member.email} — {member.role}
        </span>
        <button type="button" onClick={() => setEditing(true)} className={buttonClasses}>
          Edit
        </button>
      </li>
    );
  }

  return (
    <li className="rounded border border-black/[.08] p-3 dark:border-white/[.145]">
      <form
        action={async (formData) => {
          await editMember(formData);
          setEditing(false);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="id" value={member.id} />
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input name="name" type="text" defaultValue={member.name} required className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" defaultValue={member.email} required className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Role
          <select name="role" defaultValue={member.role} className={inputClasses}>
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>
        <button type="submit" className={buttonClasses}>
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className={buttonClasses}>
          Cancel
        </button>
      </form>
    </li>
  );
}
