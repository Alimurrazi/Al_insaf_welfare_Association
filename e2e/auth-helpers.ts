import { encode } from "next-auth/jwt";

// Confirmed via node_modules/@auth/core/src/lib/utils/cookie.ts's `defaultCookies`:
// the session cookie is named `authjs.session-token` when `useSecureCookies` is
// false, with a `__Secure-` prefix added only when true. The dev server this
// e2e suite targets runs on http://localhost:3000 (non-HTTPS), so the
// unprefixed name applies.
export const SESSION_COOKIE_NAME = "authjs.session-token";

export interface MintedSessionCookie {
  name: string;
  value: string;
}

/**
 * Mints a valid Auth.js JWT session cookie for the given member email,
 * without going through the real Google OAuth flow.
 *
 * This app's own `jwt` callback (src/auth.ts) re-derives `memberId`/`role`
 * from `token.email` via a fresh DB lookup on every request:
 *
 *   async jwt({ token, user }) {
 *     const email = user?.email ?? token.email;
 *     if (email) {
 *       const member = await prisma.member.findUnique({ where: { email } });
 *       if (member) { token.memberId = member.id; token.role = member.role; }
 *     }
 *     return token;
 *   }
 *
 * So the minted payload only strictly needs a valid `email` (plus `sub`) —
 * the role/id used by the app are looked up fresh from the seeded Member
 * row, not trusted from this cookie.
 */
export async function createSessionCookie(email: string): Promise<MintedSessionCookie> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET must be set (load it from .env) before minting a test session cookie",
    );
  }

  const value = await encode({
    token: { email, sub: email },
    secret,
    // `getToken`'s default `salt` is the cookie name itself — see
    // node_modules/@auth/core/src/jwt.ts's `getToken`, which the app's own
    // `auth()`/middleware rely on to decode the cookie.
    salt: SESSION_COOKIE_NAME,
  });

  return { name: SESSION_COOKIE_NAME, value };
}
