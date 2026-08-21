import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { listMembers } from "@/lib/members";
import { createTopup, listTopups, updateTopup } from "@/lib/topups";
import { AddTopupForm } from "./add-topup-form";
import { TopupRow } from "./topup-row";

async function requireAdminSession() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    notFound();
  }
  return session;
}

async function addTopup(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  await createTopup(session.user.id, {
    memberId: String(formData.get("memberId") ?? ""),
    year: Number(formData.get("year")),
    otpNumber: Number(formData.get("otpNumber")),
    amount: Number(formData.get("amount")),
    paidDate: String(formData.get("paidDate")),
    note: formData.get("note") ? String(formData.get("note")) : undefined,
  });

  revalidatePath("/topups");
}

async function editTopup(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  await updateTopup(session.user.id, id, {
    memberId: String(formData.get("memberId") ?? ""),
    year: Number(formData.get("year")),
    otpNumber: Number(formData.get("otpNumber")),
    amount: Number(formData.get("amount")),
    paidDate: String(formData.get("paidDate")),
    note: formData.get("note") ? String(formData.get("note")) : undefined,
  });

  revalidatePath("/topups");
}

export default async function TopupsPage() {
  await requireAdminSession();
  const [members, topups] = await Promise.all([listMembers(), listTopups()]);
  const membersById = new Map(members.map((member) => [member.id, member]));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-ink">Manage Annual Top-ups</h1>
        <AddTopupForm members={members} addTopup={addTopup} />
      </div>

      <section className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Top-ups
        </p>
        <ul className="flex flex-col gap-2">
          {topups.map((topup) => (
            <TopupRow
              key={topup.id}
              topup={{ ...topup, amount: Number(topup.amount) }}
              memberName={membersById.get(topup.memberId)?.name ?? "Unknown member"}
              members={members}
              editTopup={editTopup}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}
