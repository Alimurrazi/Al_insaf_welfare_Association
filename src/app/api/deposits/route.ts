import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createDeposit, listDeposits, validateDepositInput } from "@/lib/deposits";
import { MemberNotFoundError } from "@/lib/members";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- App Router route handlers always receive the request
export async function GET(_request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const deposits = await listDeposits();
  return NextResponse.json(deposits);
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const body = await request.json();
  const validationError = validateDepositInput(body, { partial: false });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const deposit = await createDeposit(gate.session.user.id, {
      memberId: body.memberId,
      month: body.month,
      year: body.year,
      amount: body.amount,
      paidDate: body.paidDate,
      note: body.note,
    });
    return NextResponse.json(deposit, { status: 201 });
  } catch (error) {
    if (error instanceof MemberNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
