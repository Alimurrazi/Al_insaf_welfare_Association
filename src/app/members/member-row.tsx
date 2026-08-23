"use client";

import { useState } from "react";
import { History, Pencil } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { RoleBadge } from "@/components/role-badge";
import {
  fieldHintClasses,
  fieldLabelClasses,
  formActionsClasses,
  formClasses,
  inputClasses,
  MEMBERS_ROW_GRID_CLASSES,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "@/components/styles";

interface MemberShareEntry {
  id: string;
  shareCount: number;
  effectiveFrom: Date;
}

interface MemberRowProps {
  member: { id: string; name: string; email: string; role: Role };
  editMember: (formData: FormData) => Promise<void>;
  shares: MemberShareEntry[];
  sharePercent: number;
  // Human-readable diff sentences ("Shares changed from 1 to 2, effective 15
  // Mar 2025"), most-recent first — computed server-side via
  // `summarizeShareChanges` (a `@/lib/member-shares` import, which pulls in
  // prisma, can't be used directly in this client component).
  shareChangeSummaries: string[];
  addShare: (formData: FormData) => Promise<void>;
}

// Editing toggles into a labeled form on demand rather than always rendering
// one, so the add-member form's "Name"/"Email"/"Role" labels stay the only
// ones on the page by default (avoids one row per existing member colliding
// with them and with each other).
export function MemberRow({
  member,
  editMember,
  shares,
  sharePercent,
  shareChangeSummaries,
  addShare,
}: MemberRowProps) {
  const [editing, setEditing] = useState(false);
  const [sharesOpen, setSharesOpen] = useState(false);
  // shares is ordered most-recent-effectiveFrom-first (see listMemberShares),
  // so the first row is the count currently in effect.
  const currentShareCount = shares[0]?.shareCount ?? 0;

  if (editing) {
    return (
      <div className="border-t border-line p-4">
        <form
          action={async (formData) => {
            await editMember(formData);
            setEditing(false);
          }}
          className={formClasses}
        >
          <input type="hidden" name="id" value={member.id} />
          <label className={fieldLabelClasses}>
            Name
            <input name="name" type="text" defaultValue={member.name} required className={inputClasses} />
          </label>
          <label className={fieldLabelClasses}>
            Email
            <input name="email" type="email" defaultValue={member.email} required className={inputClasses} />
          </label>
          <label className={fieldLabelClasses}>
            Role
            <select name="role" defaultValue={member.role} className={inputClasses}>
              <option value="MEMBER">MEMBER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
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
      </div>
    );
  }

  return (
    <div className="border-t border-line">
      <div className={`${MEMBERS_ROW_GRID_CLASSES} px-6 py-3.5 text-sm`}>
        <span className="truncate font-semibold text-ink">{member.name}</span>
        <span className="truncate text-ink-soft">{member.email}</span>
        <RoleBadge role={member.role} />
        <span className="font-mono font-semibold tabular-nums text-accent">
          {currentShareCount} {currentShareCount === 1 ? "Share" : "Shares"} ({sharePercent.toFixed(1)}%)
        </span>
        <span className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => setSharesOpen((open) => !open)}
            aria-label={`${sharesOpen ? "Hide" : "Show"} share history for ${member.name}`}
            aria-expanded={sharesOpen}
            className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <History className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${member.name}`}
            className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <Pencil className="size-4" />
          </button>
        </span>
      </div>

      {sharesOpen && (
        <div className="flex flex-col gap-3 border-t border-line bg-paper px-6 py-4">
          {shareChangeSummaries.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-ink-soft">
              {shareChangeSummaries.map((summary, i) => (
                <li key={i}>{summary}</li>
              ))}
            </ul>
          )}
          <form action={addShare} className={formClasses}>
            <input type="hidden" name="memberId" value={member.id} />
            <label className={fieldLabelClasses}>
              Share count
              <input name="shareCount" type="number" min={1} step={1} required className={inputClasses} />
            </label>
            <label className={fieldLabelClasses}>
              Effective from
              <input name="effectiveFrom" type="date" required className={inputClasses} />
              <span className={fieldHintClasses}>The date this update takes effect from</span>
            </label>
            <button type="submit" className={`${primaryButtonClasses} ${formActionsClasses} w-full`}>
              Record change
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
