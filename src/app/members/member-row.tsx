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
import { FormFeedback } from "@/components/form-feedback";
import { useServerActionFeedback } from "@/components/use-server-action-feedback";
import { toDateInputValue } from "@/lib/format";

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
  const [panelOpen, setPanelOpen] = useState(false);
  const { feedback, pending, run } = useServerActionFeedback();
  // shares is ordered most-recent-effectiveFrom-first (see listMemberShares),
  // so the first row is the count currently in effect.
  const currentShareCount = shares[0]?.shareCount ?? 0;

  // Deliberately does not close the panel on success (unlike Expense/Topup/
  // DepositRow) — the panel is also where the share-change history is shown,
  // so an admin wants to see it stay open right after saving to confirm the
  // new entry landed.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(async () => {
      await editMember(formData);
      const shareCount = Number(formData.get("shareCount"));
      const effectiveFrom = String(formData.get("effectiveFrom") ?? "");
      if (shareCount > 0 && effectiveFrom) {
        await addShare(formData);
      }
    }, `Member updated — ${member.name}`);
  }

  return (
    <div className="border-t border-line">
      <div className={`${MEMBERS_ROW_GRID_CLASSES} pl-6 pr-8 py-3.5 text-sm`}>
        <span className="truncate font-semibold text-ink">{member.name}</span>
        <span className="truncate text-ink-soft">{member.email}</span>
        <RoleBadge role={member.role} />
        <span className="font-mono font-semibold tabular-nums text-accent">
          {currentShareCount} {currentShareCount === 1 ? "Share" : "Shares"} ({sharePercent.toFixed(1)}%)
        </span>
        <span className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-label={`${panelOpen ? "Close" : "Manage"} ${member.name}`}
            aria-expanded={panelOpen}
            className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <Pencil className="size-4" />
          </button>
        </span>
      </div>

      {/* One panel, one form, one submit — but still two underlying writes:
          editMember always runs, and addShare only runs when share fields
          are filled in, because a share change must always be recorded as
          a new, dated member_shares row rather than an overwrite of the
          member (see CLAUDE.md). Share fields are optional here so a plain
          info edit can submit without also requiring a share count. */}
      {panelOpen && (
        <div className="flex flex-col gap-5 border-t border-line bg-paper px-6 py-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="memberId" value={member.id} />

            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Personal Info</h4>
              <div className={formClasses}>
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
              </div>
            </div>

            <div className="h-px w-full bg-line" />

            <div className="flex flex-col gap-3">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                <History className="size-3.5" />
                Shares
              </h4>
              {shareChangeSummaries.length > 0 && (
                <ul className="flex flex-col gap-1 text-xs text-ink-soft">
                  {shareChangeSummaries.map((summary, i) => (
                    <li key={i}>{summary}</li>
                  ))}
                </ul>
              )}
              <div className={formClasses}>
                <label className={fieldLabelClasses}>
                  Share count
                  <input name="shareCount" type="number" min={1} step={1} className={inputClasses} />
                  <span className={fieldHintClasses}>Leave blank to keep the current share count</span>
                </label>
                <label className={fieldLabelClasses}>
                  Effective from
                  <input
                    name="effectiveFrom"
                    type="date"
                    defaultValue={toDateInputValue(new Date())}
                    className={inputClasses}
                  />
                  <span className={fieldHintClasses}>The date this update takes effect from</span>
                </label>
              </div>
            </div>

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
                  onClick={() => setPanelOpen(false)}
                  disabled={pending}
                  className={`${secondaryButtonClasses} flex-1 disabled:opacity-60`}
                >
                  Close
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
