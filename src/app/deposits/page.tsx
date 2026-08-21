import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { listMembers } from "@/lib/members";
import { createDeposit, listDeposits, updateDeposit } from "@/lib/deposits";
import { AddDepositForm } from "./add-deposit-form";
import { DepositRow } from "./deposit-row";

async function requireAdminSession() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    notFound();
  }
  return session;
}

async function addDeposit(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  await createDeposit(session.user.id, {
    memberId: String(formData.get("memberId") ?? ""),
    month: Number(formData.get("month")),
    year: Number(formData.get("year")),
    amount: Number(formData.get("amount")),
    paidDate: String(formData.get("paidDate")),
    note: formData.get("note") ? String(formData.get("note")) : undefined,
  });

  revalidatePath("/deposits");
}

async function editDeposit(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  await updateDeposit(session.user.id, id, {
    memberId: String(formData.get("memberId") ?? ""),
    month: Number(formData.get("month")),
    year: Number(formData.get("year")),
    amount: Number(formData.get("amount")),
    paidDate: String(formData.get("paidDate")),
    note: formData.get("note") ? String(formData.get("note")) : undefined,
  });

  revalidatePath("/deposits");
}

export default async function DepositsPage() {
  await requireAdminSession();
  const [members, deposits] = await Promise.all([listMembers(), listDeposits()]);
  const membersById = new Map(members.map((member) => [member.id, member]));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-ink">Manage Deposits</h1>
        <AddDepositForm members={members} addDeposit={addDeposit} />
      </div>

      <section className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Deposits
        </p>
        <ul className="flex flex-col gap-2">
          {deposits.map((deposit) => (
            <DepositRow
              key={deposit.id}
              deposit={{ ...deposit, amount: Number(deposit.amount) }}
              memberName={membersById.get(deposit.memberId)?.name ?? "Unknown member"}
              members={members}
              editDeposit={editDeposit}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}
