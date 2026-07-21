/* Backend verification harness — run with: npm run verify (tsx scripts/verify-backend.ts) */
import { config } from "dotenv";
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
