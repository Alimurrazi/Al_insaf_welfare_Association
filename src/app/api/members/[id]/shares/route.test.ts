import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// See `../../route.test.ts` (and `../route.test.ts`) for the rationale on
// mocking `@/auth`'s `auth` export directly (rather than faking Next's
// request-context) and on using `vi.hoisted` to sidestep `auth`'s overloaded
// call-signature typing.
const { mockedAuth } = vi.hoisted(() => ({ mockedAuth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mockedAuth }));

import type { Session } from "next-auth";
import { GET, POST } from "./route";

const PREFIX = "member-shares-route-test-";

function sessionFor(role: "ADMIN" | "MEMBER", id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${PREFIX}session-user@example.com` },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/members/whatever/shares", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Next.js App Router route handlers receive dynamic segment params as an
// async second argument: `{ params: Promise<{ id: string }> }`.
function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/members/[id]/shares route handlers", () => {
  let adminId: string;
  let memberId: string;
  let targetId: string;

  beforeAll(async () => {
    const admin = await prisma.member.create({
      data: { name: `${PREFIX}Admin`, email: `${PREFIX}admin@example.com`, role: "ADMIN" },
    });
    const member = await prisma.member.create({
      data: { name: `${PREFIX}Member`, email: `${PREFIX}member@example.com`, role: "MEMBER" },
    });
    const target = await prisma.member.create({
      data: { name: `${PREFIX}Target`, email: `${PREFIX}target@example.com`, role: "MEMBER" },
    });
    adminId = admin.id;
    memberId = member.id;
    targetId = target.id;

    await prisma.memberShare.create({
      data: { memberId: targetId, shareCount: 4, effectiveFrom: new Date("2025-01-01") },
    });
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
    await prisma.memberShare.deleteMany({ where: { member: { email: { startsWith: PREFIX } } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockedAuth.mockReset();
  });

  describe("GET", () => {
    it("returns 401 when there is no session", async () => {
      mockedAuth.mockResolvedValue(null);

      const res = await GET(
        new Request("http://localhost/api/members/whatever/shares"),
        paramsFor(targetId),
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    });

    it("returns 403 for a MEMBER-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("MEMBER", memberId));

      const res = await GET(
        new Request("http://localhost/api/members/whatever/shares"),
        paramsFor(targetId),
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    });

    it("returns 404 for an unknown member id", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await GET(
        new Request("http://localhost/api/members/whatever/shares"),
        paramsFor("does-not-exist-id"),
      );

      expect(res.status).toBe(404);
    });

    it("returns 200 with the member's share history for an ADMIN-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await GET(
        new Request("http://localhost/api/members/whatever/shares"),
        paramsFor(targetId),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((s: { shareCount: number }) => s.shareCount === 4)).toBe(true);
      expect(body.every((s: { memberId: string }) => s.memberId === targetId)).toBe(true);
    });
  });

  describe("POST", () => {
    it("returns 401 when there is no session", async () => {
      mockedAuth.mockResolvedValue(null);

      const res = await POST(
        jsonRequest({ shareCount: 2, effectiveFrom: "2026-01-01" }),
        paramsFor(targetId),
      );

      expect(res.status).toBe(401);
    });

    it("returns 403 for a MEMBER-role session", async () => {
      mockedAuth.mockResolvedValue(sessionFor("MEMBER", memberId));

      const res = await POST(
        jsonRequest({ shareCount: 2, effectiveFrom: "2026-01-01" }),
        paramsFor(targetId),
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid input (zero shareCount)", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(
        jsonRequest({ shareCount: 0, effectiveFrom: "2026-01-01" }),
        paramsFor(targetId),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid input (bad effectiveFrom)", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(
        jsonRequest({ shareCount: 2, effectiveFrom: "not-a-date" }),
        paramsFor(targetId),
      );

      expect(res.status).toBe(400);
    });

    it("returns 404 for an unknown member id", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(
        jsonRequest({ shareCount: 2, effectiveFrom: "2026-01-01" }),
        paramsFor("does-not-exist-id"),
      );

      expect(res.status).toBe(404);
    });

    it("returns 201, creates the row, and writes an ActivityLog row for a valid ADMIN request", async () => {
      mockedAuth.mockResolvedValue(sessionFor("ADMIN", adminId));

      const res = await POST(
        jsonRequest({ shareCount: 7, effectiveFrom: "2026-03-01" }),
        paramsFor(targetId),
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.memberId).toBe(targetId);
      expect(body.shareCount).toBe(7);

      const log = await prisma.activityLog.findFirst({
        where: { entityType: "MemberShare", entityId: body.id, action: "CREATE" },
      });
      expect(log).not.toBeNull();
      expect(log?.actorId).toBe(adminId);
      expect(log?.oldValue).toBeNull();
      expect(log?.newValue).toMatchObject({ shareCount: 7 });
    });
  });
});
