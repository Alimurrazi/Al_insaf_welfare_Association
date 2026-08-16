import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createMember, listMembers, updateMember } from "@/lib/members";
import type { Role } from "@/generated/prisma/enums";
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

const inputClasses =
  "rounded border border-black/[.08] bg-transparent px-2 py-1 text-sm dark:border-white/[.145]";
const buttonClasses =
  "rounded border border-black/[.08] px-3 py-1 text-sm transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.08]";

export default async function MembersPage() {
  await requireAdminSession();
  const members = await listMembers();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <h1 className="text-xl font-semibold">Manage Members</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Add a member
        </h2>
        <form action={addMember} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input name="name" type="text" required className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input name="email" type="email" required className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Role
            <select name="role" defaultValue="MEMBER" className={inputClasses}>
              <option value="MEMBER">MEMBER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <button type="submit" className={buttonClasses}>
            Add member
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Directory
        </p>
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              editMember={editMember}
              inputClasses={inputClasses}
              buttonClasses={buttonClasses}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}
