import "dotenv/config";

import { readFileSync, existsSync } from "node:fs";

// Importer for the master Italprotein CRM export (single sheet, Italian headers):
//   Azienda, Canale, Nominativo, Ruolo, Email, Telefono, Paese, Stato,
//   NDA Inviato, Data NDA Inviato, NDA Firmato, Data NDA Firmato,
//   Campione Inviato, Data Campione, Feedback Campione, Priorità,
//   Ultimo Contatto, Prossima Azione, Data Prossima Azione, Note
//
// Usage:
//   npx tsx scripts/import-crm.ts --validate   # parse + map + stats, NO database
//   npx tsx scripts/import-crm.ts --dry        # validate against the DB owner lookup, no writes
//   npx tsx scripts/import-crm.ts              # upsert companies + contacts (idempotent by company name)
//
// Put the export at data/import/crm.csv (your original file — keeps UTF-8 clean;
// the importer also repairs mojibake defensively, so a Latin-1 mis-decode is fine).

const FILE = process.env.CRM_CSV ?? "data/import/crm.csv";

// The internal person who ran the commercial outreach owns every imported lead.
// (Notes across the sheet read "Outreach Giuseppe" / "Contatto iniziale tramite
// Giuseppe".) Owner resolves to this email; external referrers are captured in
// firstContact.referrer, not as the owner.
const DEFAULT_OWNER_EMAIL = "giuseppeminelli@wefin.it";

/* ── mojibake repair ───────────────────────────────────────────────────────
   The export is UTF-8; when it is mis-decoded as Latin-1 you get "SÃ¬" for "Sì",
   "Â®" for "®", "Ã©" for "é". Detect those sequences and re-decode. Idempotent:
   a clean string has no Ã/Â mojibake markers, so it is returned untouched. */
function fixMojibake(s: string): string {
  if (!/[ÃÂ][\x80-\xBF ]/.test(s)) return s;
  try {
    const repaired = Buffer.from(s, "latin1").toString("utf8");
    // Only accept the repair if it did not introduce the replacement char.
    return repaired.includes("�") ? s : repaired;
  } catch {
    return s;
  }
}

/* ── RFC4180-ish CSV parser (handles quoted fields with newlines/commas) ── */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\r") { /* skip */ }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toObjects(grid: string[][]): Record<string, string>[] {
  const [header, ...rest] = grid;
  const keys = header.map((h) => fixMojibake(h).trim());
  return rest.map((r) =>
    Object.fromEntries(keys.map((h, i) => [h, fixMojibake(r[i] ?? "").trim()])),
  );
}

/* ── normalisation helpers ── */
const yes = (v: string) => /^(s[iì]|yes|true|y|x)$/i.test(v.trim());
const orNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* ── Stato (Italian pipeline stage) → RelationshipStage ── */
function mapStage(stato: string): string {
  const s = stripAccents(stato).replace(/\s+/g, " ");
  const table: Record<string, string> = {
    "primo contatto": "contacted",
    "in dialogo": "interested",
    "meeting fissato": "qualified",
    "nda inviato": "nda_in_progress",
    "nda in negoziazione": "nda_in_progress",
    "nda firmato": "nda_signed",
    "campione inviato": "sampling",
    "campione ricevuto": "sampling",
    "feedback ricevuto": "testing",
    "negoziazione": "commercial_discussion",
    "chiuso - vinto": "customer",
    "chiuso - perso": "lost",
    "in stand-by": "dormant",
    "in standby": "dormant",
  };
  return table[s] ?? "lead"; // empty / unknown → lead
}

/* ── Priorità → Priority ── */
function mapPriority(p: string): string {
  const s = stripAccents(p);
  if (s.startsWith("alt")) return "high";
  if (s.startsWith("urg")) return "urgent";
  if (s.startsWith("bass")) return "low";
  return "medium";
}

/* ── Canale → { type, segment } ── */
function mapChannel(canale: string): { type: string; segment: string | null } {
  const s = stripAccents(canale);
  if (s.includes("horeca")) return { type: "horeca", segment: "bar_horeca" };
  if (s.includes("partnership")) return { type: "distributor", segment: "distributor" };
  if (s.includes("dtc") || s.includes("retail")) return { type: "retailer", segment: "ecommerce_b2c" };
  if (s.includes("induststocktial") || s.includes("industrial") || s.includes("industriale") || s.includes("b2b"))
    return { type: "fb_manufacturer", segment: "international_export" };
  return { type: "other", segment: null };
}

