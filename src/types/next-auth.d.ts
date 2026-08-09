import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

// Augmenting "next-auth/jwt" doesn't work here: that module re-exports JWT
// via `export *`, which doesn't merge declarations. `@auth/core/jwt` is
// where JWT is actually declared, and what next-auth's own callback types
// import from — augment that instead.
declare module "@auth/core/jwt" {
  interface JWT {
    memberId?: string;
    role?: Role;
  }
}
