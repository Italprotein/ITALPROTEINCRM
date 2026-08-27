/**
 * Is this inbound message a machine talking, or a person?
 *
 * This runs in code, before Groq, because the counts it feeds are structural.
 * `mailer-daemon@googlemail.com` is threaded into all three BCC blasts (4+
 * bounces each, mailbox read 2026-08-14): if those counted as replies, three
 * threads carrying ~390 recipients would show human engagement and the
 * `humanReplyCount === 0 => NO_RESPONSE` guard would stop protecting them.
 *
 * The opposite error is just as costly and much quieter — the campaign produced
 * exactly one genuine human reply so far (`p.pendenza@equita.eu`, 6 Aug). A
 * rule that swallows it turns the only live lead into silence. So every pattern
 * here is anchored: "out of office" is a phrase, "assente" is a whole word, and
 * the bare word "automatic"/"automatico" is deliberately NOT a pattern, because
 * a fund writing "our screening is automatic" is a human writing to us.
 *
 * Pure: no Prisma, no network, no Gmail types.
 */

export interface AutoReplyProbe {
  /** Raw From header: "Name <addr>" or a bare address. */
  from?: string | null;
  subject?: string | null;
  headers?: Record<string, string | string[] | null | undefined> | null;
}

/** Which family of rule fired — logged by the sync so counts can be audited. */
export type AutoReplyReason = 'header' | 'sender' | 'subject';

/**
 * Header values that mean "a program sent this".
 *
 * `list` is deliberately absent, and must stay absent. Google Groups and every
 * other list stamps `Precedence: list` on mail it relays, and this campaign
 * mailed dozens of `info@` and `segreteria@` addresses that are group aliases —
 * so treating `list` as automated turns a real investor's answer, relayed
 * through their own group, into silence that nobody can see. The spec lists
 * `bulk|auto_reply` and nothing more.
 */
const PRECEDENCE_AUTOMATED = new Set(['bulk', 'auto_reply', 'auto-reply', 'autoreply']);

/**
 * Local parts that belong to a robot, compared after `.`, `-` and `_` are
 * removed, so `no-reply`, `no.reply` and `noreply` are one rule.
 */
const AUTOMATED_LOCAL_PREFIXES = [
  'mailerdaemon',
  'postmaster',
  'noreply',
  'donotreply',
  'nonrispondere',
];

/**
 * Subject patterns, it/en/de/fr. Every one is anchored so it cannot fire on
 * prose that merely contains a word: matching is done on a subject reduced to
 * lowercase words separated by single spaces.
 */
const AUTOMATED_SUBJECT_PATTERNS: readonly RegExp[] = [
  /\bout of office\b/,
  /\booo\b/,
  /\bautoreply\b/,
  /\bauto reply\b/,
  /\bauto response\b/,
  /\bautomatic reply\b/,
  /\bautomatic response\b/,
  /\bautomated reply\b/,
  /\bautomated response\b/,
  /\brisposta automatica\b/,
  /\bmessaggio automatico\b/,
  /\bassente\b/,
  /\bfuori sede\b/,
  /\bassenza dall ufficio\b/,
  /\babwesenheit\b/,
  /\bautomatische antwort\b/,
  /\babsence du bureau\b/,
  /\breponse automatique\b/,
  /\bundeliverable\b/,
  /\bdelivery status notification\b/,
  /\breturned mail\b/,
  /\bmail delivery failed\b/,
  /\bdelivery incomplete\b/,
  /\bdelivery has failed\b/,
  /\bmessage non remis\b/,
  /\bmancata consegna\b/,
];

/** Case-insensitive header lookup that tolerates array values. */
function headerValue(probe: AutoReplyProbe, name: string): string | null {
  const headers = probe.headers;
  if (!headers) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted) continue;
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === null || raw === undefined) return null;
    return String(raw).trim();
  }
  return null;
}

function hasHeader(probe: AutoReplyProbe, name: string): boolean {
  const headers = probe.headers;
  if (!headers) return false;
  const wanted = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === wanted);
}

/** "Name <a@b.com>" -> "a@b.com"; a bare address survives unchanged. */
function addressOf(from: string | null | undefined): string {
  if (!from) return '';
  const angled = /<([^>]+)>/.exec(from);
  return (angled ? angled[1] : from).trim().toLowerCase();
}

/** Lowercase, accent-folded, punctuation-free, Re:/R:/Fwd: stripped. */
function normalizeSubject(subject: string | null | undefined): string {
  if (!subject) return '';
  return subject
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(?:\s*(?:re|r|fw|fwd|i|aw|tr)\s*:\s*)+/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function headerReason(probe: AutoReplyProbe): boolean {
  const autoSubmitted = headerValue(probe, 'auto-submitted')?.toLowerCase() ?? '';
  // RFC 3834: anything but "no" is machine-generated ("auto-replied",
  // "auto-generated", "auto-notified").
  if (autoSubmitted.startsWith('auto')) return true;

  if (hasHeader(probe, 'x-autoreply') || hasHeader(probe, 'x-autorespond')) {
    const value = (
      headerValue(probe, 'x-autoreply') ??
      headerValue(probe, 'x-autorespond') ??
      ''
    ).toLowerCase();
    if (value !== 'no' && value !== 'false') return true;
  }

  const precedence = headerValue(probe, 'precedence')?.toLowerCase() ?? '';
  if (PRECEDENCE_AUTOMATED.has(precedence)) return true;

  // An empty Return-Path is the null sender: every bounce carries it, and no
  // human MUA sends one.
  if (hasHeader(probe, 'return-path')) {
    const returnPath = headerValue(probe, 'return-path') ?? '';
    if (returnPath === '' || returnPath === '<>') return true;
  }

  return false;
}

function senderReason(probe: AutoReplyProbe): boolean {
  const address = addressOf(probe.from);
  if (!address) return false;

  if (address.includes('bounce')) return true;

  const local = address.split('@')[0].replace(/[.\-_]/g, '');
  return AUTOMATED_LOCAL_PREFIXES.some((prefix) => local.startsWith(prefix));
}

function subjectReason(probe: AutoReplyProbe): boolean {
  const subject = normalizeSubject(probe.subject);
  if (!subject) return false;
  return AUTOMATED_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject));
}

/**
 * The rule family that flagged this message, or null when a human wrote it.
 * Checked headers first, then sender, then subject — most reliable first, so
 * the logged reason is the strongest one available.
 */
export function automatedReplyReason(probe: AutoReplyProbe): AutoReplyReason | null {
  if (!probe) return null;
  if (headerReason(probe)) return 'header';
  if (senderReason(probe)) return 'sender';
  if (subjectReason(probe)) return 'subject';
  return null;
}

/** True when this inbound message must not count as human engagement. */
export function isAutomatedReply(probe: AutoReplyProbe): boolean {
  return automatedReplyReason(probe) !== null;
}
