export type CourierUpdate = {
  carrier: "DHL" | "BRT" | "Poste Italiane";
  trackingNumber: string;
  status: "in_transit" | "out_for_delivery" | "delivered" | "exception" | "unknown";
  subject: string;
  occurredAt: string;
  messageId: string;
};

export function parseCourierEmail(input: {
  from: string;
  subject: string;
  body: string;
  occurredAt: Date;
  messageId: string;
}): CourierUpdate | null {
  const haystack = `${input.subject}\n${input.body}`;
  const sender = input.from.toLowerCase();
  let carrier: CourierUpdate["carrier"] | null = null;
  if (sender.includes("dhl") || /\bDHL\b/i.test(haystack)) carrier = "DHL";
  else if (sender.includes("brt") || /\bBRT\b/i.test(haystack)) carrier = "BRT";
  else if (sender.includes("poste") || sender.includes("sda") || /\b(?:Poste Italiane|SDA)\b/i.test(haystack)) carrier = "Poste Italiane";
  if (!carrier) return null;

  const patterns = carrier === "DHL"
    ? [/(?:lettera di vettura|waybill|awb|tracking)(?:\s*(?:n\.?|number|:))?\s*[:#-]?\s*(\d{10})/i]
    : carrier === "BRT"
      ? [/(?:BRT\s*Code|tracking|spedizione)\s*[:#-]?\s*(\d{12,15})/i, /\b(0\d{13})\b/]
      : [/(?:codice spedizione|tracking|numero spedizione)\s*[:#-]?\s*([A-Z0-9]{9,18})/i];
  const trackingNumber = patterns.map((pattern) => haystack.match(pattern)?.[1]).find(Boolean);
  if (!trackingNumber) return null;

  let status: CourierUpdate["status"] = "unknown";
  if (/\b(consegnat[oa]|delivered)\b/i.test(haystack)) status = "delivered";
  else if (/\b(in consegna|out for delivery)\b/i.test(haystack)) status = "out_for_delivery";
  else if (/\b(eccezione|problema|ritardo|failed|exception)\b/i.test(haystack)) status = "exception";
  else if (/\b(in transito|in transit|spedizione|shipment|ritirat[oa]|picked up)\b/i.test(haystack)) status = "in_transit";

  return {
    carrier,
    trackingNumber,
    status,
    subject: input.subject,
    occurredAt: input.occurredAt.toISOString(),
    messageId: input.messageId,
  };
}
