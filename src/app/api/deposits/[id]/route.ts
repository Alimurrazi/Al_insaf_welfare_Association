import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { DepositNotFoundError, updateDeposit, validateDepositInput } from "@/lib/deposits";
import { MemberNotFoundError } from "@/lib/members";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  const body = await request.json();
  const validationError = validateDepositInput(body, { partial: true });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const deposit = await updateDeposit(gate.session.user.id, id, body);
    return NextResponse.json(deposit);
  } catch (error) {
    if (error instanceof DepositNotFoundError || error instanceof MemberNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
