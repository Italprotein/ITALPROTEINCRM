/**
 * Put every company we reached out to into the CRM, replied or not.
 *
 * The CRM only ever learned about a company when somebody wrote to us, or when
 * an NDA arrived attached. Cold outreach that got no answer left no trace: on
 * production, 519 outbound messages reached 269 domains and 135 organisations had
 * no company row at all — McCain, addressed twice across 18 people, and
 * Fonterra, Chobani and Monster who never replied at all.
 *
 * Each new company is attributed to the Italprotein agent who signed the
 * outreach. That has to come from the signature: everything is sent from the
 * shared ad@italprotein.com, so `From` records nobody.
 *
 * Usage:
 *   npm run outreach:dry                    # report only, writes nothing
 *   npm run outreach:dry -- --verbose       # list every domain and verdict
 *   npm run outreach:apply                  # create the companies
 *   npm run outreach:apply -- --type=fb_manufacturer
 *
 * Creates only — it never edits or deletes a company anybody entered by hand.
 */

import { prisma } from "@/lib/backend/prisma";
import { planOutreachImport, runOutreachImport } from "@/lib/backend/outreach-companies";
import { companyNameFromDomain, countryFromDomain } from "@/lib/outreach";

function argValue(name: string): string | undefined {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const verbose = process.argv.includes("--verbose");
  const companyType = argValue("type");

  // Held separately rather than narrowed out of a union: the apply result is a
  // superset of the plan, and `in` narrowing loses the extra fields.
  const applied = apply ? await runOutreachImport({ companyType }) : null;
  const result = applied ?? (await planOutreachImport());

  const ignoredTotal = Object.values(result.ignored).reduce((a, b) => a + b, 0);

  console.log(`\n── Outbound mail → companies — ${apply ? "APPLIED" : "DRY RUN (nothing written)"} ──`);
  console.log(`recipient domains  : ${result.domains}`);
  console.log(`already a company  : ${result.linked}`);
  console.log(`to create          : ${result.creates.length}`);
  console.log(`ignored            : ${ignoredTotal}`);
  for (const [reason, count] of Object.entries(result.ignored)) {
    if (count > 0) console.log(`    ${reason.padEnd(18)} ${count}`);
  }

  console.log(`\nattribution (who signed the outreach):`);
  for (const [email, count] of Object.entries(result.byAgent).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${email.padEnd(34)} ${count}`);
  }
  if (result.unattributed) {
    console.log(`    ${"(no signature matched)".padEnd(34)} ${result.unattributed}`);
  }

  if (applied) {
    console.log(`\ncompanies created  : ${applied.companiesCreated}`);
    console.log(`contacts created   : ${applied.contactsCreated}`);
    console.log(`domains registered : ${applied.domainsRegistered}`);
    console.log(`outbound mail newly linked  : ${applied.messagesLinked}`);
    console.log(`replies newly linked        : ${applied.repliesLinked}`);
    console.log(`\ncompany type used  : ${companyType ?? "other (unverified — see --type)"}`);
  }

  if (verbose) {
    console.log(`\nignored domains:`);
    for (const row of result.ignoredDomains.sort((a, b) => a.reason.localeCompare(b.reason))) {
      console.log(`  ${row.domain.padEnd(34)} ${row.reason}`);
    }
    console.log(`\ncompanies that would be created:`);
    for (const candidate of result.creates) {
      const name = companyNameFromDomain(candidate.domain) ?? "?";
      const country = countryFromDomain(candidate.domain)?.code ?? "--";
      console.log(
        `  ${candidate.domain.padEnd(32)} ${String(candidate.messageCount).padStart(3)} msg ${String(candidate.recipientCount).padStart(3)} rcpt  ` +
          `${country}  ${candidate.replied ? "replied" : "silent "}  ` +
          `${(candidate.agentEmail ?? "unattributed").padEnd(32)} ${name}`,
      );
    }
  } else {
    console.log(`\nRe-run with --verbose to list every domain.`);
  }

  if (!apply) {
    console.log(`\nRe-run with --apply to write.`);
    console.log(`Add --type=fb_manufacturer if these are all food manufacturers.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
