import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { TopupNotFoundError, updateTopup, validateTopupInput } from "@/lib/topups";
import { MemberNotFoundError } from "@/lib/members";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  const body = await request.json();
  const validationError = validateTopupInput(body, { partial: true });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const topup = await updateTopup(gate.session.user.id, id, body);
    return NextResponse.json(topup);
  } catch (error) {
    if (error instanceof TopupNotFoundError || error instanceof MemberNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
