import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createMember, listMembers, updateMember } from "@/lib/members";
import { addMemberShare, listSharesForMembers } from "@/lib/member-shares";
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

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-ink">Manage Members</h1>
        <AddMemberForm addMember={addMember} />
      </div>

      <section className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Directory
        </p>
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              editMember={editMember}
              shares={shareHistories.get(member.id) ?? []}
              addShare={addShare}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}
