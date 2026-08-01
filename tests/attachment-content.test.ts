import { describe, expect, it, vi } from "vitest";

import { readAttachmentBody } from "@/lib/backend/attachment-content";

describe("attachment content resolution", () => {
  it("serves inline Gmail bytes before a database storage marker", async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const loadObject = vi.fn();

    await expect(
      readAttachmentBody({ bytes, storageKey: "db:attachment:abc" }, loadObject),
    ).resolves.toBe(bytes);
    expect(loadObject).not.toHaveBeenCalled();
  });

  it("loads bucket-only uploads from object storage", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const loadObject = vi.fn().mockResolvedValue({ body: bytes, contentType: "application/pdf" });

    await expect(
      readAttachmentBody({ bytes: null, storageKey: "documents/company/file.pdf" }, loadObject),
    ).resolves.toBe(bytes);
    expect(loadObject).toHaveBeenCalledWith("documents/company/file.pdf");
  });

  it("returns null for metadata-only attachment rows", async () => {
    await expect(
      readAttachmentBody({ bytes: null, storageKey: null }),
    ).resolves.toBeNull();
  });
});
