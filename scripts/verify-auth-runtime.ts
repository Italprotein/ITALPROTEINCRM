/* Runtime auth/workspace smoke harness. Start the production server first. */
import { config } from "dotenv";
import bcrypt from "bcryptjs";

config();
config({ path: ".env.local" });

let prisma: typeof import("../lib/backend/prisma").prisma;

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3121";
const testIp = "198.51.100.77";
const results: Array<[string, boolean, string?]> = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push([name, ok, detail]);
}

class CookieJar {
  private readonly values = new Map<string, string>();

  absorb(headers: Headers) {
    const cookies = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const cookie of cookies) {
      const pair = cookie.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator > 0) this.values.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  header(): string {
    return [...this.values.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
  }
}

async function request(path: string, options: RequestInit = {}, jar?: CookieJar) {
  const headers = new Headers(options.headers);
  headers.set("x-forwarded-for", testIp);
  if (jar?.header()) headers.set("cookie", jar.header());
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual" });
  jar?.absorb(response.headers);
  return response;
}

async function login(email: string, password: string, workspace: "internal" | "external") {
  const jar = new CookieJar();
  const csrfResponse = await request("/api/auth/csrf", {}, jar);
  const csrf = await csrfResponse.json() as { csrfToken: string };
  const response = await request(
    "/api/auth/callback/credentials",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: new URLSearchParams({
        csrfToken: csrf.csrfToken,
        callbackUrl: `${baseUrl}/en/${workspace === "internal" ? "admin" : "portal"}`,
        email,
        password,
        workspace,
      }),
    },
    jar,
  );
  const data = await response.json() as { url?: string };
  const error = data.url ? new URL(data.url).searchParams.get("error") : "missing_url";
  return { jar, ok: response.ok && !error, error };
}

