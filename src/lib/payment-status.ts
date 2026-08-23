import { listMembers } from "./members";
import { listDeposits } from "./deposits";
import { getShareCountAsOf, listSharesForMembers } from "./member-shares";

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

// The 1st of the month after `now` — computed, not stored. Uses UTC fields
// throughout (see format.ts) so the result agrees with how dates are stored
// (UTC midnight) and formatted elsewhere, regardless of server timezone.
export function getNextPaymentDue(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

// Admin dashboard needs "who hasn't paid this month yet" — one query for
// all members and one for all deposits, rather than a per-member query,
// following the same pattern as listSharesForMembers.
export async function getUnpaidMembers(month: number, year: number) {
  const [members, deposits] = await Promise.all([listMembers(), listDeposits()]);

  const paidMemberIds = new Set(
    deposits.filter((deposit) => deposit.month === month && deposit.year === year).map((deposit) => deposit.memberId),
  );

  const unpaid = members.filter((member) => !paidMemberIds.has(member.id));
  const sharesByMember = await listSharesForMembers(unpaid.map((member) => member.id));
  const now = new Date();

  return unpaid.map((member) => ({
    ...member,
    shareCount: getShareCountAsOf(sharesByMember.get(member.id) ?? [], now),
  }));
}
