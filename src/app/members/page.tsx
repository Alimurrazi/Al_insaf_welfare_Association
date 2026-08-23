import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { History } from "lucide-react";
import { auth } from "@/auth";
import { createMember, listMembers, updateMember } from "@/lib/members";
import {
  addMemberShare,
  getRecentShareChanges,
  getShareCountAsOf,
  listSharesForMembers,
  summarizeShareChanges,
} from "@/lib/member-shares";
import { formatDate } from "@/lib/format";
import { cardClasses, MEMBERS_ROW_GRID_CLASSES, pageContainerClasses } from "@/components/styles";
import type { Role } from "@/generated/prisma/enums";
import { AddMemberForm } from "./add-member-form";
import { MemberRow } from "./member-row";

async function requireAdminSession() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    notFound();
  }
  return session;
}

async function addMember(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  await createMember(session.user.id, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: formData.get("role") as Role,
  });

  revalidatePath("/members");
}

async function editMember(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  await updateMember(session.user.id, id, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: formData.get("role") as Role,
  });

  revalidatePath("/members");
}

async function addShare(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  const memberId = String(formData.get("memberId") ?? "");
  await addMemberShare(session.user.id, memberId, {
    shareCount: Number(formData.get("shareCount")),
    effectiveFrom: String(formData.get("effectiveFrom")),
  });

  revalidatePath("/members");
}

export default async function MembersPage() {
  await requireAdminSession();
  const members = await listMembers();
  const shareHistories = await listSharesForMembers(members.map((m) => m.id));
  const now = new Date();

  const totalShares = members.reduce(
    (sum, member) => sum + getShareCountAsOf(shareHistories.get(member.id) ?? [], now),
    0,
  );
  const recentShareChanges = getRecentShareChanges(
    members.map((member) => ({ id: member.id, name: member.name, shares: shareHistories.get(member.id) ?? [] })),
    6,
  );

  return (
    <main className={pageContainerClasses}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Group Members Directory</h1>
          <p className="text-sm text-ink-soft">Manage registry access and co-op shares.</p>
        </div>
        <AddMemberForm addMember={addMember} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <section className={`flex flex-1 flex-col gap-0 overflow-hidden ${cardClasses} p-0`}>
          <div className={`${MEMBERS_ROW_GRID_CLASSES} bg-paper px-6 py-3 text-xs font-semibold text-ink-soft`}>
            <span>Member Name</span>
            <span>Email Address</span>
            <span>Access Level</span>
            <span>Shares Assigned</span>
            <span className="text-right">Action</span>
          </div>
          {members.map((member) => {
            const shares = shareHistories.get(member.id) ?? [];
            const currentShareCount = getShareCountAsOf(shares, now);
            const sharePercent = totalShares > 0 ? (currentShareCount / totalShares) * 100 : 0;
            return (
              <MemberRow
                key={member.id}
                member={member}
                editMember={editMember}
                shares={shares}
                sharePercent={sharePercent}
                shareChangeSummaries={summarizeShareChanges(shares)}
                addShare={addShare}
              />
            );
          })}
        </section>

        <section className={`flex w-full flex-col gap-5 lg:w-[380px] lg:shrink-0 ${cardClasses}`}>
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gold-soft text-gold">
              <History className="size-4" />
            </span>
            <h2 className="text-base font-bold text-ink">Share Allocation History</h2>
          </div>
          <div className="h-px w-full bg-line" />
          {recentShareChanges.length === 0 ? (
            <p className="text-sm text-ink-soft">No share changes recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {recentShareChanges.map((change, i) => (
                <li key={i} className="flex flex-col gap-1.5 border-b border-line pb-4 text-sm last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{change.memberName}</span>
                    <span className="text-xs text-ink-soft">{formatDate(change.effectiveFrom)}</span>
                  </div>
                  <span className="w-fit rounded-md bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                    {change.fromCount} {change.fromCount === 1 ? "Share" : "Shares"} → {change.toCount}{" "}
                    {change.toCount === 1 ? "Share" : "Shares"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