async function main() {
  ({ prisma } = await import("../lib/backend/prisma"));
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const internalEmail = `auth-internal-${suffix}@example.invalid`;
  const externalEmail = `auth-external-${suffix}@example.invalid`;
  const password = "RuntimeSmoke123!";
  let internalUserId: string | null = null;
  let externalUserId: string | null = null;
  let companyId: string | null = null;
  let secondCompanyId: string | null = null;
  let contactId: string | null = null;
  let documentId: string | null = null;
  let attachmentId: string | null = null;

  try {
    const [internalRole, externalRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { key: "business_dev" } }),
      prisma.role.findUniqueOrThrow({ where: { key: "company_owner" } }),
    ]);
    const passwordHash = await bcrypt.hash(password, 12);
    const internal = await prisma.user.create({
      data: {
        name: "Runtime Internal",
        email: internalEmail,
        roleId: internalRole.id,
        kind: "internal",
        status: "active",
        emailVerified: new Date(),
        passwordHash,
      },
    });
    internalUserId = internal.id;
    const company = await prisma.company.create({
      data: {
        legalName: `Runtime Auth ${suffix}`,
        aliases: [],
        type: "other",
        initials: "RA",
        headquarters: { line1: "Test", city: "Test", country: "Italy", countryCode: "IT" },
        country: "Italy",
        countryCode: "IT",
        city: "Test",
        preferredLanguage: "en",
        preferredCurrency: "EUR",
        marketsServed: [],
        firstContact: { date: new Date().toISOString(), channel: "other" },
        distributionMarkets: [],
        relationshipStage: "lead",
        priority: "medium",
        productCategories: [],
        applicationInterests: [],
        ownerUserId: internal.id,
        supportingTeamUserIds: [],
        tags: [],
      },
    });
    companyId = company.id;
    const secondCompany = await prisma.company.create({
      data: {
        legalName: `Runtime Auth Reassigned ${suffix}`,
        aliases: [],
        type: "other",
        initials: "RR",
        headquarters: { line1: "Test", city: "Test", country: "Italy", countryCode: "IT" },
        country: "Italy",
        countryCode: "IT",
        city: "Test",
        preferredLanguage: "en",
        preferredCurrency: "EUR",
        marketsServed: [],
        firstContact: { date: new Date().toISOString(), channel: "other" },
        distributionMarkets: [],
        relationshipStage: "lead",
        priority: "medium",
        productCategories: [],
        applicationInterests: [],
        ownerUserId: internal.id,
        supportingTeamUserIds: [],
        tags: [],
      },
    });
    secondCompanyId = secondCompany.id;
    const contact = await prisma.contact.create({
      data: {
        companyId: company.id,
        firstName: "Runtime",
        lastName: "External",
        email: externalEmail,
        isPrimary: true,
        communicationPreferences: ["email"],
      },
    });
    contactId = contact.id;
    const external = await prisma.user.create({
      data: {
        name: "Runtime External",
        email: externalEmail,
        roleId: externalRole.id,
        kind: "external",
        companyId: company.id,
        contactId: contact.id,
        status: "active",
        emailVerified: new Date(),
        passwordHash,
      },
    });
    externalUserId = external.id;
    const document = await prisma.document.create({
      data: {
        title: "Runtime scoped attachment",
        category: "other",
        confidentialityClass: "portal_general",
        companyId: company.id,
      },
    });
    documentId = document.id;
    const attachment = await prisma.attachment.create({
      data: {
        name: "runtime.txt",
        fileType: "txt",
        mimeType: "text/plain",
        bytes: Buffer.from("runtime scoped attachment"),
        sizeBytes: 25,
        documentId: document.id,
      },
    });
    attachmentId = attachment.id;

    const anonymousAdmin = await request("/en/admin");
    check(
      "anonymous: admin redirects to team login",
      anonymousAdmin.status === 302 && anonymousAdmin.headers.get("location")?.includes("/en/team-login") === true,
      `${anonymousAdmin.status} ${anonymousAdmin.headers.get("location")}`,
    );
    const anonymousPortal = await request("/en/portal");
    check(
      "anonymous: portal redirects to company login",
      anonymousPortal.status === 302 && anonymousPortal.headers.get("location")?.includes("/en/login") === true,
      `${anonymousPortal.status} ${anonymousPortal.headers.get("location")}`,
    );

    const internalLogin = await login(internalEmail, password, "internal");
    check("login: non-admin internal role authenticates", internalLogin.ok, internalLogin.error ?? undefined);
    const internalAdmin = await request("/en/admin", {}, internalLogin.jar);
    check("workspace: internal user opens admin", internalAdmin.status === 200, String(internalAdmin.status));
    await prisma.user.update({ where: { id: internal.id }, data: { status: "suspended" } });
    const suspendedSession = await request("/en/admin", {}, internalLogin.jar);
    check(
      "session: suspended user is rejected without waiting for JWT expiry",
      [302, 307].includes(suspendedSession.status) &&
        suspendedSession.headers.get("location")?.includes("/en/team-login") === true,
      `${suspendedSession.status} ${suspendedSession.headers.get("location")}`,
    );
    const suspendedApi = await request("/api/gmail/sync", { method: "POST" }, internalLogin.jar);
    check("api: suspended JWT is rejected", suspendedApi.status === 401, String(suspendedApi.status));
    await prisma.user.update({ where: { id: internal.id }, data: { status: "active" } });
    const internalPortal = await request("/en/portal", {}, internalLogin.jar);
    check(
      "workspace: internal user is redirected out of portal",
      internalPortal.status === 302 && internalPortal.headers.get("location")?.endsWith("/en/admin") === true,
      `${internalPortal.status} ${internalPortal.headers.get("location")}`,
    );
    const forbiddenGoogleConnect = await request("/api/auth/google/start", {}, internalLogin.jar);
    check(
      "oauth: business developer cannot replace the shared Gmail connection",
      [302, 307].includes(forbiddenGoogleConnect.status) &&
        forbiddenGoogleConnect.headers.get("location")?.includes("/en/team-login") === true,
      `${forbiddenGoogleConnect.status} ${forbiddenGoogleConnect.headers.get("location")}`,
    );
    await prisma.user.update({ where: { id: internal.id }, data: { authVersion: { increment: 1 } } });
    const revokedSession = await request("/en/admin", {}, internalLogin.jar);
    check(
      "session: auth-version bump revokes an existing JWT",
      [302, 307].includes(revokedSession.status) &&
        revokedSession.headers.get("location")?.includes("/en/team-login") === true,
      `${revokedSession.status} ${revokedSession.headers.get("location")}`,
    );

    const externalLogin = await login(externalEmail, password, "external");
    check("login: external owner authenticates", externalLogin.ok, externalLogin.error ?? undefined);
    const externalPortal = await request("/en/portal", {}, externalLogin.jar);
    check("workspace: external user opens portal", externalPortal.status === 200, String(externalPortal.status));
    const scopedAttachment = await request(`/api/attachments/${attachment.id}`, {}, externalLogin.jar);
    check("scope: external user downloads its company attachment", scopedAttachment.status === 200, String(scopedAttachment.status));
    await prisma.user.update({ where: { id: external.id }, data: { companyId: secondCompany.id } });
    const formerCompanyAttachment = await request(`/api/attachments/${attachment.id}`, {}, externalLogin.jar);
    check(
      "scope: company reassignment immediately blocks former-company attachment",
      formerCompanyAttachment.status === 403,
      String(formerCompanyAttachment.status),
    );
    await prisma.user.update({ where: { id: external.id }, data: { companyId: company.id } });
    const externalAdmin = await request("/en/admin", {}, externalLogin.jar);
    check(
      "workspace: external user is redirected out of admin",
      externalAdmin.status === 302 && externalAdmin.headers.get("location")?.endsWith("/en/portal") === true,
      `${externalAdmin.status} ${externalAdmin.headers.get("location")}`,
    );

    const wrongDoor = await login(externalEmail, password, "internal");
    check("login: external credentials rejected at team door", !wrongDoor.ok, wrongDoor.error ?? undefined);

    const activationPage = await request("/en/activate?token=invalid");
    const activationHtml = await activationPage.text();
    check(
      "ui: activation page renders without server error",
      activationPage.status === 200 && activationHtml.includes("Create your password"),
      String(activationPage.status),
    );
  } finally {
    const ids = [internalUserId, externalUserId].filter((id): id is string => Boolean(id));
    if (ids.length) {
      await prisma.auditEvent.deleteMany({
        where: { OR: [{ actorUserId: { in: ids } }, { entityType: "user", entityId: { in: ids } }] },
      });
    }
    if (documentId) {
      await prisma.documentAccessEvent.deleteMany({ where: { documentId } });
    }
    if (attachmentId) await prisma.attachment.delete({ where: { id: attachmentId } }).catch(() => undefined);
    if (documentId) await prisma.document.delete({ where: { id: documentId } }).catch(() => undefined);
    if (externalUserId) await prisma.user.delete({ where: { id: externalUserId } }).catch(() => undefined);
    if (contactId) await prisma.contact.delete({ where: { id: contactId } }).catch(() => undefined);
    if (companyId) await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    if (secondCompanyId) await prisma.company.delete({ where: { id: secondCompanyId } }).catch(() => undefined);
    if (internalUserId) await prisma.user.delete({ where: { id: internalUserId } }).catch(() => undefined);
    await prisma.rateLimitEntry.deleteMany({
      where: {
        OR: [
          { key: { contains: testIp } },
          { key: { contains: internalEmail } },
          { key: { contains: externalEmail } },
        ],
      },
    });
  }

  let failures = 0;
  for (const [name, ok, detail] of results) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
    if (!ok) failures += 1;
  }
  console.log(`\n${results.length - failures}/${results.length} runtime auth checks passed`);
  process.exitCode = failures ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma?.$disconnect());
