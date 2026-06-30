import type { NextAuthConfig } from "next-auth";

import type { Role } from "@/lib/types";

// Edge-safe Auth.js config. This is imported by middleware.ts, which runs on the
// Edge runtime — so it MUST NOT import the database (pg) or bcrypt. The Credentials
// provider (which needs Prisma + bcrypt) is added in auth.ts (Node runtime only).
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/en/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = user.role;
        token.kind = user.kind;
        token.companyId = user.companyId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        // The jwt() callback above guarantees these claims; next-auth types the
        // session callback's `token` loosely, so we cast back to our shapes.
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
        session.user.kind = token.kind as "internal" | "external";
        session.user.companyId = (token.companyId as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
