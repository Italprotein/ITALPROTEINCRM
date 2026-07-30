-- Forces a password change on first sign-in for accounts whose password was
-- chosen by someone else (seeded bootstrap admins, operator resets).
--
-- Defaults to false so every existing account is unaffected by the deploy; the
-- seed marks the bootstrap admins, and changePassword() clears it.
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
