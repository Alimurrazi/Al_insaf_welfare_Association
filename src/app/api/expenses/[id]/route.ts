import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { ExpenseNotFoundError, updateExpense, validateExpenseInput } from "@/lib/expenses";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  const body = await request.json();
  const validationError = validateExpenseInput(body, { partial: true });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const expense = await updateExpense(gate.session.user.id, id, body);
    return NextResponse.json(expense);
  } catch (error) {
    if (error instanceof ExpenseNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
