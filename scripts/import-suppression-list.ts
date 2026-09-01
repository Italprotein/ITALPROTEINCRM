/**
 * Seed the outreach freeze into the follow-up register.
 *
 * Source: "ITALPROTEIN — DO NOT CONTACT LIST", suppression window now through
 * 11 October 2026. The campaign rule, verbatim: do not send new cold emails,
 * Apollo outreach, duplicate outreach, or contact new people at these companies
 * before that date. Replies inside an existing thread are fine. A company that
 * asked for a LATER date keeps the later one.
 *
 * Usage:
 *   npm run suppression:dry     # report only, writes nothing
 *   npm run suppression:apply   # upsert the rows
 *
 * Re-runnable. Rows are matched by company link first, then by normalized name,
 * so a second run updates instead of duplicating. It never deletes and never
 * touches a row whose source is not `suppression_list` — if somebody converted
 * one of these into a manual follow-up, that decision stands.
 */

import { prisma } from "@/lib/backend/prisma";
import { normalizeEntityName, registrableDomainOf } from "@/lib/email-entity";
import { planSuppressionRows, type SuppressionEntry } from "@/lib/follow-ups";

/** The campaign-wide review date. */
const CAMPAIGN_DATE = "2026-10-11";

/* ── A. Commercial / technical / distribution relationships ── */
const COMMERCIAL: SuppressionEntry[] = [
  { name: "Bulla Dairy Foods", domain: "bulla.com.au", reason: "Active sample / supplier / October meeting process" },
  { name: "Red Bull", domain: "redbull.com", reason: "Evaluation in progress; counterpart stated 8-12 weeks — do not auto-chase on 11 October" },
  { name: "Granulati Italia", domain: "granulati-italia.it", reason: "Product testing still pending" },
  { name: "Winner Group Enterprise", domain: "winnergroup.co.th", reason: "Introductory call / active interest" },
  { name: "Nick's", domain: "nicks.com", reason: "Feedback / technical call in progress" },
  { name: "DMK Deutsches Milchkontor", domain: "dmk.de", reason: "NDA signed; sample received; technical follow-up" },
  { name: "Crave Eatables", domain: "craveeatables.in", reason: "NDA / sample / logistics process" },
  { name: "Diemme Food", domain: "diemmefood.com", reason: "Trials / sample handover in progress" },
  { name: "Zweifel", domain: "zweifel.ch", reason: "NDA negotiation and technical evaluation" },
  { name: "Solen", domain: "solen.com.tr", reason: "R&D; call / technical questions in progress" },
  { name: "Ace International", domain: "aceinternational.co.in", reason: "Sample evaluation in progress" },
  { name: "IPF Colombia", domain: "ipf.com.co", reason: "Samples under evaluation; regional discussion" },
  { name: "EcorNaturaSi", domain: "ecornaturasi.it", reason: "Sample scheduled for product testing" },
  { name: "Ricola", domain: "ricola.com", reason: "NDA preparation / R&D; process" },
  { name: "Unired", domain: "unired.it", reason: "Sample received; technical questions ongoing" },
  { name: "Foodness", domain: "foodness.it", reason: "Existing R&D; relationship / testing" },
  { name: "Joriba Bakery", domain: "joribabakery.be", reason: "Mutual NDA discussion / technical evaluation" },
  { name: "Hero Group", domain: "hero.es", reason: "Product tests / R&D; exchange ongoing" },
  { name: "Fazer", domain: "fazer.com", reason: "Sample received; testing in progress" },
  { name: "Daisy Brand", domain: "daisybrand.com", reason: "NDA executed; sample / evaluation process" },
  { name: "pladis Global", domain: "pladisglobal.com", reason: "Existing NDA / bakery-confectionery evaluation" },
  { name: "Givaudan", domain: "givaudan.com", reason: "Internal technical review before NDA/MTA" },
  { name: "IceDog", domain: "icedog.it", reason: "Explicit request to reconnect at end of September" },
  { name: "Pathway International", reason: "ANZ distribution / exclusivity discussions" },
  { name: "Verve", reason: "ANZ distribution discussion already opened" },
  { name: "Biota Ingredients", reason: "NDA / external evaluation discussion" },
  { name: "Victus / Integral", reason: "NDA / distribution discussion" },
  { name: "James Crisp", reason: "NZ distribution / exclusivity / NDA discussion" },
  { name: "Warburtons", domain: "warburtons.co.uk", reason: "NDA / technical call process" },
  { name: "Charles & Alice", reason: "NDA signed; R&D; discussions" },
  { name: "Natilait", domain: "natilait.com.tn", reason: "NDA / trial process" },
  { name: "Return On Health", reason: "NDA signed; sample / Phase 1 trials" },
  { name: "Al Ain Farms", reason: "Client NDA / regulatory pre-assessment" },
  { name: "Denham", reason: "Sample received; evaluation underway" },
  { name: "Raw Global", reason: "Active sample / customs / BD-partner relationship" },
  { name: "Possible Foods", reason: "NDA signed; sample process" },
  { name: "Trulo Foods", reason: "NDA signed; sample / prior call" },
  { name: "Galbusera", domain: "galbusera.it", reason: "Existing sample / evaluation relationship" },
  { name: "LBG Sicilia", reason: "NDA / sample / call process" },
  { name: "Leva Apex", reason: "Exclusive Middle East & Africa distribution relationship" },
  { name: "Zentis", domain: "zentis.de", reason: "Sample shipment / evaluation" },
  { name: "Divassol", reason: "NDA signed; LOI process" },
  { name: "NCMP", reason: "Covered by LEVA APEX; NDA / commercial process" },
  { name: "Yoplait Liberte Canada", domain: "yoplaitliberte.ca", reason: "Recent exchange; do not duplicate outreach" },
  { name: "Team Presti / Tsunami Nutrition", domain: "teampresti.com", reason: "Counterparty asked to revisit after internal contract discussions" },
  // The one entry with a date of its own: "reconnect Nov-Dec 2026 — later than
  // this list", so the freeze runs past the campaign review date.
  { name: "Ristora", domain: "ristora.com", reason: "Explicitly asked to reconnect Nov-Dec 2026", followUpOn: "2026-11-01" },
];

