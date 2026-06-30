import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/backend/prisma";

// Full Auth.js config (Node runtime). Email + password via the Credentials
// provider, verified against User.passwordHash with bcrypt. Sessions are JWT
// (required for Credentials). The Prisma adapter + Google OAuth are added in a
// later phase; for now users are looked up directly.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { role: true },
        });
        if (!user || !user.passwordHash || user.status !== "active") return null;

        // Only admins may sign in.
        const ADMIN_ROLES = ["super_admin", "crm_admin"];
        if (!ADMIN_ROLES.includes(user.role.key)) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Best-effort last-login stamp; never block sign-in on this.
        await prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => undefined);

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          role: user.role.key,
          kind: user.kind,
          companyId: user.companyId ?? null,
        };
      },
    }),
  ],
});
