-- Calendar scopes for the shared ad@italprotein.com connection.
--
-- Additive only: existing tokens keep the scopes they were granted. A token
-- issued before this still holds gmail_* alone and must be re-authorised to
-- gain calendar access — granted scopes are fixed at consent time.
ALTER TYPE "GoogleScope" ADD VALUE IF NOT EXISTS 'calendar_events';
ALTER TYPE "GoogleScope" ADD VALUE IF NOT EXISTS 'calendar_readonly';