/* ── B. Investor / financing relationships already in process ── */
const INVESTORS: SuppressionEntry[] = [
  { name: "Kairos Partners", domain: "kairospartners.com", reason: "Active NDA / AUCAP diligence and documentation" },
  { name: "NaStartup", reason: "Positive / active investor route" },
  { name: "Italian Angels for Growth (IAG)", domain: "italianangels.net", reason: "Application / investor process already opened" },
  { name: "Wylab", reason: "Application route already opened" },
  { name: "Italian Founders Fund", domain: "italianfoundersfund.com", reason: "Application / investor route already opened" },
  { name: "Carlyle", domain: "carlyle.com", reason: "Existing investor contact / request ticket" },
  { name: "Andera Partners", domain: "anderapartners.com", reason: "Existing investor contact acknowledged" },
  { name: "Angels4Impact", reason: "Application submitted; awaiting their review" },
  { name: "PranaVentures", domain: "pranaventures.it", reason: "Application form requested / investor process" },
  { name: "PH Capital", domain: "phcapital.it", reason: "Active meeting / investor-corporate introduction process" },
  { name: "Inno-Valley", domain: "inno-valley.it", reason: "Active call scheduling / investor discussion" },
  { name: "Deloitte FoodTech Acceleration Platform", domain: "deloitte.it", reason: "Existing introduction / follow-up route" },
  { name: "Angels4Women", domain: "angels4women.com", reason: "Application / evaluation route already opened" },
];

const ENTRIES = [...COMMERCIAL, ...INVESTORS];

const NOTE =
  "Da lista di sospensione outreach Italprotein. Nessuna nuova email a freddo, " +
  "nessun contatto Apollo, nessun nuovo referente prima di questa data. " +
  "Le risposte dentro un thread già aperto restano consentite.";

interface CompanyRow {
  id: string;
  legalName: string;
  tradingName: string | null;
  website: string | null;
}

/**
 * Match an entry to a company record.
 *
 * Name first, then domain. Name is the stronger signal here because the list
 * was written by the people who also named the companies in the CRM, whereas a
 * domain can be shared by unrelated records (a group and its subsidiary).
 */
