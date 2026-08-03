import "dotenv/config";

import { prisma } from "@/lib/backend/prisma";

/**
 * Attribute already-stored inbound emails to companies.
 *
 * `runGmailSync` skips messages it has already stored, so fixing the sync only
 * helps mail that arrives from now on. This applies the same resolution rule to
 * the backlog.
 *
 * Purely additive: it only ever fills a NULL `companyId`, never overwrites an
 * existing one, and touches nothing else. Idempotent — safe to re-run.
 *
 *   npx tsx scripts/backfill-email-companies.ts --dry    # report only
 *   npx tsx scripts/backfill-email-companies.ts          # apply
 */

const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.it", "hotmail.com",
  "hotmail.it", "outlook.com", "live.com", "icloud.com", "aol.com",
  "libero.it", "virgilio.it", "tiscali.it", "alice.it", "pec.it",
]);

const dry = process.argv.includes("--dry");

async function main() {
  const rows = await prisma.emailMessage.findMany({
    where: { direction: "inbound", companyId: null },
    select: { id: true, fromAddress: true },
  });
  console.log(`unattributed inbound emails: ${rows.length}`);

  // Resolve per distinct sender, not per message: the same address recurs.
  const senders = new Map<string, string[]>();
  for (const row of rows) {
    const address = row.fromAddress.toLowerCase().trim();
    const list = senders.get(address);
    if (list) list.push(row.id);
    else senders.set(address, [row.id]);
  }
  console.log(`distinct senders: ${senders.size}`);

  let matched = 0;
  let updated = 0;
  const byReason = { contact: 0, website: 0 };
  const unresolved = new Map<string, number>();

  for (const [address, ids] of senders) {
    const domain = address.split("@")[1] ?? "";
    const freemail = !domain || FREEMAIL.has(domain);

    // Same precedence the sync uses: exact contact, then contact domain, then
    // the company's own website. Freemail addresses only ever match exactly —
    // one person's gmail must never attribute mail to a whole company.
    const orConditions: object[] = [{ email: { equals: address, mode: "insensitive" as const } }];
    if (!freemail) {
      orConditions.push(
        { email: { endsWith: `@${domain}`, mode: "insensitive" as const } },
        { secondaryEmail: { endsWith: `@${domain}`, mode: "insensitive" as const } },
      );
    }

    let companyId: string | null = null;
    let reason: "contact" | "website" | null = null;

    const contact = await prisma.contact.findFirst({
      where: { OR: orConditions },
      select: { companyId: true },
    });
    if (contact) {
      companyId = contact.companyId;
      reason = "contact";
    } else if (!freemail) {
      const company = await prisma.company.findFirst({
        where: { website: { contains: domain, mode: "insensitive" } },
        select: { id: true },
      });
      if (company) {
        companyId = company.id;
        reason = "website";
      }
    }

    if (!companyId) {
      unresolved.set(domain || "(no domain)", (unresolved.get(domain || "(no domain)") ?? 0) + ids.length);
      continue;
    }

    matched += ids.length;
    byReason[reason!] += ids.length;
    if (!dry) {
      const result = await prisma.emailMessage.updateMany({
        // Re-assert companyId: null so a concurrent sync cannot be overwritten.
        where: { id: { in: ids }, companyId: null },
        data: { companyId },
      });
      updated += result.count;
    }
  }

  console.log(`\nresolvable: ${matched} messages (contact: ${byReason.contact}, website: ${byReason.website})`);
  console.log(dry ? "DRY RUN — nothing written" : `updated: ${updated} messages`);

  const top = [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`\nstill unresolved, by domain (${[...unresolved.values()].reduce((a, b) => a + b, 0)} messages):`);
  for (const [domain, count] of top) console.log(`  ${String(count).padStart(4)}  ${domain}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
