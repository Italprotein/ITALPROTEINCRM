import type { DefaultSession } from "next-auth";

import type { Role } from "@/lib/types";

type UserKindValue = "internal" | "external";

// Augment the Auth.js session/user/JWT with our CRM identity fields, so server
// code can read session.user.role / .kind / .companyId with full type safety.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      kind: UserKindValue;
      companyId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    kind: UserKindValue;
    companyId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Role;
    kind: UserKindValue;
    companyId: string | null;
  }
}
