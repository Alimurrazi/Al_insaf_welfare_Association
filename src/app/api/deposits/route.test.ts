import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// See `src/app/api/members/route.test.ts` for the rationale on mocking
// `@/auth`'s `auth` export directly (rather than faking Next's request
// context) and on using `vi.hoisted` to sidestep `auth`'s overloaded
// call-signature typing.
const { mockedAuth } = vi.hoisted(() => ({ mockedAuth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mockedAuth }));

import type { Session } from "next-auth";
import { GET, POST } from "./route";

const PREFIX = "deposits-route-test-";

function sessionFor(role: "ADMIN" | "MEMBER", id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${PREFIX}session-user@example.com` },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/deposits", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/deposits route handlers", () => {
  let adminId: string;
  let memberId: string;
  let targetMemberId: string;

  beforeAll(async () => {
    const admin = await prisma.member.create({
      data: { name: `${PREFIX}Admin`, email: `${PREFIX}admin@example.com`, role: "ADMIN" },
    });
    const member = await prisma.member.create({
      data: { name: `${PREFIX}Member`, email: `${PREFIX}member@example.com`, role: "MEMBER" },
    });
    const targetMember = await prisma.member.create({
      data: { name: `${PREFIX}Target`, email: `${PREFIX}target@example.com`, role: "MEMBER" },
    });
    adminId = admin.id;
    memberId = member.id;
    targetMemberId = targetMember.id;

    await prisma.monthlyDeposit.create({
      data: {
        memberId: targetMemberId,
        month: 1,
        year: 2026,
        amount: 100,
        paidDate: new Date("2026-01-01"),
        createdById: adminId,
      },
    });
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
    await prisma.monthlyDeposit.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockedAuth.mockReset();
  });

  describe("GET", () => {
    it("returns 401 when there is no session", async () => {
      mockedAuth.mockResolvedValue(null);

      const res = await GET(new Request("http://localhost/api/deposits"));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    });

    it("returns 403 for a MEMBER-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("MEMBER", memberId));

      const res = await GET(new Request("http://localhost/api/deposits"));

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    });

    it("returns 200 with the full deposit list for an ADMIN-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await GET(new Request("http://localhost/api/deposits"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((d: { memberId: string }) => d.memberId === targetMemberId)).toBe(true);
    });
  });

  describe("POST", () => {
    it("returns 401 when there is no session", async () => {
      mockedAuth.mockResolvedValue(null);

      const res = await POST(
        jsonRequest({ memberId: targetMemberId, month: 2, year: 2026, amount: 100, paidDate: "2026-02-01" }),
      );

      expect(res.status).toBe(401);
    });

    it("returns 403 for a MEMBER-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("MEMBER", memberId));

      const res = await POST(
        jsonRequest({ memberId: targetMemberId, month: 2, year: 2026, amount: 100, paidDate: "2026-02-01" }),
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid input (bad month)", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(
        jsonRequest({ memberId: targetMemberId, month: 13, year: 2026, amount: 100, paidDate: "2026-02-01" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 404 for an unknown memberId", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(
        jsonRequest({
          memberId: "does-not-exist-id",
          month: 2,
          year: 2026,
          amount: 100,
          paidDate: "2026-02-01",
        }),
      );

      expect(res.status).toBe(404);
    });

    it("returns 201, creates the deposit, and writes an ActivityLog row for a valid ADMIN request", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(
        jsonRequest({
          memberId: targetMemberId,
          month: 5,
          year: 2026,
          amount: 250,
          paidDate: "2026-05-01",
          note: "May deposit",
        }),
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.memberId).toBe(targetMemberId);
      expect(body.month).toBe(5);
      expect(body.year).toBe(2026);
      expect(Number(body.amount)).toBe(250);

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "MonthlyDeposit", entityId: body.id, action: "CREATE" },
      });
      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(adminId);
      expect(log?.oldValue).toBeNull();
    });
  });
});
