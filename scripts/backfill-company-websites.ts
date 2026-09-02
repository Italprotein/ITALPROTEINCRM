/**
 * Fill in the website field from the domains a company already owns.
 *
 * 363 companies on production carry a registered domain in `company_domains` —
 * proved by mail we actually exchanged with them — and still render a blank
 * website. Nothing here is looked up or guessed; it copies an answer already on
 * the record into the field people read.
 *
 * Usage:
 *   npm run websites:dry     # report only, writes nothing
 *   npm run websites:apply   # write them
 *
 * Only ever fills a blank. A website somebody typed is never overwritten.
 */

import { prisma } from "@/lib/backend/prisma";
import { websiteFromDomains } from "@/lib/outreach";

async function main() {
  const apply = process.argv.includes("--apply");
  const verbose = process.argv.includes("--verbose");

  const companies = await prisma.company.findMany({
    where: {
      OR: [{ website: null }, { website: "" }],
      domains: { some: {} },
    },
    select: {
      id: true,
      legalName: true,
      tradingName: true,
      domains: { select: { domain: true } },
    },
    orderBy: { legalName: "asc" },
  });

  let written = 0;
  const rows: { name: string; website: string; from: number }[] = [];

  for (const company of companies) {
    const website = websiteFromDomains(company.domains.map((d) => d.domain));
    if (!website) continue;
    rows.push({
      name: company.tradingName || company.legalName,
      website,
      from: company.domains.length,
    });
    if (apply) {
      await prisma.company
        .update({ where: { id: company.id }, data: { website } })
        .then(() => {
          written += 1;
        })
        .catch(() => undefined);
    }
  }

  const remaining = await prisma.company.count({
    where: { OR: [{ website: null }, { website: "" }] },
  });

  console.log(`\n── Company websites from owned domains — ${apply ? "APPLIED" : "DRY RUN (nothing written)"} ──`);
  console.log(`blank website + a known domain : ${companies.length}`);
  console.log(`resolvable to a website        : ${rows.length}`);
  if (apply) console.log(`written                        : ${written}`);
  console.log(`still blank after this         : ${apply ? remaining : remaining - rows.length} (no domain on record)`);

  if (verbose) {
    console.log(`\nwhat would be written:`);
    for (const row of rows) {
      const note = row.from > 1 ? `  (${row.from} domains, shortest wins)` : "";
      console.log(`  ${row.name.padEnd(34)} ${row.website}${note}`);
    }
  } else {
    console.log(`\nRe-run with --verbose to list every row.`);
  }

  if (!apply) console.log(`\nRe-run with --apply to write.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