/* ── NDA columns → NDAStatus ── */
function mapNda(inviato: string, firmato: string, stato: string): string | null {
  if (yes(firmato)) return "fully_signed";
  if (stripAccents(stato).includes("negoziazione") && stripAccents(stato).includes("nda")) return "under_review";
  if (yes(inviato)) return "sent";
  return null;
}

/* ── Campione + Feedback + Stato → latestSampleStatus ── */
function mapSample(campione: string, feedback: string, stato: string): string | null {
  const st = stripAccents(stato);
  if (st.includes("feedback ricevuto") || (feedback && !/^(n\/a|in attesa)?$/i.test(feedback.trim())))
    return "feedback_received";
  if (st.includes("campione ricevuto")) return "delivered";
  if (yes(campione) || st.includes("campione inviato")) return "shipped";
  return null;
}

/* ── first-contact channel from the free-text note ── */
function mapLeadSource(note: string): { channel: string; referrer: string | null } {
  const n = note.toLowerCase();
  const refMatch = note.match(/(?:su segnalazione di|segnalazione|indicazione|referral|tramite|warm via|via)\s+([A-ZÀ-Ý][\w'.-]+(?:\s+[A-ZÀ-Ý][\w'.-]+)?)/);
  if (/segnalazione|indicazione|referral|warm via|su segnalazione/.test(n))
    return { channel: "referral", referrer: refMatch ? refMatch[1].trim() : null };
  if (/linkedin/.test(n)) return { channel: "linkedin", referrer: null };
  if (/inbound/.test(n)) return { channel: "inbound_web", referrer: null };
  if (/form web|website|formulare|sito|web form/.test(n)) return { channel: "inbound_web", referrer: null };
  if (/gmail|riconciliazione|outreach|new innovative natural ingredient|ingrediente naturale/.test(n))
    return { channel: "gmail", referrer: null };
  return { channel: "email", referrer: null };
}

/* ── date parsing: DD/MM/YYYY or YYYY-MM-DD → ISO ── */
function parseDate(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString();
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString();
  return null;
}

const CC: Record<string, string> = {
  italy: "IT", italia: "IT", france: "FR", francia: "FR", germany: "DE", germania: "DE",
  spain: "ES", spagna: "ES", switzerland: "CH", svizzera: "CH", suisse: "CH",
  "united kingdom": "GB", uk: "GB", "regno unito": "GB", "united states": "US", usa: "US",
  "united arab emirates": "AE", uae: "AE", "saudi arabia": "SA", "arabia saudita": "SA",
  netherlands: "NL", "paesi bassi": "NL", olanda: "NL", belgium: "BE", belgio: "BE", austria: "AT",
  denmark: "DK", danimarca: "DK", danemark: "DK", sweden: "SE", svezia: "SE", sweeden: "SE",
  norway: "NO", norvegia: "NO", finland: "FI", finlandia: "FI", ireland: "IE", irlanda: "IE",
  portugal: "PT", portogallo: "PT", greece: "GR", grecia: "GR", poland: "PL", "repubblica ceca": "CZ",
  canada: "CA", india: "IN", japan: "JP", giappone: "JP", qatar: "QA", kuwait: "KW", koweit: "KW",
  egypt: "EG", egitto: "EG", tunisia: "TN", peru: "PE", "perù": "PE", bulgaria: "BG", israel: "IL", israele: "IL",
  argentina: "AR", mexico: "MX", messico: "MX", colombia: "CO", brazil: "BR", brasile: "BR",
  "south africa": "ZA", "sud africa": "ZA", australia: "AU", "new zealand": "NZ", "nuova zelanda": "NZ",
  luxembourg: "LU", lussemburgo: "LU", malaysia: "MY", china: "CN", "alto adige": "IT",
};
function codeOf(country: string): { country: string; code: string } {
  // "UK / Giappone" or "USA / India" → take the first named country.
  const first = country.split(/[\/,]/)[0].trim();
  return { country: first || country.trim(), code: CC[stripAccents(first)] ?? "" };
}

function initialsOf(name: string): string {
  const w = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? w[0]?.[1] ?? "") || "X").toUpperCase().slice(0, 2);
}

