export interface LeadMemberIdentity {
  id: string;
  fullName: string;
  firstName: string;
}

const QUOTED_REPLY_MARKERS = [
  /^on\s.+wrote:\s*$/iu,
  /^il\s+giorno\s.+ha\s+scritto:\s*$/iu,
  /^le\s.+a\s+ecrit\s*:\s*$/iu,
  /^-{2,}\s*(?:original message|messaggio originale)\s*-{2,}$/iu,
  /^(?:from|da):\s+.+@.+$/iu,
];

/** Keep only the new text written by the external sender, not quoted thread history. */
export function currentIncomingMessageText(body: string): string {
  const lines = body.replace(/\r/g, "").split("\n");
  const current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) break;
    if (current.length > 0 && QUOTED_REPLY_MARKERS.some((marker) => marker.test(trimmed))) break;
    current.push(line);
  }

  return current.join("\n").trim().slice(0, 8_000);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstWholeNameIndex(text: string, name: string): number {
  const clean = name.trim();
  if (clean.length < 2) return -1;
  const expression = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(clean)}(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  );
  const match = expression.exec(text);
  return match ? match.index + match[1].length : -1;
}

/**
 * Select the Italprotein member whose name occurs first in the sender's own
 * message. A first name is used only when it identifies one member uniquely;
 * duplicated first names require the full name.
 */
export function firstMentionedLeadMember<T extends LeadMemberIdentity>(
  body: string,
  members: T[],
): T | null {
  const text = currentIncomingMessageText(body);
  if (!text) return null;

  const firstNameCounts = new Map<string, number>();
  for (const member of members) {
    const key = member.firstName.trim().toLocaleLowerCase();
    if (key) firstNameCounts.set(key, (firstNameCounts.get(key) ?? 0) + 1);
  }

  let winner: { member: T; index: number; specificity: number } | null = null;
  for (const member of members) {
    const candidates: { name: string; specificity: number }[] = [
      { name: member.fullName, specificity: 2 },
    ];
    const firstKey = member.firstName.trim().toLocaleLowerCase();
    if (firstKey && firstNameCounts.get(firstKey) === 1) {
      candidates.push({ name: member.firstName, specificity: 1 });
    }

    for (const candidate of candidates) {
      const index = firstWholeNameIndex(text, candidate.name);
      if (index < 0) continue;
      if (
        !winner ||
        index < winner.index ||
        (index === winner.index && candidate.specificity > winner.specificity)
      ) {
        winner = { member, index, specificity: candidate.specificity };
      }
    }
  }

  return winner?.member ?? null;
}
