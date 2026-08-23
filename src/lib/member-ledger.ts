import { prisma } from "./prisma";
import { MemberNotFoundError } from "./members";
import { listDepositsForMember } from "./deposits";
import { listTopupsForMember } from "./topups";
import { getShareCountAsOf, listMemberShares } from "./member-shares";
import { formatMonthYear } from "./format";

export interface LedgerTransaction {
  id: string;
  type: "DEPOSIT" | "TOPUP";
  date: Date;
  amount: number;
  label: string;
  note: string | null;
}

// Merges deposits + top-ups into one passbook-style transaction list,
// most-recent-first for display, each carrying a running balance computed
// from chronological (oldest-first) accumulation — nothing is stored, so
// this doesn't conflict with the "never a running balance" rule in
// CLAUDE.md (deposits/topups each remain their own independently amounted
// row; the balance is derived at render time).
export function mergeTransactionsWithRunningBalance(
  deposits: { id: string; amount: unknown; paidDate: Date; month: number; year: number; note: string | null }[],
  topups: { id: string; amount: unknown; paidDate: Date; year: number; otpNumber: number; note: string | null }[],
): (LedgerTransaction & { balance: number })[] {
  const merged: LedgerTransaction[] = [
    ...deposits.map((deposit) => ({
      id: deposit.id,
      type: "DEPOSIT" as const,
      date: new Date(deposit.paidDate),
      amount: Number(deposit.amount),
      label: `Monthly Deposit — ${formatMonthYear(deposit.month, deposit.year)}`,
      note: deposit.note,
    })),
    ...topups.map((topup) => ({
      id: topup.id,
      type: "TOPUP" as const,
      date: new Date(topup.paidDate),
      amount: Number(topup.amount),
      label: `Top-up — ${topup.year}, Installment #${topup.otpNumber}`,
      note: topup.note,
    })),
  ];

  const ascending = [...merged].sort((a, b) => a.date.getTime() - b.date.getTime());
  let running = 0;
  const balanceById = new Map<string, number>();
  for (const transaction of ascending) {
    running += transaction.amount;
    balanceById.set(transaction.id, running);
  }

  const descending = [...merged].sort((a, b) => b.date.getTime() - a.date.getTime());
  return descending.map((transaction) => ({ ...transaction, balance: balanceById.get(transaction.id)! }));
}

export async function getMemberLedger(memberId: string, asOfDate: Date) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw new MemberNotFoundError(memberId);
  }

  const [deposits, topups, shareHistory] = await Promise.all([
    listDepositsForMember(memberId),
    listTopupsForMember(memberId),
    listMemberShares(memberId),
  ]);

  const totalPaid =
    deposits.reduce((sum, deposit) => sum + Number(deposit.amount), 0) +
    topups.reduce((sum, topup) => sum + Number(topup.amount), 0);

  return {
    member,
    deposits,
    topups,
    shareHistory,
    currentShareCount: getShareCountAsOf(shareHistory, asOfDate),
    totalPaid,
    transactions: mergeTransactionsWithRunningBalance(deposits, topups),
  };
}
