/* Backend verification harness — run with: npm run verify (tsx scripts/verify-backend.ts) */
import { config } from "dotenv";
import bcrypt from "bcryptjs";
config();
config({ path: ".env.local" });

async function main() {
  const results: [string, boolean, string?][] = [];
  const check = (name: string, ok: boolean, detail?: string) => results.push([name, ok, detail]);

  // ── crypto ──
  const crypto = await import("../lib/backend/crypto");
  const secret = "refresh-token-1234-üñïçødé";
  const enc = crypto.encryptSecret(secret);
  check("crypto: encrypt/decrypt round-trip", crypto.decryptSecret(enc) === secret, enc.slice(0, 24));
  check("crypto: ciphertext differs from plaintext", !enc.includes(secret));
  let tamperFailed = false;
  try {
    crypto.decryptSecret(enc.slice(0, -4) + "AAAA");
  } catch {
    tamperFailed = true;
  }
  check("crypto: tampered ciphertext rejected", tamperFailed);
  const code = crypto.generateResetCode();
  check("crypto: reset code is 6 digits", /^\d{6}$/.test(code), code);
  check("crypto: code hash verifies", crypto.verifyOneTimeCode(code, crypto.hashOneTimeCode(code)));
  check("crypto: wrong code rejected", !crypto.verifyOneTimeCode("000001", crypto.hashOneTimeCode("999999")));
  const state = crypto.signState({ uid: "user_1" });
  const verified = crypto.verifyState<{ uid: string }>(state);
  check("crypto: oauth state round-trip", verified?.uid === "user_1");
  check("crypto: forged state rejected", crypto.verifyState(state.replace(/.$/, "x")) === null);
  const activationToken = crypto.generateActivationToken();
  check("crypto: activation token has 256-bit base64url shape", /^[A-Za-z0-9_-]{43}$/.test(activationToken));
  check(
    "crypto: activation token hash is deterministic and hides plaintext",
    crypto.hashActivationToken(activationToken) === crypto.hashActivationToken(activationToken) &&
      !crypto.hashActivationToken(activationToken).includes(activationToken),
  );

  // ── rate limit ──
  const { checkRateLimit } = await import("../lib/backend/rate-limit");
  const key = `test:${Date.now()}`;
  const r1 = await checkRateLimit(key, 3, 60);
  const r2 = await checkRateLimit(key, 3, 60);
  const r3 = await checkRateLimit(key, 3, 60);
  const r4 = await checkRateLimit(key, 3, 60);
  check(
    "rate-limit: 3 allowed then blocked",
    r1.ok && r2.ok && r3.ok && !r4.ok,
    JSON.stringify({ r4remaining: r4.remaining, retry: r4.retryAfterSeconds }),
  );

  // ── gmail pure helpers ──
  const gmail = await import("../lib/backend/gmail");
  const addrs = gmail.parseAddressList('"Doe, John" <John.Doe@Acme-Foods.com>, plain@x.io');
  check(
    "gmail: address list parsing",
    addrs.length === 2 && addrs[0].email === "john.doe@acme-foods.com" && addrs[1].email === "plain@x.io",
    JSON.stringify(addrs),
  );
  check(
    "gmail: recipient header injection rejected",
    gmail.normalizeEmailAddress("client@example.com\r\nBcc: attacker@example.com") === null,
  );
  const raw = gmail.buildRawEmail({
    from: "ad@italprotein.com",
    fromName: "Giuseppe Minelli — Italprotein",
    to: ["client@acme.com"],
    subject: "Prova è ünïcode",
    text: "Hello\nWorld ünïcode ✓",
  });
  const decodedRaw = Buffer.from(raw, "base64url").toString("utf8");
  check(
    "gmail: MIME build (headers + b64 body)",
    decodedRaw.includes("To: client@acme.com") &&
      decodedRaw.includes("Subject: =?UTF-8?B?") &&
      decodedRaw.includes("Content-Transfer-Encoding: base64"),
  );
  const bodyPart = decodedRaw.split("\r\n\r\n")[1] ?? "";
  check(
    "gmail: MIME body decodes back",
    Buffer.from(bodyPart.replace(/\r\n/g, ""), "base64").toString("utf8") === "Hello\nWorld ünïcode ✓",
  );
  const payload = {
    mimeType: "multipart/mixed",
    parts: [
      { mimeType: "text/plain", body: { data: Buffer.from("Dear Giuseppe,\nplease find our NDA attached.\nBest,\nJohn Doe\nAcme Foods").toString("base64url") } },
      { mimeType: "application/pdf", filename: "Acme_NDA_signed.pdf", body: { attachmentId: "att1", size: 1234 } },
    ],
  };
  const body = gmail.extractBodyText(payload as never);
  check("gmail: body extraction", body.startsWith("Dear Giuseppe,"), body.slice(0, 30));
  const atts = gmail.listAttachmentMeta(payload as never);
  check("gmail: attachment meta", atts.length === 1 && atts[0].filename === "Acme_NDA_signed.pdf");

  // ── sync guard (no mailbox connected) ──
  const { runGmailSync } = await import("../lib/backend/gmail-sync");
  const sync = await runGmailSync();
  check("sync: reports gmail_not_connected", !sync.ok && sync.error === "gmail_not_connected", JSON.stringify(sync));

  // ── reset-code DB flow (direct, mirrors auth.actions logic) ──
  const { prisma } = await import("../lib/backend/prisma");
  const user = await prisma.user.findFirst({ where: { email: "giuseppeminelli@wefin.it" } });
  if (user) {
    const testCode = crypto.generateResetCode();
    const row = await prisma.passwordResetCode.create({
      data: {
        userId: user.id,
        email: user.email!,
        codeHash: crypto.hashOneTimeCode(testCode),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const found = await prisma.passwordResetCode.findFirst({
      where: { email: user.email!, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    check(
      "reset: stored code verifies from DB",
      !!found && crypto.verifyOneTimeCode(testCode, found.codeHash),
    );
    await prisma.passwordResetCode.delete({ where: { id: row.id } });
  } else {
    check("reset: admin user found", false);
  }

  // ── account activation DB flow ──
  const companyOwnerRole = await prisma.role.findUnique({ where: { key: "company_owner" } });
  const internalOwner = await prisma.user.findFirst({ where: { kind: "internal", status: "active" } });
  if (companyOwnerRole && internalOwner) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let testCompanyId: string | null = null;
    let testContactId: string | null = null;
    let testUserId: string | null = null;
    try {
      const company = await prisma.company.create({
        data: {
          legalName: `Activation Test ${suffix}`,
          aliases: [],
          type: "other",
          initials: "AT",
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
          ownerUserId: internalOwner.id,
          supportingTeamUserIds: [],
          tags: [],
        },
      });
      testCompanyId = company.id;
      const contact = await prisma.contact.create({
        data: {
          companyId: company.id,
          firstName: "Activation",
          lastName: "Test",
          email: `activation-${suffix}@example.invalid`,
          isPrimary: true,
          communicationPreferences: ["email"],
        },
      });
      testContactId = contact.id;
      const invited = await prisma.user.create({
        data: {
          name: "Activation Test",
          email: contact.email,
          roleId: companyOwnerRole.id,
          kind: "external",
          companyId: company.id,
          contactId: contact.id,
          status: "invited",
        },
      });
      testUserId = invited.id;
      const invitations = await import("../lib/backend/account-invitations");
      const material = invitations.createActivationTokenMaterial();
      let activationMaterial = material;
      await prisma.accountActivationToken.create({
        data: {
          userId: invited.id,
          tokenHash: material.tokenHash,
          expiresAt: material.expiresAt,
          createdByUserId: internalOwner.id,
        },
      });
      const stored = await prisma.accountActivationToken.findUnique({ where: { tokenHash: material.tokenHash } });
      check(
        "activation: token stored hashed",
        !!stored && stored.tokenHash !== material.token && !stored.tokenHash.includes(material.token),
      );
      const replacement = invitations.createActivationTokenMaterial();
      const stagedReplacement = await prisma.$transaction((tx) =>
        invitations.stageActivationToken(tx, invited.id, internalOwner.id, replacement),
      );
      await invitations.settleStagedActivationToken(invited.id, stagedReplacement, true);
      const [retiredOriginal, liveReplacement] = await Promise.all([
        prisma.accountActivationToken.findUnique({ where: { tokenHash: material.tokenHash } }),
        prisma.accountActivationToken.findUnique({ where: { tokenHash: replacement.tokenHash } }),
      ]);
      check(
        "activation: delivered resend retires the older link",
        !!retiredOriginal?.usedAt && !!liveReplacement && !liveReplacement.usedAt,
      );
      activationMaterial = replacement;

      const failedReplacement = invitations.createActivationTokenMaterial();
      const failedStage = await prisma.$transaction((tx) =>
        invitations.stageActivationToken(tx, invited.id, internalOwner.id, failedReplacement),
      );
      await invitations.settleStagedActivationToken(invited.id, failedStage, false);
      const [preservedWorking, retiredFailed] = await Promise.all([
        prisma.accountActivationToken.findUnique({ where: { tokenHash: activationMaterial.tokenHash } }),
        prisma.accountActivationToken.findUnique({ where: { tokenHash: failedReplacement.tokenHash } }),
      ]);
      check(
        "activation: failed resend preserves the working link",
        !!preservedWorking && !preservedWorking.usedAt && !!retiredFailed?.usedAt,
      );
      await prisma.accountActivationToken.update({
        where: { tokenHash: activationMaterial.tokenHash },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });
      const expired = await invitations.activateInvitedAccount(activationMaterial.token, "StrongPass123!", "verify");
      check("activation: expired token rejected", !expired.ok && expired.error === "expired_token");
      await prisma.accountActivationToken.update({
        where: { tokenHash: activationMaterial.tokenHash },
        data: { expiresAt: activationMaterial.expiresAt },
      });
      const weak = await invitations.activateInvitedAccount(activationMaterial.token, "short1", "verify");
      check("activation: weak password rejected", !weak.ok && weak.error === "weak_password");
      const activated = await invitations.activateInvitedAccount(activationMaterial.token, "StrongPass123!", "verify");
      check("activation: invited external account activates", activated.ok && activated.workspace === "external");
      const replay = await invitations.activateInvitedAccount(activationMaterial.token, "AnotherPass123!", "verify");
      check("activation: token replay rejected", !replay.ok && replay.error === "invalid_token");
      const activeUser = await prisma.user.findUnique({ where: { id: invited.id } });
      check(
        "activation: user becomes verified and password-backed",
        activeUser?.status === "active" && !!activeUser.emailVerified &&
          !!activeUser.passwordHash && await bcrypt.compare("StrongPass123!", activeUser.passwordHash),
      );
    } finally {
      if (testUserId) {
        await prisma.auditEvent.deleteMany({ where: { entityType: "user", entityId: testUserId } });
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => undefined);
      }
      if (testContactId) await prisma.contact.delete({ where: { id: testContactId } }).catch(() => undefined);
      if (testCompanyId) await prisma.company.delete({ where: { id: testCompanyId } }).catch(() => undefined);
    }
  } else {
    check("activation: required seeded roles/users found", false);
  }

  // cleanup rate-limit test rows
  await prisma.rateLimitEntry.deleteMany({ where: { key: { startsWith: "test:" } } });

  let failures = 0;
  for (const [name, ok, detail] of results) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
    if (!ok) failures += 1;
  }
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
