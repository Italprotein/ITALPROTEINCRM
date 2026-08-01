/**
 * Pick one current NDA row per company while retaining the newest row that has
 * a real downloadable file. `rows` must already be ordered current-first.
 *
 * Status and file provenance are intentionally separate: imports and status
 * reconciliation can create a newer metadata-only row, but that must not hide
 * a PDF stored on an older NDA record for the same company.
 */
export function selectCurrentNdasWithFile<T>(
  rows: readonly T[],
  companyId: (row: T) => string,
  hasFile: (row: T) => boolean,
  fileTime: (row: T) => number,
): Array<{ current: T; fileSource?: T }> {
  const selected = new Map<string, { current: T; fileSource?: T; fileTime: number }>();

  for (const row of rows) {
    const id = companyId(row);
    let entry = selected.get(id);
    if (!entry) {
      entry = { current: row, fileTime: Number.NEGATIVE_INFINITY };
      selected.set(id, entry);
    }

    if (hasFile(row)) {
      const timestamp = fileTime(row);
      if (!entry.fileSource || timestamp > entry.fileTime) {
        entry.fileSource = row;
        entry.fileTime = timestamp;
      }
    }
  }

  return Array.from(selected.values(), ({ current, fileSource }) => ({ current, fileSource }));
}
