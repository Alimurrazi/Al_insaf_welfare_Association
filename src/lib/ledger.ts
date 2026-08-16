import { prisma } from "./prisma";
import { listMembers } from "./members";

export interface LedgerEntry {
  id: string;
  amount: number;
  paidDate: Date;
}

export interface LedgerRow {
  memberId: string;
  memberName: string;
  months: LedgerEntry[][];
  otp1: LedgerEntry[];
  otp2: LedgerEntry[];
}

// Mirrors the paper logbook: one row per member, one column per month plus
// OTP-1/OTP-2. A cell is an array (not a single entry) because the schema
// has no unique constraint on (memberId, month, year) or (memberId, year,
// otpNumber) — more than one payment can legitimately land in the same
// cell, and silently dropping/merging duplicates would hide real money.
export async function getLedgerGrid(year: number): Promise<LedgerRow[]> {
  const [members, deposits, topups] = await Promise.all([
    listMembers(),
    prisma.monthlyDeposit.findMany({ where: { year } }),
    prisma.annualTopup.findMany({ where: { year } }),
  ]);

  const depositsByMember = new Map<string, typeof deposits>();
  for (const deposit of deposits) {
    const list = depositsByMember.get(deposit.memberId);
    if (list) {
      list.push(deposit);
    } else {
      depositsByMember.set(deposit.memberId, [deposit]);
    }
  }

  const topupsByMember = new Map<string, typeof topups>();
  for (const topup of topups) {
    const list = topupsByMember.get(topup.memberId);
    if (list) {
      list.push(topup);
    } else {
      topupsByMember.set(topup.memberId, [topup]);
    }
  }

  return members.map((member) => {
    const memberDeposits = depositsByMember.get(member.id) ?? [];
    const memberTopups = topupsByMember.get(member.id) ?? [];

    const months: LedgerEntry[][] = Array.from({ length: 12 }, (_, i) =>
      memberDeposits
        .filter((deposit) => deposit.month === i + 1)
        .map((deposit) => ({
          id: deposit.id,
          amount: Number(deposit.amount),
          paidDate: deposit.paidDate,
        })),
    );

    const toEntry = (topup: (typeof memberTopups)[number]): LedgerEntry => ({
      id: topup.id,
      amount: Number(topup.amount),
      paidDate: topup.paidDate,
    });

    return {
      memberId: member.id,
      memberName: member.name,
      months,
      otp1: memberTopups.filter((topup) => topup.otpNumber === 1).map(toEntry),
      otp2: memberTopups.filter((topup) => topup.otpNumber === 2).map(toEntry),
    };
  });
}
