import "dotenv/config";

import { existsSync, readFileSync } from "node:fs";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

// Run with: npx prisma db seed   (or: npx tsx prisma/seed.ts)
// Seeds the 12 RBAC roles, then upserts the bootstrap admin allowlist from the
// gitignored data/admins.json. Re-running this seed is non-destructive so it
// cannot remove invited staff or provisioned portal users.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ROLES = [
  { key: "super_admin", kind: "internal" },
  { key: "crm_admin", kind: "internal" },
  { key: "business_dev", kind: "internal" },
  { key: "rnd_technical", kind: "internal" },
  { key: "logistics", kind: "internal" },
  { key: "finance", kind: "internal" },
  { key: "management_readonly", kind: "internal" },
  { key: "company_owner", kind: "external" },
  { key: "company_member", kind: "external" },
  { key: "company_technical", kind: "external" },
  { key: "company_logistics", kind: "external" },
  { key: "company_finance", kind: "external" },
] as const;

interface AdminSeed {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

async function main() {
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { key: r.key },
      update: { kind: r.kind },
      create: { key: r.key, kind: r.kind, name: r.key },
    });
  }

  const superRole = await prisma.role.findUniqueOrThrow({ where: { key: "super_admin" } });
  const crmRole = await prisma.role.findUniqueOrThrow({ where: { key: "crm_admin" } });
  const now = new Date();

  // Only this identity is the platform super-admin (adds/removes admins, edits
  // Settings, sees the Audit log). Every other seeded admin is crm_admin: full
  // business CRUD, no admin powers. Change this constant to move super-admin.
  const SUPER_ADMIN_EMAIL = "labidimedamine53@gmail.com";

  const adminsPath = "data/admins.json";
  if (existsSync(adminsPath)) {
    const admins: AdminSeed[] = JSON.parse(readFileSync(adminsPath, "utf8"));
    const emails: string[] = [];
    for (const a of admins) {
      const email = a.email.trim().toLowerCase();
      emails.push(email);
      const name = `${a.firstName} ${a.lastName}`.trim();
      const passwordHash = await bcrypt.hash(a.password, 12);
      const roleId = email === SUPER_ADMIN_EMAIL ? superRole.id : crmRole.id;
      await prisma.user.upsert({
        where: { email },
        update: {
          name,
          roleId,
          kind: "internal",
          status: "active",
          passwordHash,
          emailVerified: now,
          authVersion: { increment: 1 },
        },
        create: { email, name, roleId, kind: "internal", status: "active", passwordHash, emailVerified: now },
      });
    }
    console.log(`✓ Seeded ${ROLES.length} roles.`);
    console.log(`✓ Upserted ${emails.length} bootstrap admins:`);
    for (const e of emails) console.log(`    ${e}`);
    return;
  }

  // Fallback: single env super-admin when no data/admins.json is present.
  const email = (process.env.SEED_SUPERADMIN_EMAIL ?? "ad@italprotein.com").trim().toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD ?? "ChangeMe!2026";
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { roleId: superRole.id, status: "active", passwordHash, authVersion: { increment: 1 } },
    create: { email, name: "Super Admin", roleId: superRole.id, kind: "internal", status: "active", passwordHash, emailVerified: now },
  });
  console.log(`✓ Seeded ${ROLES.length} roles + super admin (${email}).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
