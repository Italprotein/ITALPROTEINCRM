#!/bin/sh
# Runtime entrypoint: apply pending migrations, then start the server.
# Migrations are idempotent (prisma migrate deploy only applies un-applied ones),
# so this is safe to run on every container start / restart.
set -e

echo "→ Applying database migrations (prisma migrate deploy)…"
npx prisma migrate deploy

echo "→ Starting Next.js on :${PORT:-3000}…"
exec ./node_modules/.bin/next start -p "${PORT:-3000}" -H 0.0.0.0
