/**
 * Investor register importer.
 *
 * Reads the campaign workbook export
 * (assets/Investitori/Investitori_Stato_Contatti-Contatti.csv by default, or
 * the path passed as the first non-flag argument) and upserts every row into
 * the `investors` table, keyed on the unique name — so re-running updates
 * rows in place and never duplicates. Nothing is ever deleted: a row that has
 * disappeared from the CSV is reported, not removed.
 *
 * DRY-RUN BY DEFAULT. Pass --apply to write.
 *
 *   npm run investors:dry
 *   npm run investors:apply
 *
 * All parsing lives in lib/investors.ts (typechecked + unit-tested); this file
 * is only I/O and reporting, and is pinned into tsconfig "files" so the
 * typecheck sees it.
 */
import { readFileSync } from "node:fs";

import { prisma } from "@/lib/backend/prisma";
import { parseInvestorsCsv } from "@/lib/investors";

const DEFAULT_CSV = "assets/Investitori/Investitori_Stato_Contatti-Contatti.csv";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const csvPath = args.find((a) => !a.startsWith("--")) ?? DEFAULT_CSV;

  const { inputs, issues } = parseInvestorsCsv(readFileSync(csvPath, "utf8"));

  console.log(`${apply ? "APPLY" : "DRY-RUN"} — ${csvPath}`);
  console.log(
    `parsed=${inputs.length} issues=${issues.length} ` +
      `in_contact=${inputs.filter((i) => i.status === "in_contact").length} ` +
      `to_recontact=${inputs.filter((i) => i.status === "to_recontact").length} ` +
      `rejected=${inputs.filter((i) => i.status === "rejected").length} ` +
      `first_contact=${inputs.filter((i) => i.status === "first_contact").length}`,
  );
  for (const issue of issues) {
    console.log(`  ISSUE line ${issue.line}: ${issue.reason} — ${issue.raw}`);
  }

  const existing = new Map(
    (await prisma.investor.findMany({ select: { id: true, name: true } })).map((r) => [r.name, r.id]),
  );
  const creates = inputs.filter((i) => !existing.has(i.name));
  const updates = inputs.filter((i) => existing.has(i.name));
  const inCsv = new Set(inputs.map((i) => i.name));
  const orphans = [...existing.keys()].filter((name) => !inCsv.has(name));

  console.log(`would create=${creates.length} update=${updates.length} not-in-csv(kept)=${orphans.length}`);

  if (!apply) {
    console.log("dry-run complete — pass --apply to write.");
    return;
  }

  let created = 0;
  let updated = 0;
  for (const input of inputs) {
    const data = {
      status: input.status,
      emails: input.emails,
      country: input.country ?? null,
      city: input.city ?? null,
      domain: input.domain ?? null,
      firstContactAt: input.firstContactAt ?? null,
      lastContactAt: input.lastContactAt ?? null,
      responseType: input.responseType ?? null,
      nextStep: input.nextStep ?? null,
      gmailUrl: input.gmailUrl ?? null,
    };
    await prisma.investor.upsert({
      where: { name: input.name },
      update: data,
      create: { name: input.name, ...data },
    });
    if (existing.has(input.name)) updated += 1;
    else created += 1;
  }
  const total = await prisma.investor.count();
  console.log(`applied: created=${created} updated=${updated} table-total=${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
