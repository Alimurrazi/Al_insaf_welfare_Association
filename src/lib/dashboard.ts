import { listDeposits } from "./deposits";
import { listTopups } from "./topups";
import { listExpenses } from "./expenses";

function sumAmounts(rows: { amount: unknown }[]): number {
  return rows.reduce((sum: number, row) => sum + Number(row.amount), 0);
}

export async function getDashboardSummary() {
  const [deposits, topups, expenses] = await Promise.all([
    listDeposits(),
    listTopups(),
    listExpenses(),
  ]);

  const totalCollected = sumAmounts(deposits) + sumAmounts(topups);
  const totalSpent = sumAmounts(expenses);

  return {
    totalCollected,
    totalSpent,
    balance: totalCollected - totalSpent,
  };
}

// A member's contribution as a percentage of the group total, rounded to one
// decimal place. There's no stored land-purchase target yet (see
// UI-IMPROVEMENTS.md "Deferred"), so this approximates "your share of the
// pool" rather than "your share of the parcel" — the closest motivating
// figure buildable from data that already exists.
export function getContributionSharePercent(personalPaid: number, groupTotal: number): number {
  if (groupTotal <= 0) return 0;
  const percent = (personalPaid / groupTotal) * 100;
  return Math.round(Math.min(percent, 100) * 10) / 10;
}
