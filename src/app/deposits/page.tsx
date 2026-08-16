import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { listMembers } from "@/lib/members";
import { createDeposit, listDeposits, updateDeposit } from "@/lib/deposits";
import { inputClasses, primaryButtonClasses } from "@/components/styles";
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
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <h1 className="font-display text-xl font-bold text-ink">Manage Deposits</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Add a deposit
        </h2>
        <form action={addDeposit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Member
            <select name="memberId" required defaultValue="" className={inputClasses}>
              <option value="" disabled>
                Select member
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Month
            <input name="month" type="number" min={1} max={12} step={1} required className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Year
            <input name="year" type="number" min={2000} step={1} required className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Amount
            <input name="amount" type="number" min={0.01} step={0.01} required className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Paid date
            <input name="paidDate" type="date" required className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Note
            <input name="note" type="text" className={inputClasses} />
          </label>
          <button type="submit" className={primaryButtonClasses}>
            Add deposit
          </button>
        </form>
      </section>

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
