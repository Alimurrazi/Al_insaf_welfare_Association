"use client";

import { useState } from "react";
import type { Role } from "@/generated/prisma/enums";
import { RoleBadge } from "@/components/role-badge";
import { inputClasses, primaryButtonClasses, secondaryButtonClasses } from "./styles";

interface MemberRowProps {
  member: { id: string; name: string; email: string; role: Role };
  editMember: (formData: FormData) => Promise<void>;
}

// Editing toggles into a labeled form on demand rather than always rendering
// one, so the add-member form's "Name"/"Email"/"Role" labels stay the only
// ones on the page by default (avoids one row per existing member colliding
// with them and with each other).
export function MemberRow({ member, editMember }: MemberRowProps) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-3 text-sm text-ink">
        <span className="flex items-center gap-2">
          {member.name} — {member.email} <RoleBadge role={member.role} />
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
          await editMember(formData);
          setEditing(false);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="id" value={member.id} />
        <label className="flex flex-col gap-1 text-sm text-ink">
          Name
          <input name="name" type="text" defaultValue={member.name} required className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Email
          <input name="email" type="email" defaultValue={member.email} required className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Role
          <select name="role" defaultValue={member.role} className={inputClasses}>
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
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
