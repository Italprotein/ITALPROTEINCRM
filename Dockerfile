# syntax=docker/dockerfile:1
# Production image for the ITALPROTEIN CRM (Next.js + Prisma). Two stages:
# build (install + prisma generate + next build) → runner (lean, migrates on boot).

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# npm install (not `npm ci`) so the build tolerates a package-lock.json that was
# generated on a different Node major — the tree is still resolved from the lock;
# only genuinely-missing transitive entries (e.g. Node-version-specific ones) are
# added. Regenerate the lock on Node 22 and switch back to `npm ci` for strict
# reproducibility later if desired.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund --loglevel=error

COPY . .

# `next build` bakes NEXT_PUBLIC_* into the CLIENT bundle at THIS point. They are
# NOT read at runtime — if NEXT_PUBLIC_DATA_MODE is not "api" here, the deployed
# app runs in mock mode regardless of any runtime env. Pass them as build args.
ARG NEXT_PUBLIC_DATA_MODE=api
ARG NEXT_PUBLIC_SITE_URL=https://www.italprotein.com
ARG NEXT_PUBLIC_CONTACT_EMAIL=ad@italprotein.com
ARG NEXT_PUBLIC_CONTACT_PHONE_PRIMARY=
ARG NEXT_PUBLIC_CONTACT_ADDRESS=
ENV NEXT_PUBLIC_DATA_MODE=${NEXT_PUBLIC_DATA_MODE} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_CONTACT_EMAIL=${NEXT_PUBLIC_CONTACT_EMAIL} \
    NEXT_PUBLIC_CONTACT_PHONE_PRIMARY=${NEXT_PUBLIC_CONTACT_PHONE_PRIMARY} \
    NEXT_PUBLIC_CONTACT_ADDRESS=${NEXT_PUBLIC_CONTACT_ADDRESS}

# `prisma generate` (in the build script) reads DATABASE_URL via prisma.config.ts
# and fails loudly if unset. It does NOT connect — a placeholder is enough here;
# the real URL is injected at runtime.
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=${DATABASE_URL}
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# Prisma's schema engine (used by `migrate deploy` on boot) links libssl. The
# slim image lacks it — install so migrations run without the openssl warning.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# App + the Prisma CLI/schema/migrations needed to run `migrate deploy` on boot.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/messages ./messages
COPY --from=build /app/lib/generated ./lib/generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/package.json ./package.json
COPY scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && chown -R node:node /app

USER node
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