interface ParsedContact {
  firstName: string; lastName: string; jobTitle: string | null; email: string;
  isPrimary: boolean;
}
interface ParsedCompany {
  legalName: string; type: string; segment: string | null;
  country: string; countryCode: string; city: string;
  stage: string; priority: string; nda: string | null; sample: string | null;
  leadSourceChannel: string; referrer: string | null;
  phone: string | null; nextAction: string | null; nextActionDate: string | null;
  lastContactAt: string | null; notes: string | null;
  contacts: ParsedContact[]; row: number;
}

function splitMulti(v: string): string[] {
  return v.split(/\s*\/\s*|\s{2,}/).map((x) => x.trim()).filter(Boolean);
}

function buildContacts(nominativo: string, ruolo: string, emailRaw: string): ParsedContact[] {
  const emails = (emailRaw.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? []).map((e) => e.toLowerCase());
  if (!emails.length) return [];
  const names = splitMulti(nominativo).filter((n) => n && !/^(team|_)/i.test(n));
  const roles = splitMulti(ruolo);
  return emails.map((email, i) => {
    const full = (names[i] ?? names[0] ?? "").trim();
    const parts = full.split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
      jobTitle: (roles[i] ?? roles[0] ?? "").trim() || null,
      email,
      isPrimary: i === 0,
    };
  });
}

function parseCompanies(): ParsedCompany[] {
  const raw = readFileSync(FILE, "utf8");
  const objs = toObjects(parseCSV(raw));
  const out: ParsedCompany[] = [];
  const seen = new Set<string>();
  objs.forEach((r, i) => {
    const name = (r["Azienda"] ?? "").trim();
    if (!name) return; // spacer / blank rows
    const dedupKey = name.toLowerCase();
    if (seen.has(dedupKey)) return; // duplicate company row → first wins
    seen.add(dedupKey);
    const { type, segment } = mapChannel(r["Canale"] ?? "");
    const { country, code } = codeOf(r["Paese"] ?? "");
    const note = r["Note"] ?? "";
    const { channel, referrer } = mapLeadSource(note);
    out.push({
      legalName: name,
      type, segment,
      country, countryCode: code, city: "",
      stage: mapStage(r["Stato"] ?? ""),
      priority: mapPriority(r["Priorità"] ?? ""),
      nda: mapNda(r["NDA Inviato"] ?? "", r["NDA Firmato"] ?? "", r["Stato"] ?? ""),
      sample: mapSample(r["Campione Inviato"] ?? "", r["Feedback Campione"] ?? "", r["Stato"] ?? ""),
      leadSourceChannel: channel, referrer,
      phone: orNull(r["Telefono"]),
      nextAction: orNull(r["Prossima Azione"]),
      nextActionDate: parseDate(r["Data Prossima Azione"] ?? ""),
      lastContactAt: parseDate(r["Ultimo Contatto"] ?? ""),
      notes: orNull(note),
      contacts: buildContacts(r["Nominativo"] ?? "", r["Ruolo"] ?? "", r["Email"] ?? ""),
      row: i + 2,
    });
  });
  return out;
}

