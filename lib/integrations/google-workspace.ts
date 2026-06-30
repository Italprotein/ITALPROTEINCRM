import type { DocumentAccessLevel, ID, Locale, Role } from '@/lib/types';

export const GOOGLE_WORKSPACE_SCOPES = {
  driveFile: 'https://www.googleapis.com/auth/drive.file',
  driveMetadataReadonly: 'https://www.googleapis.com/auth/drive.metadata.readonly',
  documents: 'https://www.googleapis.com/auth/documents',
  gmailSend: 'https://www.googleapis.com/auth/gmail.send',
} as const;

export type GoogleWorkspaceScope =
  (typeof GOOGLE_WORKSPACE_SCOPES)[keyof typeof GOOGLE_WORKSPACE_SCOPES];

export const GOOGLE_DRIVE_DOCUMENT_MIME_TYPES = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export interface GoogleWorkspaceActor {
  accountId: ID;
  role: Role;
  companyId?: ID;
  locale: Locale;
}

export interface DriveDocumentSummary {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  accessLevel: DocumentAccessLevel;
  companyId?: ID;
}

export interface DocsPatchRequest {
  documentId: string;
  requiredRevisionId?: string;
  reason: string;
  requests: unknown[];
}

export interface OutboundMailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  textBody: string;
  relatedEntityType?: string;
  relatedEntityId?: ID;
  locale: Locale;
}

export interface GoogleWorkspaceGateway {
  listDriveDocuments(actor: GoogleWorkspaceActor, query?: string): Promise<DriveDocumentSummary[]>;
  readDriveDocument(actor: GoogleWorkspaceActor, documentId: string): Promise<DriveDocumentSummary>;
  patchGoogleDoc(actor: GoogleWorkspaceActor, patch: DocsPatchRequest): Promise<{ documentId: string; revisionId?: string }>;
  sendMail(actor: GoogleWorkspaceActor, message: OutboundMailRequest): Promise<{ providerMessageId: string }>;
}

export const GOOGLE_WORKSPACE_BACKEND_TODO = [
  'Authorize server-side only; never expose Google refresh tokens to the browser.',
  'Store token grants encrypted and tied to a real user or service account.',
  'Re-check CRM role, company scope, NDA status and document accessLevel before every Drive read or Docs write.',
  'Audit every Drive read, Docs write and Gmail send with actor, target id and result.',
  'Prefer drive.file plus Google Picker for per-file access; request broader Drive scopes only after a formal security decision.',
] as const;
