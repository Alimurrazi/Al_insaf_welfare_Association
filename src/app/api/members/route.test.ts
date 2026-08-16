import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// `auth()` (from src/auth.ts) resolves the session by reading cookies through
// Next's `next/headers` async-request-context, which only exists inside a
// real Next.js server request lifecycle. Calling an exported route handler
// directly from Vitest bypasses that lifecycle entirely, so there is no
// ambient request to read cookies from. Rather than fabricate a fake
// Next.js request context, we mock the single seam that can't exist outside
// a real server (`@/auth`'s `auth` export) and control its resolved session
// per test, while everything else (the route handler logic, Prisma, the
// real test Postgres database) stays real and unmocked.
//
// `vi.hoisted` is used (rather than typing the mock off `typeof auth`)
// because NextAuth's `auth` export is overloaded (bare call vs. wrapping a
// middleware handler) and `ReturnType<typeof auth>` resolves to the wrong
// overload; a plain `vi.fn()` sidesteps that entirely.
const { mockedAuth } = vi.hoisted(() => ({ mockedAuth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mockedAuth }));

import type { Session } from "next-auth";
import { GET, POST } from "./route";

const PREFIX = "members-route-test-";

function sessionFor(role: "ADMIN" | "MEMBER", id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${PREFIX}session-user@example.com` },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/members", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/members route handlers", () => {
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
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockedAuth.mockReset();
  });

  describe("GET", () => {
    it("returns 401 when there is no session", async () => {
      mockedAuth.mockResolvedValue(null);

      const res = await GET(new Request("http://localhost/api/members"));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    });

    it("returns 403 for a MEMBER-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("MEMBER", memberId));

      const res = await GET(new Request("http://localhost/api/members"));

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    });

    it("returns 200 with the member list for an ADMIN-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await GET(new Request("http://localhost/api/members"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((m: { email: string }) => m.email === `${PREFIX}admin@example.com`)).toBe(true);
    });
  });

  describe("POST", () => {
    it("returns 401 when there is no session", async () => {
      mockedAuth.mockResolvedValue(null);

      const res = await POST(
        jsonRequest({ name: "Nobody", email: `${PREFIX}unauth@example.com`, role: "MEMBER" }),
      );

      expect(res.status).toBe(401);
    });

    it("returns 403 for a MEMBER-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("MEMBER", memberId));

      const res = await POST(
        jsonRequest({ name: "Nobody", email: `${PREFIX}forbidden@example.com`, role: "MEMBER" }),
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid input (empty name, bad email, bad role)", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(jsonRequest({ name: "", email: "not-an-email", role: "SUPERADMIN" }));

      expect(res.status).toBe(400);
    });

    it("returns 201, creates the member, and writes an ActivityLog row for a valid ADMIN request", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(
        jsonRequest({ name: `${PREFIX}Created`, email: `${PREFIX}created@example.com`, role: "MEMBER" }),
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.email).toBe(`${PREFIX}created@example.com`);
      expect(body.name).toBe(`${PREFIX}Created`);

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "Member", entityId: body.id, action: "CREATE" },
      });
      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(adminId);
      expect(log?.oldValue).toBeNull();
    });

    it("returns 409 for a duplicate email", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(
        jsonRequest({ name: `${PREFIX}Dup`, email: `${PREFIX}admin@example.com`, role: "MEMBER" }),
      );

      expect(res.status).toBe(409);
    });
  });
});
