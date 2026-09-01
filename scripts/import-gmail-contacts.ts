/**
 * Write down every contact the mailbox already knows about.
 *
 * Every address we have written to, or heard from, on a thread attached to a
 * company is a contact — including several from the same company, which is the
 * point: the CRM held one row per company where the mailbox holds four.
 *
 * Before any address is written it is checked against the delivery failures in
 * the same mailbox. An address Gmail answered with "Indirizzo non trovato" /
 * "Address not found" is never added. A mailbox that merely bounced a large
 * message, or was full, is NOT treated as dead — see lib/contact-harvest.ts.
 *
 * Usage:
 *   npm run contacts:dry     # report only, writes nothing
 *   npm run contacts:apply   # create the missing contacts
 *
 * Creates only. It never edits or deletes a contact somebody entered by hand.
 */

import { prisma } from "@/lib/backend/prisma";
import { applyContactHarvest, planContactHarvest } from "@/lib/backend/contact-harvest";

async function main() {
  const apply = process.argv.includes("--apply");
  const verbose = process.argv.includes("--verbose");

  const result = apply ? await applyContactHarvest() : await planContactHarvest();
  const created = "created" in result ? result.created : 0;

  const companies = new Set(result.creates.map((c) => c.companyId));

  console.log(`\n── Gmail → contacts — ${apply ? "APPLIED" : "DRY RUN (nothing written)"} ──`);
  console.log(`candidate addresses : ${result.candidates}`);
  console.log(`to create           : ${result.creates.length}  across ${companies.size} companies`);
  if (apply) console.log(`created             : ${created}`);
  console.log(`\nskipped:`);
  console.log(`  already a contact : ${result.skipped.already_a_contact}`);
  console.log(`  ADDRESS NOT FOUND : ${result.skipped.address_not_found}`);
  console.log(`  our own domain    : ${result.skipped.own_domain}`);
  console.log(`  mail infrastructure: ${result.skipped.infrastructure}`);
  console.log(`  unparseable       : ${result.skipped.invalid}`);

  console.log(
    `\nGmail reported ${result.notFound.length} addresses as not found; ` +
      `${result.softBounces.length} other bounces were NOT address problems ` +
      `(too large, mailbox full, policy) and their addresses stay eligible.`,
  );

  if (verbose) {
    console.log(`\naddresses refused as not found:`);
    for (const address of result.notFound) console.log(`  ${address}`);

    console.log(`\ncontacts that would be created:`);
    for (const create of result.creates) {
      const name = [create.firstName, create.lastName].filter(Boolean).join(" ");
      console.log(`  ${create.email.padEnd(44)} ${name}`);
    }
  } else {
    console.log(`\nRe-run with --verbose to list every address.`);
  }

  if (!apply) console.log(`\nRe-run with --apply to write.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
