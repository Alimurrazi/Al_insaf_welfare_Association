import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// See `src/app/api/deposits/route.test.ts` for the rationale on mocking
// `@/auth`'s `auth` export directly (rather than faking Next's request
// context) and on using `vi.hoisted` to sidestep `auth`'s overloaded
// call-signature typing.
const { mockedAuth } = vi.hoisted(() => ({ mockedAuth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mockedAuth }));

import type { Session } from "next-auth";
import { GET, POST } from "./route";

const PREFIX = "expenses-route-test-";

function sessionFor(role: "ADMIN" | "MEMBER", id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${PREFIX}session-user@example.com` },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/expenses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/expenses route handlers", () => {
  let adminId: string;
  let memberId: string;

  beforeAll(async () => {
    const admin = await prisma.member.create({
      data: { name: `${PREFIX}Admin`, email: `${PREFIX}admin@example.com`, role: "ADMIN" },
    });
    const member = await prisma.member.create({
      data: { name: `${PREFIX}Member`, email: `${PREFIX}member@example.com`, role: "MEMBER" },
    });
    adminId = admin.id;
    memberId = member.id;

    await prisma.expense.create({
      data: {
        date: new Date("2026-01-01"),
        category: "Land survey",
        amount: 100,
        createdById: adminId,
      },
    });
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

  describe("GET", () => {
    it("returns 401 when there is no session", async () => {
      mockedAuth.mockResolvedValue(null);

      const res = await GET(new Request("http://localhost/api/expenses"));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    });

    it("returns 403 for a MEMBER-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("MEMBER", memberId));

      const res = await GET(new Request("http://localhost/api/expenses"));

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    });

    it("returns 200 with the full expense list for an ADMIN-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await GET(new Request("http://localhost/api/expenses"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((e: { category: string }) => e.category === "Land survey")).toBe(true);
    });
  });

  describe("POST", () => {
    it("returns 401 when there is no session", async () => {
      mockedAuth.mockResolvedValue(null);

      const res = await POST(
        jsonRequest({ date: "2026-02-01", category: "Legal fees", amount: 100 }),
      );

      expect(res.status).toBe(401);
    });

    it("returns 403 for a MEMBER-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("MEMBER", memberId));

      const res = await POST(
        jsonRequest({ date: "2026-02-01", category: "Legal fees", amount: 100 }),
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid input (empty category)", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(
        jsonRequest({ date: "2026-02-01", category: "", amount: 100 }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 201, creates the expense, and writes an ActivityLog row for a valid ADMIN request", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(
        jsonRequest({
          date: "2026-05-01",
          category: "Legal fees",
          amount: 250,
          note: "May legal review",
        }),
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.category).toBe("Legal fees");
      expect(Number(body.amount)).toBe(250);
      expect(body.note).toBe("May legal review");

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "Expense", entityId: body.id, action: "CREATE" },
      });
      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(adminId);
      expect(log?.oldValue).toBeNull();
    });
  });
});
