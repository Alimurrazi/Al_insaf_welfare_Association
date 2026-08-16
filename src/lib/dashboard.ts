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
