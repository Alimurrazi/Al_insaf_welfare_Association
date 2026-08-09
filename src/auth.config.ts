import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe config: no Prisma import here. Middleware runs on the Edge
// Runtime and can't load Node-only APIs, so it uses this stripped-down
// config instead of the full one in auth.ts.
// `satisfies` (not `: NextAuthConfig`) checks conformance without widening
// literal types like `session.strategy: "jwt"` to the general
// `SessionStrategy` union — that widening breaks callback overload
// resolution (`token` typing) when this is spread into auth.ts.
export const authConfig = {
  providers: [Google],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
