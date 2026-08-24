import { describe, expect, it } from "vitest";

import { driveFolderId } from "@/lib/backend/drive-folder-id";

/*
 * Production evidence behind these cases (2026-08-24):
 *
 *  - docker-compose injects `GOOGLE_DRIVE_INDUSTRIAL_CLIENTS_FOLDER_ID: "${…:-}"`
 *    and the VPS env file does not set it, so the container holds an EMPTY
 *    STRING. `?? DEFAULT_ROOT` does not catch `""`, so the NDA sync asked Drive
 *    for `'' in parents` and got an opaque 404.
 *  - `GOOGLE_DRIVE_TECHNICAL_FOLDER_ID` was copied out of the env template WITH
 *    its angle brackets: `<141NGTYpxKY1b0BMV5lMz9N3xdOrMCtd3>`.
 *
 * Both are "configured" as far as `??` and `if (!folderId)` can tell. This
 * helper is the one place that decides what counts as actually configured.
 */
describe("driveFolderId", () => {
  it("treats an empty string as unset", () => {
    expect(driveFolderId("")).toBeUndefined();
  });

  it("treats whitespace as unset", () => {
    expect(driveFolderId("   ")).toBeUndefined();
    expect(driveFolderId("\n\t ")).toBeUndefined();
  });

  it("returns undefined for a missing variable", () => {
    expect(driveFolderId(undefined)).toBeUndefined();
  });

  it("passes a normal id through untouched", () => {
    expect(driveFolderId("1Nq5vcROWHTjmROZXzU-tD2RcJZMZoOuc")).toBe("1Nq5vcROWHTjmROZXzU-tD2RcJZMZoOuc");
  });

  it("trims surrounding whitespace off a normal id", () => {
    expect(driveFolderId("  1Nq5vcROWHTjmROZXzU-tD2RcJZMZoOuc \n")).toBe("1Nq5vcROWHTjmROZXzU-tD2RcJZMZoOuc");
  });

  it("strips the template's wrapping angle brackets", () => {
    expect(driveFolderId("<141NGTYpxKY1b0BMV5lMz9N3xdOrMCtd3>")).toBe("141NGTYpxKY1b0BMV5lMz9N3xdOrMCtd3");
  });

  it("strips wrapping angle brackets with spaces inside and out", () => {
    expect(driveFolderId("  < 141NGTYpxKY1b0BMV5lMz9N3xdOrMCtd3 >  ")).toBe("141NGTYpxKY1b0BMV5lMz9N3xdOrMCtd3");
  });

  it("treats empty brackets as unset", () => {
    expect(driveFolderId("<>")).toBeUndefined();
    expect(driveFolderId("<   >")).toBeUndefined();
  });

  it("strips only ONE pair of brackets", () => {
    expect(driveFolderId("<<abc>>")).toBe("<abc>");
  });

  it("leaves an id that merely contains a bracket alone", () => {
    expect(driveFolderId("a<b")).toBe("a<b");
    expect(driveFolderId("<abc")).toBe("<abc");
    expect(driveFolderId("abc>")).toBe("abc>");
  });

  it("falls back when the value is unset, empty, whitespace or an empty placeholder", () => {
    expect(driveFolderId(undefined, "ROOT")).toBe("ROOT");
    expect(driveFolderId("", "ROOT")).toBe("ROOT");
    expect(driveFolderId("   ", "ROOT")).toBe("ROOT");
    expect(driveFolderId("<>", "ROOT")).toBe("ROOT");
  });

  it("prefers a configured value over the fallback", () => {
    expect(driveFolderId("configured", "ROOT")).toBe("configured");
    expect(driveFolderId("<configured>", "ROOT")).toBe("configured");
  });
});
