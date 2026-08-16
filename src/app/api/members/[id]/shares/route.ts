import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import {
  addMemberShare,
  listMemberShares,
  validateMemberShareInput,
} from "@/lib/member-shares";
import { MemberNotFoundError } from "@/lib/members";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const shares = await listMemberShares(id);
  return NextResponse.json(shares);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  const body = await request.json();
  const validationError = validateMemberShareInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const share = await addMemberShare(gate.session.user.id, id, {
      shareCount: body.shareCount,
      effectiveFrom: body.effectiveFrom,
    });
    return NextResponse.json(share, { status: 201 });
  } catch (error) {
    if (error instanceof MemberNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
