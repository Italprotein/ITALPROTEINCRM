import "dotenv/config";

import { readFileSync, existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

// Imports data/import/companies.csv + contacts.csv into the database.
//   npx tsx scripts/import-data.ts --dry    (validate only, no writes)
//   npx tsx scripts/import-data.ts          (validate + upsert; idempotent)

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/* ── minimal RFC4180-ish CSV parser ── */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      /* skip */
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toObjects(grid: string[][]): Record<string, string>[] {
  const [header, ...rest] = grid;
  return rest.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/* ── enums (must match prisma/schema.prisma) ── */
const SET = (...v: string[]) => new Set(v);
const E = {
  type: SET("distributor", "fb_manufacturer", "horeca", "bakery_manufacturer", "dairy_manufacturer", "confectionery_manufacturer", "ingredient_company", "retailer", "agency", "laboratory", "consultant", "other"),
  segment: SET("bar_horeca", "pasticcerie_bakeries", "international_export", "distributor"),
  stage: SET("lead", "contacted", "interested", "qualified", "nda_in_progress", "nda_signed", "sampling", "testing", "commercial_discussion", "customer", "repeat_customer", "dormant", "lost"),
  nda: SET("not_required", "to_prepare", "draft", "sent", "under_review", "changes_requested", "approved", "awaiting_italprotein_signature", "awaiting_counterparty_signature", "partially_signed", "fully_signed", "expired", "terminated"),
  priority: SET("low", "medium", "high", "urgent"),
  decisionRole: SET("decision_maker", "influencer", "gatekeeper", "champion", "user", "unknown"),
  locale: SET("en", "it"),
};

const CC: Record<string, string> = {
  italy: "IT", italia: "IT", france: "FR", francia: "FR", germany: "DE", germania: "DE",
  spain: "ES", spagna: "ES", switzerland: "CH", svizzera: "CH", suisse: "CH",
  "united kingdom": "GB", uk: "GB", "united states": "US", usa: "US",
  "united arab emirates": "AE", uae: "AE", "saudi arabia": "SA", "arabia saudita": "SA",
  netherlands: "NL", belgium: "BE", belgio: "BE", austria: "AT",
  denmark: "DK", danimarca: "DK", danemark: "DK", sweden: "SE", canada: "CA",
  india: "IN", japan: "JP", qatar: "QA", kuwait: "KW", egypt: "EG", egitto: "EG",
  tunisia: "TN", peru: "PE", bulgaria: "BG", malaysia: "MY", luxembourg: "LU", lussemburgo: "LU", albania: "AL",
};
const codeOf = (country: string) => CC[country.trim().toLowerCase()] ?? "";

function initialsOf(name: string): string {
  const w = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? w[0]?.[1] ?? "") || "X").toUpperCase().slice(0, 2);
}
const orNull = (v: string) => (v ? v : null);

