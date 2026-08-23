import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Search } from "lucide-react";
import { auth } from "@/auth";
import { listMembers } from "@/lib/members";
import { createDeposit, filterDeposits, listDeposits, updateDeposit } from "@/lib/deposits";
import { matchesQuery } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/month-names";
import {
  cardClasses,
  DEPOSITS_ROW_GRID_CLASSES,
  fieldLabelClasses,
  inputClasses,
  pageContainerClasses,
  primaryButtonClasses,
} from "@/components/styles";
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

export default async function DepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string; year?: string; memberId?: string }>;
}) {
  await requireAdminSession();
  const { q, month: monthParam, year: yearParam, memberId: prefillMemberId } = await searchParams;
  const month = monthParam ? Number(monthParam) : undefined;
  const year = yearParam ? Number(yearParam) : undefined;

  const [members, allDeposits] = await Promise.all([listMembers(), listDeposits()]);
  const membersById = new Map(members.map((member) => [member.id, member]));

  const byPeriod = filterDeposits(allDeposits, { month, year });
  const deposits = q
    ? byPeriod.filter((deposit) => matchesQuery(membersById.get(deposit.memberId)?.name ?? "", q))
    : byPeriod;

  return (
    <main className={pageContainerClasses}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Monthly Deposits</h1>
          <p className="text-sm text-ink-soft">Manage and log monthly group contributions for the land fund.</p>
        </div>
        <AddDepositForm members={members} addDeposit={addDeposit} defaultMemberId={prefillMemberId} />
      </div>

      {/* Field gaps (16px) and container padding (16px) match the Figma
          filter-bar measurements exactly (`filter-bar` node in the Figma
          file: search/month/year fields are each 16px apart, in a 16px-padded
          container) — see UI-IMPROVEMENTS.md item 10. */}
      <form action="/deposits" method="GET" className={`flex flex-wrap items-end gap-4 ${cardClasses} p-4`}>
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
          <span className="sr-only">Month</span>
          <select name="month" defaultValue={monthParam ?? ""} className={inputClasses}>
            <option value="">All Months</option>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabelClasses}>
          <span className="sr-only">Year</span>
          <select name="year" defaultValue={yearParam ?? ""} className={inputClasses}>
            <option value="">All years</option>
            {Array.from(new Set(allDeposits.map((d) => d.year)))
              .sort((a, b) => b - a)
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className={primaryButtonClasses}>
          Apply
        </button>
      </form>

      <section className={`flex flex-col gap-0 overflow-hidden ${cardClasses} p-0`}>
        <div className={`${DEPOSITS_ROW_GRID_CLASSES} bg-paper px-6 py-3 text-xs font-semibold text-ink-soft`}>
          <span>Member Name</span>
          <span>Month/Year</span>
          <span>Amount</span>
          <span>Paid Date</span>
          <span>Note</span>
          <span className="text-right">Actions</span>
        </div>
        {deposits.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">No deposits match these filters.</p>
        ) : (
          deposits.map((deposit) => (
            <DepositRow
              key={deposit.id}
              deposit={{ ...deposit, amount: Number(deposit.amount) }}
              memberName={membersById.get(deposit.memberId)?.name ?? "Unknown member"}
              members={members}
              editDeposit={editDeposit}
            />
          ))
        )}
      </section>
    </main>
  );
}
