import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createTopup, listTopups, validateTopupInput } from "@/lib/topups";
import { MemberNotFoundError } from "@/lib/members";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- App Router route handlers always receive the request
export async function GET(_request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const topups = await listTopups();
  return NextResponse.json(topups);
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const body = await request.json();
  const validationError = validateTopupInput(body, { partial: false });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const topup = await createTopup(gate.session.user.id, {
      memberId: body.memberId,
      year: body.year,
      otpNumber: body.otpNumber,
      amount: body.amount,
      paidDate: body.paidDate,
      note: body.note,
    });
    return NextResponse.json(topup, { status: 201 });
  } catch (error) {
    if (error instanceof MemberNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
