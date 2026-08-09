import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    // Admin allow-list gate: a Google account can only get a session if an
    // admin has already added its email to the members table.
    async signIn({ user }) {
      if (!user.email) return false;
      const member = await prisma.member.findUnique({
        where: { email: user.email },
      });
      return member !== null;
    },
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      if (email) {
        const member = await prisma.member.findUnique({
          where: { email },
        });
        if (member) {
          token.memberId = member.id;
          token.role = member.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.memberId && token.role) {
        session.user.id = token.memberId;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
