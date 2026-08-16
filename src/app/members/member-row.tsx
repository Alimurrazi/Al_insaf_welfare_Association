"use client";

import { useState } from "react";
import type { Role } from "@/generated/prisma/enums";
import { RoleBadge } from "@/components/role-badge";
import { inputClasses, primaryButtonClasses, secondaryButtonClasses } from "./styles";

interface MemberShareEntry {
  id: string;
  shareCount: number;
  effectiveFrom: Date;
}

interface MemberRowProps {
  member: { id: string; name: string; email: string; role: Role };
  editMember: (formData: FormData) => Promise<void>;
  shares: MemberShareEntry[];
  addShare: (formData: FormData) => Promise<void>;
}

function formatDate(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

// Editing toggles into a labeled form on demand rather than always rendering
// one, so the add-member form's "Name"/"Email"/"Role" labels stay the only
// ones on the page by default (avoids one row per existing member colliding
// with them and with each other).
export function MemberRow({ member, editMember, shares, addShare }: MemberRowProps) {
  const [editing, setEditing] = useState(false);
  const [sharesOpen, setSharesOpen] = useState(false);
  // shares is ordered most-recent-effectiveFrom-first (see listMemberShares),
  // so the first row is the count currently in effect.
  const currentShareCount = shares[0]?.shareCount ?? 0;

  if (!editing) {
    return (
      <li className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3 text-sm text-ink">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            {member.name} — {member.email} <RoleBadge role={member.role} />
            <span className="font-mono text-xs tabular-nums text-ink-soft">
              {currentShareCount} {currentShareCount === 1 ? "share" : "shares"}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSharesOpen((open) => !open)}
              className={secondaryButtonClasses}
            >
              {sharesOpen ? "Hide shares" : "Shares"}
            </button>
            <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClasses}>
              Edit
            </button>
          </span>
        </div>

        {sharesOpen && (
          <div className="flex flex-col gap-3 border-t border-line pt-3">
            {shares.length > 0 && (
              <ul className="flex flex-col gap-1 font-mono text-xs tabular-nums text-ink-soft">
                {shares.map((share) => (
                  <li key={share.id}>
                    {share.shareCount} shares from {formatDate(share.effectiveFrom)}
                  </li>
                ))}
              </ul>
            )}
            <form action={addShare} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="memberId" value={member.id} />
              <label className="flex flex-col gap-1 text-sm text-ink">
                Share count
                <input name="shareCount" type="number" min={1} step={1} required className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Effective from
                <input name="effectiveFrom" type="date" required className={inputClasses} />
              </label>
              <button type="submit" className={primaryButtonClasses}>
                Record change
              </button>
            </form>
          </div>
        )}
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
