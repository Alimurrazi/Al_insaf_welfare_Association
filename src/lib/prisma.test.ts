import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";

describe("prisma smoke test", () => {
  afterAll(async () => {
    await prisma.member.deleteMany({ where: { email: { startsWith: "smoke-test" } } });
    await prisma.$disconnect();
  });

  it("writes to and reads from the real test database", async () => {
    const member = await prisma.member.create({
      data: { name: "Smoke Test", email: "smoke-test@example.com", role: "MEMBER" },
    });

    const found = await prisma.member.findUnique({ where: { id: member.id } });

    expect(found?.email).toBe("smoke-test@example.com");
  });

  it("rejects a second member with a duplicate email", async () => {
    await prisma.member.create({
      data: { name: "Smoke Test Dup 1", email: "smoke-test-dup@example.com", role: "MEMBER" },
    });

    await expect(
      prisma.member.create({
        data: { name: "Smoke Test Dup 2", email: "smoke-test-dup@example.com", role: "MEMBER" },
      }),
    ).rejects.toThrow();
  });
});
