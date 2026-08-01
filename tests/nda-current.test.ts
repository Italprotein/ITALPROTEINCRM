import { describe, expect, it } from "vitest";

import { selectCurrentNdasWithFile } from "@/lib/nda-current";

type Row = { id: string; companyId: string; hasFile: boolean; fileTime: number };

const select = (rows: Row[]) =>
  selectCurrentNdasWithFile(
    rows,
    (row) => row.companyId,
    (row) => row.hasFile,
    (row) => row.fileTime,
  );

describe("current NDA file selection", () => {
  it("keeps the current status row but recovers a file from company history", () => {
    const current = { id: "current", companyId: "redbull", hasFile: false, fileTime: 0 };
    const signed = { id: "signed", companyId: "redbull", hasFile: true, fileTime: 10 };

    expect(select([current, signed])).toEqual([{ current, fileSource: signed }]);
  });

  it("uses the newest real file without changing which row is current", () => {
    const current = { id: "current", companyId: "acme", hasFile: true, fileTime: 5 };
    const newerFile = { id: "older-row", companyId: "acme", hasFile: true, fileTime: 20 };

    expect(select([current, newerFile])).toEqual([{ current, fileSource: newerFile }]);
  });

  it("does not advertise a file when no stored file exists", () => {
    const current = { id: "current", companyId: "empty", hasFile: false, fileTime: 0 };

    expect(select([current])).toEqual([{ current, fileSource: undefined }]);
  });
});
