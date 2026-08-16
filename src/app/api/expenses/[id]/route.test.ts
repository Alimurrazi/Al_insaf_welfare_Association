import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// See `src/app/api/deposits/[id]/route.test.ts` for the rationale on mocking
// `@/auth`'s `auth` export directly (rather than faking Next's request
// context) and on using `vi.hoisted` to sidestep `auth`'s overloaded
// call-signature typing.
const { mockedAuth } = vi.hoisted(() => ({ mockedAuth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mockedAuth }));

import type { Session } from "next-auth";
import { PATCH } from "./route";

const PREFIX = "expenses-id-route-test-";

function sessionFor(role: "ADMIN" | "MEMBER", id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${PREFIX}session-user@example.com` },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/expenses/whatever", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Next.js App Router route handlers receive dynamic segment params as an
// async second argument: `{ params: Promise<{ id: string }> }`.
function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/expenses/[id] route handlers", () => {
  let adminId: string;
  let memberId: string;
  let expenseId: string;

  beforeAll(async () => {
    const admin = await prisma.member.create({
      data: { name: `${PREFIX}Admin`, email: `${PREFIX}admin@example.com`, role: "ADMIN" },
    });
    const member = await prisma.member.create({
      data: { name: `${PREFIX}Member`, email: `${PREFIX}member@example.com`, role: "MEMBER" },
    });
    adminId = admin.id;
    memberId = member.id;

    const expense = await prisma.expense.create({
      data: {
        date: new Date("2026-04-01"),
        category: "Legal fees",
        amount: 400,
        note: "before update",
        createdById: adminId,
      },
    });
    expenseId = expense.id;
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
    await prisma.expense.deleteMany({ where: { createdBy: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockedAuth.mockReset();
  });

  describe("PATCH", () => {
    it("returns 401 when there is no session", async () => {
      mockedAuth.mockResolvedValue(null);

      const res = await PATCH(patchRequest({ amount: 500 }), paramsFor(expenseId));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    });

    it("returns 403 for a MEMBER-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("MEMBER", memberId));

      const res = await PATCH(patchRequest({ amount: 500 }), paramsFor(expenseId));

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    });

    it("returns 404 for an unknown expense id", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await PATCH(patchRequest({ amount: 500 }), paramsFor("does-not-exist-id"));

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid input (negative amount)", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await PATCH(patchRequest({ amount: -50 }), paramsFor(expenseId));

      expect(res.status).toBe(400);
    });

    it("returns 200, updates the expense, and writes an ActivityLog UPDATE row for a valid ADMIN request", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await PATCH(
        patchRequest({ amount: 450, note: "corrected" }),
        paramsFor(expenseId),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Number(body.amount)).toBe(450);
      expect(body.note).toBe("corrected");

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "Expense", entityId: expenseId, action: "UPDATE" },
        orderBy: { createdAt: "desc" },
      });
      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(adminId);
      expect(log?.oldValue).toMatchObject({ note: "before update" });
      expect(log?.newValue).toMatchObject({ note: "corrected" });
    });
  });
});
