import { listMembers } from "./members";
import { listDeposits } from "./deposits";

// Pure function over an already-fetched deposit list (e.g. from
// getMemberLedger) — no DB access needed, since the caller already has the
// rows it needs from another query.
export function getPaidMonths(deposits: { month: number; year: number }[], year: number): Set<number> {
  const months = new Set<number>();
  for (const deposit of deposits) {
    if (deposit.year === year) months.add(deposit.month);
  }
  return months;
}

// Admin dashboard needs "who hasn't paid this month yet" — one query for
// all members and one for all deposits, rather than a per-member query,
// following the same pattern as listSharesForMembers.
export async function getUnpaidMembers(month: number, year: number) {
  const [members, deposits] = await Promise.all([listMembers(), listDeposits()]);

  const paidMemberIds = new Set(
    deposits.filter((deposit) => deposit.month === month && deposit.year === year).map((deposit) => deposit.memberId),
  );

  return members.filter((member) => !paidMemberIds.has(member.id));
}
