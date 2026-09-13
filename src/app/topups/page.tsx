import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Search } from "lucide-react";
import { auth } from "@/auth";
import { listMembers } from "@/lib/members";
import { createTopup, filterTopups, listTopups, updateTopup } from "@/lib/topups";
import { matchesQuery } from "@/lib/format";
import {
  cardClasses,
  fieldLabelClasses,
  inputClasses,
  pageContainerClasses,
  primaryButtonClasses,
  TOPUPS_ROW_GRID_CLASSES,
} from "@/components/styles";
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

export default async function TopupsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; otpNumber?: string }>;
}) {
  await requireAdminSession();
  const { q, otpNumber: otpNumberParam } = await searchParams;
  const otpNumber = otpNumberParam ? Number(otpNumberParam) : undefined;

  const [members, allTopups] = await Promise.all([listMembers(), listTopups()]);
  const membersById = new Map(members.map((member) => [member.id, member]));

  const byCycle = filterTopups(allTopups, { otpNumber });
  const topups = q
    ? byCycle.filter((topup) => matchesQuery(membersById.get(topup.memberId)?.name ?? "", q))
    : byCycle;

  return (
    <main className={pageContainerClasses}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Annual Top-ups</h1>
          <p className="text-sm text-ink-soft">Large periodic installments toward the land fund.</p>
        </div>
        <AddTopupForm members={members} addTopup={addTopup} />
      </div>

      {/* Field gap + container padding (16px each) match the Figma
          filter-bar measurements — see UI-IMPROVEMENTS.md item 10. */}
      <form action="/topups" method="GET" className={`flex flex-wrap items-end gap-4 ${cardClasses} p-4`}>
        <label className={`${fieldLabelClasses} relative`}>
          <span className="sr-only">Search member</span>
          <Search className="pointer-events-none absolute bottom-2.5 left-3 size-3.5 text-ink-soft" />
          <input
            name="q"
            type="text"
            placeholder="Search member…"
            defaultValue={q ?? ""}
            className={`${inputClasses} w-56 pl-9`}
          />
        </label>
        <label className={fieldLabelClasses}>
          <span className="sr-only">Installment cycle</span>
          <select name="otpNumber" defaultValue={otpNumberParam ?? ""} className={inputClasses}>
            <option value="">All cycles</option>
            {Array.from(new Set(allTopups.map((t) => t.otpNumber)))
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  Installment #{n}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className={primaryButtonClasses}>
          Apply
        </button>
      </form>

      <section className={`flex flex-col gap-0 overflow-hidden ${cardClasses} p-0`}>
        <div className={`${TOPUPS_ROW_GRID_CLASSES} bg-paper px-6 py-3 text-xs font-semibold text-ink-soft`}>
          <span>Member Name</span>
          <span>Year</span>
          <span>Installment Cycle</span>
          <span>Amount Paid</span>
          <span>Paid Date</span>
          <span>Note</span>
          <span className="text-right">Actions</span>
        </div>
        {topups.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">No top-ups match these filters.</p>
        ) : (
          topups.map((topup) => (
            <TopupRow
              key={topup.id}
              topup={{ ...topup, amount: Number(topup.amount) }}
              memberName={membersById.get(topup.memberId)?.name ?? "Unknown member"}
              members={members}
              editTopup={editTopup}
            />
          ))
        )}
      </section>
    </main>
  );
}