function matchCompany(
  entry: SuppressionEntry,
  byName: Map<string, CompanyRow[]>,
  byDomain: Map<string, CompanyRow[]>,
): { company: CompanyRow | null; note: string } {
  const nameHits = byName.get(normalizeEntityName(entry.name)) ?? [];
  if (nameHits.length === 1) return { company: nameHits[0], note: "name" };
  if (nameHits.length > 1) return { company: null, note: "ambiguous_name" };

  if (entry.domain) {
    const domainHits = byDomain.get(registrableDomainOf(entry.domain)) ?? [];
    if (domainHits.length === 1) return { company: domainHits[0], note: "domain" };
    if (domainHits.length > 1) return { company: null, note: "ambiguous_domain" };
  }
  return { company: null, note: "unlinked" };
}

async function main() {
  const apply = process.argv.includes("--apply");

  const plan = planSuppressionRows(ENTRIES, CAMPAIGN_DATE);

  const companies: CompanyRow[] = await prisma.company.findMany({
    select: { id: true, legalName: true, tradingName: true, website: true },
  });

  const byName = new Map<string, CompanyRow[]>();
  const byDomain = new Map<string, CompanyRow[]>();
  for (const company of companies) {
    for (const name of [company.legalName, company.tradingName]) {
      if (!name) continue;
      const key = normalizeEntityName(name);
      if (!key) continue;
      byName.set(key, [...(byName.get(key) ?? []), company]);
    }
    const domain = registrableDomainOf(company.website);
    if (domain) byDomain.set(domain, [...(byDomain.get(domain) ?? []), company]);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const linked: string[] = [];
  const unlinked: string[] = [];

  for (const row of plan) {
    const entry = ENTRIES.find((e) => e.name === row.companyName)!;
    const { company, note } = matchCompany(entry, byName, byDomain);
    (company ? linked : unlinked).push(`${row.companyName} (${note})`);

    // Find an existing register row: by company when we matched one, otherwise
    // by name among the rows that have no company either.
    const existing = company
      ? await prisma.followUp.findUnique({ where: { companyId: company.id } })
      : await prisma.followUp.findFirst({
          where: { companyId: null, normalizedName: row.normalizedName },
        });

    if (existing && existing.source !== "suppression_list") {
      // Somebody took this row over. Their decision outranks the import.
      skipped += 1;
      continue;
    }

    const data = {
      companyId: company?.id ?? null,
      companyName: row.companyName,
      normalizedName: row.normalizedName,
      domain: row.domain,
      status: row.status,
      source: row.source,
      followUpOn: new Date(`${row.followUpOn}T00:00:00.000Z`),
      reason: row.reason,
      notes: NOTE,
    };

    if (!apply) {
      existing ? (updated += 1) : (created += 1);
      continue;
    }

    if (existing) {
      await prisma.followUp.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.followUp.create({ data });
      created += 1;
    }
  }

  const mode = apply ? "APPLIED" : "DRY RUN (nothing written)";
  console.log(`\n── Outreach freeze → follow-up register — ${mode} ──`);
  console.log(`campaign date : ${CAMPAIGN_DATE}`);
  console.log(`entries       : ${ENTRIES.length} (${COMMERCIAL.length} commercial, ${INVESTORS.length} investor)`);
  console.log(`linked        : ${linked.length}`);
  console.log(`unlinked      : ${unlinked.length}  (kept by name — the instruction still has to be visible)`);
  console.log(`created       : ${created}`);
  console.log(`updated       : ${updated}`);
  console.log(`skipped       : ${skipped}  (row taken over by hand)`);

  const overrides = plan.filter((r) => r.followUpOn !== CAMPAIGN_DATE);
  if (overrides.length) {
    console.log(`\nlater dates than the campaign review:`);
    for (const row of overrides) console.log(`  ${row.followUpOn}  ${row.companyName}`);
  }

  if (unlinked.length) {
    console.log(`\nno company record (listed by name only):`);
    for (const name of unlinked) console.log(`  ${name}`);
  }

  if (!apply) console.log(`\nRe-run with --apply to write.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
