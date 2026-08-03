# Technical documents library, imported from Drive

Date: 2026-08-03 · Status: approved by user

Replace the "In scadenza" KPI on `NDA & Documenti` with a clickable
**Documenti tecnici** card leading to a shared technical-document library that
imports the Drive folder "Documenti Tecnici", with role-gated adding and
post-NDA client visibility.

## Decisions taken

| Question | Answer |
| --- | --- |
| What the card opens | A dedicated page, `/admin/documents/technical` |
| Where "add" writes | CRM only — Drive stays a one-way source, no Drive write scope |
| Who may sync/add | `super_admin`, `crm_admin`, `rnd_technical` |
| Client visibility | Visible in the portal to companies with a signed NDA |

**Accepted loss:** "In scadenza" was the only surface for NDAs expiring within
60 days. Replacing it removes that alert. The user confirmed the replacement.
`ndaStatistics().expiringSoon` is left in place, so restoring it later is a
one-line UI change.

## Architecture

### Import — Drive to CRM, one way

`lib/backend/drive-technical-sync.ts`, modelled on the existing
`drive-nda-sync.ts` but simpler: the source is one flat folder, so none of the
company-name matching applies.

- Folder id from a new `GOOGLE_DRIVE_TECHNICAL_FOLDER_ID` env var. Absent → the
  sync returns a clear error rather than silently importing nothing.
- Lists the folder, keeps document-type files (the same predicate the NDA sync
  uses: pdf/doc/docx/odt/rtf and Google Docs).
- Skips any file whose `GoogleDriveFileLink.driveModifiedTime` still matches, so
  re-running is cheap and idempotent.
- Downloads under the same 20 MB cap; oversized files are skipped and reported.
- Upserts `Document` + `Attachment` + `GoogleDriveFileLink` keyed on
  `googleFileId`, exactly as the NDA sync does.

Imported documents are written with `companyId: null`,
`confidentialityClass: "post_nda"`, and an inferred category.

### Category inference

Pure, unit-tested, in `lib/technical-docs.ts` so both data modes share it:

| Filename contains | Category |
| --- | --- |
| `scheda tecnica`, `data sheet`, `tds` | `technical_data_sheet` |
| `sicurezza`, `safety`, `sds`, `msds` | `safety_data_sheet` |
| `guida`, `guide`, `application`, `applicativ` | `application_guide` |
| `certificat`, `certificate` | `certificate` |
| `regolament`, `regulatory`, `compliance` | `regulatory` |
| anything else | `other` |

### Library membership

The technical library is defined, with no schema migration, as:

```
companyId IS NULL AND category IN (technical_data_sheet, safety_data_sheet,
                                   application_guide, certificate, regulatory, other)
```

Company-specific files carry a `companyId`; NDAs carry `category: "nda"`. Both
are therefore excluded by construction. The predicate lives in
`lib/technical-docs.ts` and is used by the Prisma service and the mock service
alike, so `DATA_MODE` cannot make the two disagree.

### Portal — no code change

`documentsForPortal` already returns documents where `companyId` is null and the
access level is in `POST_NDA`, gated on `ndaSigned`
(`lib/services/document.actions.ts:193-195`). Writing imports as
`companyId: null` + `post_nda` therefore surfaces them to any company with a
signed NDA through the existing gate. Nothing in the portal is touched.

### Visibility toggle — the safety valve

Because every file in the Drive folder becomes client-visible on sync, each row
on the page carries a toggle between `post_nda` (client-visible) and `internal`
(staff only). Imports default to `post_nda`, per the decision above; a draft data
sheet can be pulled back without deleting it from Drive. Without this the only
way to un-publish is to delete the Drive file and re-sync.

The toggle is a `setDocumentVisibility(id, level)` action restricted to the two
levels — it is not a general access-level editor.

### Permissions

One matrix change: `rnd_technical` gains `documents: "edit"` (currently the
inherited `"view"`). Every gate is the existing `canEdit(role, "documents")`,
which then admits `super_admin`, `crm_admin` and `rnd_technical`.

### Surfaces

- `app/api/documents/sync-technical/route.ts` — POST, mirrors
  `app/api/ndas/sync-drive/route.ts` including its permission check and result
  shape (`{ synced, skipped }`).
- `app/[locale]/admin/documents/technical/page.tsx` — `DataTable` of the library
  (name, category, visibility, size, updated, download), with **Sincronizza da
  Drive** and **Aggiungi documento** shown only to roles that pass the gate.
- `app/[locale]/admin/ndas/page.tsx` — the fifth KPI becomes Documenti tecnici,
  `tone="info"`, `href="/admin/documents/technical"`. `StatCard` already renders
  as a link when `href` is set, so no component change.

## Error handling

- Drive not connected, or the folder id unset: the sync returns an error the
  page reports; the card still shows the CRM-side count, because the count is a
  database read and never touches Drive.
- Oversized or undownloadable files are skipped and named in the result, the
  same contract `syncLatestDriveNdas` returns today.
- The sync is idempotent, so a partial failure is repaired by running it again.

## Testing

Vitest over the pure module: category inference for each rule and its fallback,
and the library-membership predicate (excludes company-specific, excludes NDAs).
The sync itself needs Drive plus a database and stays untested, matching how
`drive-nda-sync.ts` is handled today.

## Non-goals

- No Drive write scope, no upload-to-Drive.
- No per-company technical documents — this library is deliberately shared.
- No general access-level editor; the toggle covers two levels only.
- No backfill of existing documents into the library.

## Operator action required

`GOOGLE_DRIVE_TECHNICAL_FOLDER_ID` must be set in `.env.production` on the VPS
to the id of the "Documenti Tecnici" folder. Until it is, the page renders and
the card counts, but syncing reports that the folder is not configured.