async function main() {
  const dry = process.argv.includes("--dry");

  for (const f of ["data/import/companies.csv", "data/import/contacts.csv"]) {
    if (!existsSync(f)) throw new Error(`${f} not found`);
  }

  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [(u.email ?? "").toLowerCase(), u.id]));
  // Prefer the organization super-admin as the fallback owner for rows whose
  // accountOwnerEmail doesn't resolve; never a developer's personal address.
  const fallbackOwner =
    userByEmail.get("ad@italprotein.com") ?? users[0]?.id;
  if (!fallbackOwner) throw new Error("No users in DB — run `npx prisma db seed` first.");

  const companies = toObjects(parseCSV(readFileSync("data/import/companies.csv", "utf8")));
  const contacts = toObjects(parseCSV(readFileSync("data/import/contacts.csv", "utf8")));

  /* ── validate ── */
  const errors: string[] = [];
  const warnings: string[] = [];
  const enumCheck = (val: string, set: Set<string>, where: string, col: string) => {
    if (val && !set.has(val)) errors.push(`${where}: ${col}="${val}" is not a valid value`);
  };
  companies.forEach((c, i) => {
    const w = `companies row ${i + 2} (${c.legalName || "?"})`;
    if (!c.legalName) errors.push(`companies row ${i + 2}: legalName is required`);
    enumCheck(c.type, E.type, w, "type");
    enumCheck(c.segment, E.segment, w, "segment");
    enumCheck(c.relationshipStage, E.stage, w, "relationshipStage");
    enumCheck(c.ndaStatus, E.nda, w, "ndaStatus");
    enumCheck(c.priority, E.priority, w, "priority");
  });
  const companyNames = new Set(companies.map((c) => c.legalName.toLowerCase()));
  contacts.forEach((ct, i) => {
    const w = `contacts row ${i + 2} (${ct.email || "?"})`;
    if (!ct.email) errors.push(`contacts row ${i + 2}: email is required`);
    if (!ct.companyName) errors.push(`contacts row ${i + 2}: companyName is required`);
    else if (!companyNames.has(ct.companyName.toLowerCase()))
      warnings.push(`contacts row ${i + 2}: companyName "${ct.companyName}" has no matching company — will be SKIPPED`);
    enumCheck(ct.decisionRole, E.decisionRole, w, "decisionRole");
    enumCheck(ct.preferredLanguage, E.locale, w, "preferredLanguage");
  });

  console.log(`Parsed: ${companies.length} companies, ${contacts.length} contacts.`);
  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} warning(s):`);
    warnings.slice(0, 30).forEach((x) => console.log("   " + x));
    if (warnings.length > 30) console.log(`   ...and ${warnings.length - 30} more`);
  }
  if (errors.length) {
    console.log(`\n❌ ${errors.length} BLOCKING error(s) — nothing written:`);
    errors.slice(0, 60).forEach((x) => console.log("   " + x));
    if (errors.length > 60) console.log(`   ...and ${errors.length - 60} more`);
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log("✓ Validation passed.");
  if (dry) {
    console.log("(dry run — no data written)");
    await prisma.$disconnect();
    return;
  }

  /* ── import companies ── */
  const existing = await prisma.company.findMany({ select: { id: true, legalName: true } });
  const idByName = new Map(existing.map((c) => [c.legalName.toLowerCase(), c.id]));
  const now = new Date();
  let cCreated = 0;
  let cUpdated = 0;
  for (const c of companies) {
    const base = {
      legalName: c.legalName,
      tradingName: orNull(c.tradingName),
      aliases: [],
      type: (c.type || "other") as never,
      segment: (orNull(c.segment) as never) ?? null,
      country: c.country || "",
      countryCode: codeOf(c.country),
      city: c.city || "",
      initials: initialsOf(c.legalName),
      preferredLanguage: "en" as never,
      preferredCurrency: "EUR" as never,
      marketsServed: [],
      headquarters: { line1: c.city || c.country || c.legalName, city: c.city || "", country: c.country || "" } as never,
      firstContact: { date: now.toISOString(), channel: "email" } as never,
      relationshipStage: (c.relationshipStage || "lead") as never,
      priority: (c.priority || "medium") as never,
      ndaStatus: (orNull(c.ndaStatus) as never) ?? null,
      website: orNull(c.website),
      distributionMarkets: [],
      productCategories: [],
      applicationInterests: [],
      supportingTeamUserIds: [],
      tags: c.tags ? c.tags.split(";").map((t) => t.trim()).filter(Boolean) : [],
      ownerUserId: userByEmail.get(c.accountOwnerEmail.toLowerCase()) ?? fallbackOwner,
      updatedById: fallbackOwner,
    };
    const id = idByName.get(c.legalName.toLowerCase());
    if (id) {
      await prisma.company.update({ where: { id }, data: base });
      cUpdated++;
    } else {
      const created = await prisma.company.create({ data: { ...base, createdById: fallbackOwner } });
      idByName.set(c.legalName.toLowerCase(), created.id);
      cCreated++;
    }
  }
  console.log(`✓ Companies: ${cCreated} created, ${cUpdated} updated.`);

  /* ── import contacts ── */
  const existingContacts = await prisma.contact.findMany({ select: { id: true, companyId: true, email: true } });
  const key = (cid: string, email: string) => `${cid}::${email.toLowerCase()}`;
  const contactByKey = new Map(existingContacts.map((x) => [key(x.companyId, x.email), x.id]));
  let ctCreated = 0;
  let ctUpdated = 0;
  let ctSkipped = 0;
  for (const ct of contacts) {
    const companyId = idByName.get(ct.companyName.toLowerCase());
    if (!companyId || !ct.email) {
      ctSkipped++;
      continue;
    }
    const base = {
      companyId,
      firstName: ct.firstName || "",
      lastName: ct.lastName || "",
      email: ct.email,
      jobTitle: orNull(ct.jobTitle),
      decisionRole: (orNull(ct.decisionRole) as never) ?? null,
      phone: orNull(ct.phone),
      mobile: orNull(ct.mobile),
      isPrimary: ct.isPrimary.toLowerCase() === "true",
      preferredLanguage: (orNull(ct.preferredLanguage) as never) ?? null,
      notes: orNull(ct.notes),
      communicationPreferences: [],
      updatedById: fallbackOwner,
    };
    const id = contactByKey.get(key(companyId, ct.email));
    if (id) {
      await prisma.contact.update({ where: { id }, data: base });
      ctUpdated++;
    } else {
      const created = await prisma.contact.create({ data: { ...base, createdById: fallbackOwner } });
      contactByKey.set(key(companyId, ct.email), created.id);
      ctCreated++;
    }
  }
  console.log(`✓ Contacts: ${ctCreated} created, ${ctUpdated} updated, ${ctSkipped} skipped (no matching company).`);
  console.log("\n✓ Import complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
