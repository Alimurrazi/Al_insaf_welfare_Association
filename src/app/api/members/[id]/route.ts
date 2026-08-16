import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/require-admin";
import { MemberNotFoundError, updateMember, validateMemberInput } from "@/lib/members";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  const body = await request.json();
  const validationError = validateMemberInput(body, { partial: true });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const member = await updateMember(gate.session.user.id, id, body);
    return NextResponse.json(member);
  } catch (error) {
    if (error instanceof MemberNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A member with that email already exists" }, { status: 409 });
    }
    throw error;
  }
}
