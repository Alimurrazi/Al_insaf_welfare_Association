import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";

export type AdminGate =
  | { session: Session; response?: never }
  | { session?: never; response: NextResponse };

// Shared by every /api/members* route: they're all admin-only, unlike the
// "(shared)" screens elsewhere in the app that Members can read.
export async function requireAdmin(): Promise<AdminGate> {
  const session = await auth();

  if (!session) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session };
}
