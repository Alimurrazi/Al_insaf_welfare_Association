import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { listMembers } from "@/lib/members";
import { createTopup, listTopups, updateTopup } from "@/lib/topups";
import {
  fieldHintClasses,
  fieldLabelClasses,
  formActionsClasses,
  formClasses,
  inputClasses,
  primaryButtonClasses,
} from "@/components/styles";
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
      <h1 className="font-display text-xl font-bold text-ink">Manage Annual Top-ups</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Add a top-up
        </h2>
        <form action={addTopup} className={formClasses}>
          <label className={fieldLabelClasses}>
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
          <label className={fieldLabelClasses}>
            Year
            <input name="year" type="number" min={2000} step={1} required className={inputClasses} />
            <span className={fieldHintClasses}>Which year this top-up counts toward</span>
          </label>
          <label className={fieldLabelClasses}>
            OTP number
            <input name="otpNumber" type="number" min={1} step={1} required className={inputClasses} />
            <span className={fieldHintClasses}>Installment 1 or 2 of the annual top-up</span>
          </label>
          <label className={fieldLabelClasses}>
            Amount
            <input name="amount" type="number" min={0.01} step={0.01} required className={inputClasses} />
          </label>
          <label className={fieldLabelClasses}>
            Paid date
            <input name="paidDate" type="date" required className={inputClasses} />
            <span className={fieldHintClasses}>When the payment was actually received</span>
          </label>
          <label className={fieldLabelClasses}>
            Note
            <input name="note" type="text" className={inputClasses} />
          </label>
          <button type="submit" className={`${primaryButtonClasses} ${formActionsClasses} w-full`}>
            Add top-up
          </button>
        </form>
      </section>

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
