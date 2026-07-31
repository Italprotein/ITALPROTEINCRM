/**
 * Unique counterparties with direct shipment evidence in the connected Gmail
 * mailbox. One representative message is retained per company so this baseline
 * is auditable and does not count follow-ups or multiple parcels twice.
 *
 * Audited 2026-07-31. The runtime count is combined with persisted Shipment
 * rows, so newly recorded companies increase the total without changing this
 * historical evidence list.
 */
export const SHIPPED_COMPANY_EVIDENCE = [
  { companyKey: "abs-food", companyName: "ABS Food", gmailMessageId: "19ea76b90ffe1c51" },
  { companyKey: "ace-international", companyName: "Ace International", gmailMessageId: "19ed5c1eeffabadb" },
  { companyKey: "biomed", companyName: "Biomed AG", gmailMessageId: "19f042d484e2fd91" },
  { companyKey: "bulla", companyName: "Bulla Dairy Foods", gmailMessageId: "19fad117e1b6fc05" },
  { companyKey: "cargill", companyName: "Cargill", gmailMessageId: "19f461e73916681f" },
  { companyKey: "casillo", companyName: "Casillo Next Gen Food", gmailMessageId: "19ea76b5f67a5b3c" },
  { companyKey: "divassol", companyName: "Divassol", gmailMessageId: "19f88bd4823959b5" },
  { companyKey: "ek-ingredients", companyName: "EK Ingredients", gmailMessageId: "19f461dc01421081" },
  { companyKey: "emmi", companyName: "Emmi", gmailMessageId: "19f0423b8ae308d3" },
  { companyKey: "foodness", companyName: "Foodness", gmailMessageId: "19ea76b0aa04e0e3" },
  { companyKey: "gruppo-afr", companyName: "Gruppo AFR", gmailMessageId: "19ead1ca398762d3" },
  { companyKey: "grupo-saporiti", companyName: "Grupo Saporiti", gmailMessageId: "19ed5c8dc59abe69" },
  { companyKey: "hero", companyName: "Hero Group", gmailMessageId: "19f4c876aedf3064" },
  { companyKey: "igh", companyName: "IGH Flavours & Technology", gmailMessageId: "19fad0f29100ddb5" },
  { companyKey: "ingram-brothers", companyName: "Ingram Brothers", gmailMessageId: "19f461ea3d5cc315" },
  { companyKey: "layenberger", companyName: "Layenberger", gmailMessageId: "19f88be32fc82f8f" },
  { companyKey: "lec", companyName: "LEC", gmailMessageId: "19f461f80fb1b86e" },
  { companyKey: "milaf", companyName: "Milaf Global Food Company", gmailMessageId: "19ed5c40f1019e60" },
  { companyKey: "naturasì", companyName: "NaturaSì", gmailMessageId: "19ea76bc509f7fd5" },
  { companyKey: "nicks", companyName: "NICK'S", gmailMessageId: "19ea76adec26fa92" },
  { companyKey: "noem", companyName: "NÖM", gmailMessageId: "19ea76a3ae29e680" },
  { companyKey: "possible-foods", companyName: "Possible Foods", gmailMessageId: "19ed5ddb86ac8c5a" },
  { companyKey: "prinova", companyName: "Prinova Europe", gmailMessageId: "19f041fd338e764b" },
  { companyKey: "raw-global", companyName: "Raw Global", gmailMessageId: "19f0426a5289d651" },
  { companyKey: "red-bull", companyName: "Red Bull", gmailMessageId: "19fad0dea123a327" },
  { companyKey: "roeper", companyName: "CE Roeper", gmailMessageId: "19fad1685394ccb0" },
  { companyKey: "suedzucker", companyName: "Südzucker / BENEO", gmailMessageId: "19ed5c288a3fcfd6" },
  { companyKey: "suntory", companyName: "Suntory", gmailMessageId: "19ed5c22f90e85a7" },
  { companyKey: "synercore", companyName: "Synercore", gmailMessageId: "19f4c8d878c19dfc" },
  { companyKey: "venchi", companyName: "Venchi", gmailMessageId: "19ea76bf4da53a42" },
] as const;

const COMPANY_KEY_ALIASES: Record<string, string> = {
  "abs food": "abs-food",
  "ace international limited": "ace-international",
  "biomed ag": "biomed",
  "bulla dairy foods": "bulla",
  "casillo next gen food srl": "casillo",
  "ce roeper gmbh": "roeper",
  "grupo saporiti": "grupo-saporiti",
  "gruppo afr": "gruppo-afr",
  "hero group": "hero",
  "ingram brothers ltd": "ingram-brothers",
  "milaf global food company": "milaf",
  "naturasì": "naturasì",
  "natura si": "naturasì",
  "nick's": "nicks",
  "nö m": "noem",
  "nöm": "noem",
  "possible foods": "possible-foods",
  "prinova europe": "prinova",
  "raw global": "raw-global",
  "red bull gmbh": "red-bull",
  "südzucker": "suedzucker",
  "suedzucker": "suedzucker",
};

function normalizeCompanyName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en")
    .normalize("NFKC")
    .replace(/\s+/g, " ");
}

export function countUniqueShippedCompanies(additionalCompanyNames: readonly string[] = []): number {
  const keys = new Set<string>(SHIPPED_COMPANY_EVIDENCE.map((entry) => entry.companyKey));
  for (const name of additionalCompanyNames) {
    const normalized = normalizeCompanyName(name);
    keys.add(COMPANY_KEY_ALIASES[normalized] ?? normalized);
  }
  return keys.size;
}
