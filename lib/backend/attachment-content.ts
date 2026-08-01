import { getObject, type StoredObject } from "./storage";

type AttachmentContent = {
  bytes: Uint8Array | null;
  storageKey: string | null;
};

type ObjectLoader = (key: string) => Promise<StoredObject | null>;

/**
 * Resolve an attachment without mistaking Gmail's `db:attachment:*` reference
 * for an object-store key. Inline Postgres bytes are authoritative whenever
 * present; S3-compatible storage is only consulted for bucket-only uploads.
 */
export async function readAttachmentBody(
  attachment: AttachmentContent,
  loadObject: ObjectLoader = getObject,
): Promise<Uint8Array | null> {
  if (attachment.bytes) return attachment.bytes;
  if (!attachment.storageKey) return null;
  return (await loadObject(attachment.storageKey))?.body ?? null;
}