function printStats(companies: ParsedCompany[]) {
  const count = (fn: (c: ParsedCompany) => string) => {
    const m = new Map<string, number>();
    for (const c of companies) m.set(fn(c), (m.get(fn(c)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const totalContacts = companies.reduce((s, c) => s + c.contacts.length, 0);
  const noContact = companies.filter((c) => c.contacts.length === 0).length;
  const noCountry = companies.filter((c) => !c.countryCode).length;
  console.log(`\nParsed ${companies.length} unique companies, ${totalContacts} contacts.`);
  console.log(`  ${noContact} companies have no usable email (imported without contacts).`);
  console.log(`  ${noCountry} companies have an unrecognised country code (review CC map).`);
  const show = (label: string, rows: [string, number][]) => {
    console.log(`\n${label}`);
    rows.forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
  };
  show("By relationship stage:", count((c) => c.stage));
  show("By channel/type:", count((c) => c.type));
  show("By priority:", count((c) => c.priority));
  show("By lead source (first contact):", count((c) => c.leadSourceChannel));
  const referred = companies.filter((c) => c.referrer);
  console.log(`\n${referred.length} companies with a named referrer:`);
  referred.slice(0, 20).forEach((c) => console.log(`  ${c.legalName} ← ${c.referrer}`));
  if (referred.length > 20) console.log(`  ...and ${referred.length - 20} more`);
  const badCountries = [...new Set(companies.filter((c) => !c.countryCode && c.country).map((c) => c.country))];
  if (badCountries.length) console.log(`\nUnmapped country labels: ${badCountries.join(", ")}`);
}

async function main() {
  const validate = process.argv.includes("--validate");
  const dry = process.argv.includes("--dry");

  if (!existsSync(FILE)) {
    console.error(`✗ ${FILE} not found. Save your CRM export there first (one row per company).`);
    process.exit(1);
  }

  const companies = parseCompanies();
  printStats(companies);

  if (validate) {
    console.log(`\n✓ Validate-only (no database touched). Owner for every lead → ${DEFAULT_OWNER_EMAIL}.`);
    return;
  }

  // DB modes need Prisma + the owner user to exist.
  const { PrismaClient } = await import("../lib/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    const byEmail = new Map(users.map((u) => [(u.email ?? "").toLowerCase(), u.id]));
    const owner = byEmail.get(DEFAULT_OWNER_EMAIL) ?? users[0]?.id;
    if (!owner) throw new Error("No users in DB — run `npx prisma db seed` first.");
    console.log(`\nOwner resolved: ${DEFAULT_OWNER_EMAIL} → ${owner}`);

    if (dry) { console.log("(dry run — no data written)"); return; }

    const existing = await prisma.company.findMany({ select: { id: true, legalName: true } });
    const idByName = new Map(existing.map((c) => [c.legalName.toLowerCase(), c.id]));
    const now = new Date();
    let cCreated = 0, cUpdated = 0, ctTotal = 0;

    for (const c of companies) {
      const data = {
        legalName: c.legalName,
        aliases: [] as string[],
        type: c.type as never,
        segment: (c.segment as never) ?? null,
        country: c.country,
        countryCode: c.countryCode,
        city: c.city,
        initials: initialsOf(c.legalName),
        preferredLanguage: (c.countryCode === "IT" ? "it" : "en") as never,
        preferredCurrency: "EUR" as never,
        marketsServed: [] as string[],
        headquarters: { line1: c.country || c.legalName, city: c.city, country: c.country } as never,
        leadSource: c.leadSourceChannel as never,
        firstContact: {
          date: c.lastContactAt ?? now.toISOString(),
          channel: c.leadSourceChannel,
          ...(c.referrer ? { referrer: c.referrer } : {}),
        } as never,
        relationshipStage: c.stage as never,
        priority: c.priority as never,
        ndaStatus: (c.nda as never) ?? null,
        latestSampleStatus: (c.sample as never) ?? null,
        distributionMarkets: [] as string[],
        productCategories: [] as never[],
        applicationInterests: [] as string[],
        supportingTeamUserIds: [] as string[],
        tags: [] as string[],
        commercialNotes: c.notes,
        lastActivityAt: c.lastContactAt ? new Date(c.lastContactAt) : null,
        nextAction: c.nextAction
          ? ({ label: c.nextAction, dueDate: c.nextActionDate } as never)
          : null,
        ownerUserId: owner,
        updatedById: owner,
      };
      let companyId = idByName.get(c.legalName.toLowerCase());
      if (companyId) {
        await prisma.company.update({ where: { id: companyId }, data });
        cUpdated++;
      } else {
        const created = await prisma.company.create({ data: { ...data, createdById: owner } });
        companyId = created.id;
        idByName.set(c.legalName.toLowerCase(), companyId);
        cCreated++;
      }

      for (const ct of c.contacts) {
        const found = await prisma.contact.findFirst({
          where: { companyId, email: ct.email }, select: { id: true },
        });
        const cdata = {
          companyId,
          firstName: ct.firstName || ct.email.split("@")[0],
          lastName: ct.lastName,
          jobTitle: ct.jobTitle,
          email: ct.email,
          phone: ct.isPrimary ? c.phone : null,
          isPrimary: ct.isPrimary,
          preferredLanguage: (c.countryCode === "IT" ? "it" : "en") as never,
          communicationPreferences: [] as string[],
          ownerUserId: owner,
          updatedById: owner,
        };
        if (found) await prisma.contact.update({ where: { id: found.id }, data: cdata });
        else { await prisma.contact.create({ data: { ...cdata, createdById: owner } }); ctTotal++; }
      }
    }
    console.log(`\n✓ Companies: ${cCreated} created, ${cUpdated} updated. Contacts upserted: ${ctTotal}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
