import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/require-admin";
import { createMember, listMembers, validateMemberInput } from "@/lib/members";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- App Router route handlers always receive the request
export async function GET(_request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const members = await listMembers();
  return NextResponse.json(members);
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const body = await request.json();
  const validationError = validateMemberInput(body, { partial: false });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const member = await createMember(gate.session.user.id, {
      name: body.name,
      email: body.email,
      role: body.role,
    });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A member with that email already exists" }, { status: 409 });
    }
    throw error;
  }
}
