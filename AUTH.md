# Auth handling

Google sign-in, gated by an admin-maintained allow-list. There's no separate signup flow and no passwords — an admin adds a member's name + email to the `members` table first, and only then can that email sign in with Google.

## Files

| File | Purpose |
|---|---|
| `src/auth.config.ts` | Edge-safe config: providers + the `authorized` callback used by middleware. No Prisma import. |
| `src/auth.ts` | Full config: everything in `auth.config.ts` plus the Prisma-backed `signIn`/`jwt`/`session` callbacks. Used everywhere except middleware. |
| `src/middleware.ts` | Builds its own lightweight `NextAuth(authConfig)` instance and runs it on every request except `/api/auth`, `/sign-in`, and static assets, redirecting unauthenticated requests to `/sign-in`. |
| `src/app/api/auth/[...nextauth]/route.ts` | Exposes NextAuth's `GET`/`POST` handlers (OAuth callback, session endpoint, etc). |
| `src/app/sign-in/page.tsx` | The only public page. Shows a "Sign in with Google" button and an access-denied message when the allow-list check rejects a login. |
| `src/types/next-auth.d.ts` | Adds `id`/`role` to `Session.user` and `memberId`/`role` to `JWT`, sourced from the Prisma `Role` enum. |
| `src/lib/prisma.ts` | The Prisma Client singleton, imported by `auth.ts` (not by `auth.config.ts` or middleware). |

## Why the config is split in two

Middleware runs on the Edge Runtime, which can't load Node-only APIs. Prisma's Postgres adapter needs Node, so anything that imports `@/lib/prisma` can't be part of the module graph middleware loads. `auth.config.ts` exists purely so middleware has a Prisma-free config to build its own `NextAuth()` instance from — it only needs to know *whether* a session exists (via the `authorized` callback), not look anything up in the database.

`auth.ts` re-declares the full config (providers, session strategy, pages) rather than spreading `...authConfig` into it — see the next section for why.

## The allow-list gate

`auth.ts`'s `signIn` callback is where access control actually happens:

```ts
async signIn({ user }) {
  if (!user.email) return false;
  const member = await prisma.member.findUnique({ where: { email: user.email } });
  return member !== null;
}
```

A valid Google login with an email not in `members` is rejected here — NextAuth redirects to `/sign-in?error=AccessDenied`, which the sign-in page checks for and shows a message for.

Once signed in, the `jwt` callback looks the member up again and stamps `memberId`/`role` onto the token; the `session` callback copies those onto `session.user` so `role` is available anywhere a page/route reads the session (`const session = await auth()`). Because the `jwt` callback re-queries on every token refresh, a role change by an admin takes effect on the member's next session refresh without them needing to fully sign out.

## A TypeScript gotcha worth knowing before touching this code

If you ever see `token.memberId`/`token.role` mysteriously typed as `{}` instead of the real type inside a callback, it's almost certainly one of these two issues re-appearing — both were hit and fixed while building this:

1. **Don't spread `...authConfig` fields that carry a literal type into a merged callbacks object, and don't spread `...authConfig.callbacks`.** `auth.config.ts` uses `satisfies NextAuthConfig` (not `: NextAuthConfig`) specifically to avoid widening `session.strategy` from the literal `"jwt"` to the general `SessionStrategy` union. `auth.ts` defines its own `callbacks` object from scratch rather than spreading `authConfig.callbacks` into it. Merging/widening here breaks NextAuth's overload resolution for the `jwt`/`session` callback signatures and collapses `token`'s properties to `{}`.
2. **The `JWT` type augmentation must target `@auth/core/jwt`, not `next-auth/jwt`.** `next-auth/jwt` only does `export * from "@auth/core/jwt"` (a wildcard re-export), which does not participate in TypeScript declaration merging. `next-auth`'s own callback types import `JWT` from `@auth/core/jwt` directly, so that's the module `src/types/next-auth.d.ts` augments. (The `Session` augmentation correctly targets plain `"next-auth"`, because that package re-exports `Session` with a *named* re-export, which does merge — the inconsistency between the two is what made this bug confusing to track down.)

## Environment variables

```
AUTH_SECRET=          # random string, e.g. node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
AUTH_GOOGLE_ID=       # Google Cloud Console > APIs & Services > Credentials > OAuth client ID (Web application)
AUTH_GOOGLE_SECRET=
```

Authorized redirect URI to register in Google Cloud Console: `http://localhost:3000/api/auth/callback/google` (swap the host for the Vercel URL in production).

## Adding a member

There's no UI for this yet (that's the "Manage members" admin screen, still to be built). Until then, insert directly:

```ts
await prisma.member.create({
  data: { name: "...", email: "...", role: "ADMIN" }, // or "MEMBER"
});
```

## Testing this locally

1. Fill in `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` in `.env`.
2. Add your own email as a member (see above) so the allow-list doesn't reject you.
3. `npm run dev`, visit `/`, confirm it redirects to `/sign-in`, sign in with Google.
4. Try an email that isn't in `members` — confirm you land back on `/sign-in` with the access-denied message.
