import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createExpense, listExpenses, validateExpenseInput } from "@/lib/expenses";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- App Router route handlers always receive the request
export async function GET(_request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const expenses = await listExpenses();
  return NextResponse.json(expenses);
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const body = await request.json();
  const validationError = validateExpenseInput(body, { partial: false });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const expense = await createExpense(gate.session.user.id, {
    date: body.date,
    category: body.category,
    amount: body.amount,
    note: body.note,
  });
  return NextResponse.json(expense, { status: 201 });
}
