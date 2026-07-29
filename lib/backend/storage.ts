import { AwsClient } from "aws4fetch";

import { getBackendEnv } from "./env";

/*
 * Object storage seam (S3-compatible).
 *
 * Works with any S3 API: Cloudflare R2, Backblaze B2, AWS S3, or a self-hosted
 * MinIO container. Signing is done with aws4fetch (~5 KB) rather than the full
 * AWS SDK to keep the production image small.
 *
 * The bucket is PRIVATE. Nothing here ever mints a public or pre-signed URL —
 * every byte is streamed back through /api/attachments/[id], which re-checks the
 * caller's company and the document's confidentiality class. Guessing an object
 * key therefore buys an attacker nothing.
 *
 * Fallback: when the OBJECT_STORAGE_* variables are not configured, callers keep
 * bytes in Postgres (Attachment.bytes). That is how Gmail-filed NDA attachments
 * already work, so existing rows keep resolving either way.
 */

export interface StoredObject {
  body: Uint8Array;
  contentType: string | null;
}

/** True when every credential needed to talk to the bucket is present. */
export function isObjectStorageConfigured(): boolean {
  const { bucket, accessKeyId, secretAccessKey } = getBackendEnv().storage;
  return Boolean(bucket && accessKeyId && secretAccessKey);
}

function client(): AwsClient {
  const { region, accessKeyId, secretAccessKey } = getBackendEnv().storage;
  return new AwsClient({
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    // R2 ignores the region but still requires one in the signature; "auto" is
    // the value Cloudflare documents.
    region: region ?? "auto",
    service: "s3",
  });
}

/**
 * Full URL of an object. With OBJECT_STORAGE_ENDPOINT set (R2, B2, MinIO) we use
 * path style: {endpoint}/{bucket}/{key}. Without it we assume AWS S3 and use the
 * virtual-hosted form.
 */
function objectUrl(key: string): string {
  const { bucket, region, endpoint } = getBackendEnv().storage;
  // Encode each segment but keep the "/" separators readable in the console.
  const safeKey = key.split("/").map(encodeURIComponent).join("/");
  if (endpoint) return `${endpoint.replace(/\/+$/, "")}/${bucket}/${safeKey}`;
  return `https://${bucket}.s3.${region ?? "us-east-1"}.amazonaws.com/${safeKey}`;
}

/** Namespaced, unguessable key. Company prefix keeps the bucket browsable. */
export function buildStorageKey(companyId: string | null, filename: string): string {
  const safeName = filename.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
  return `documents/${companyId ?? "org"}/${crypto.randomUUID()}/${safeName}`;
}

/** Copy into a plain ArrayBuffer — a Uint8Array view is not a valid BodyInit. */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

/** Uploads bytes. Throws on a non-2xx so callers can fall back or surface an error. */
export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const res = await client().fetch(objectUrl(key), {
    method: "PUT",
    body: toArrayBuffer(body),
    headers: { "Content-Type": contentType, "Content-Length": String(body.byteLength) },
  });
  if (!res.ok) {
    throw new Error(`object_storage_put_failed:${res.status}`);
  }
}

/** Fetches bytes. Returns null when the object is missing (404). */
export async function getObject(key: string): Promise<StoredObject | null> {
  const res = await client().fetch(objectUrl(key), { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`object_storage_get_failed:${res.status}`);
  return {
    body: new Uint8Array(await res.arrayBuffer()),
    contentType: res.headers.get("content-type"),
  };
}

/** Best-effort delete — used for cleanup, so a failure must not break the caller. */
export async function deleteObject(key: string): Promise<void> {
  try {
    await client().fetch(objectUrl(key), { method: "DELETE" });
  } catch {
    // Swallow: an orphaned object is far less harmful than a failed user action.
  }
}
