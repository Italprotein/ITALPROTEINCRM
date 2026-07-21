-- Invalidate JWT sessions after password recovery or other forced revocation.
ALTER TABLE "users" ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;
