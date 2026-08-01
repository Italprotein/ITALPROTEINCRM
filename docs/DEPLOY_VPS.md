# Deploy ITALPROTEIN CRM to a VPS (Docker + Caddy)

The self-hosted path: one Linux VPS running three containers — the Next.js app,
Postgres, and Caddy (which fetches HTTPS certificates automatically and proxies
traffic to the app). No Vercel, no managed database required.

**Legend:** **[YOU]** = a manual step (server, DNS, secrets). **[RUNS]** = a
command you run on the VPS.

---

## What you need first

- A **VPS** (e.g. Hetzner CX22 or a DigitalOcean 2 GB droplet), **EU region**
  for GDPR since this holds real client data. Ubuntu 22.04/24.04 LTS.
- A **domain/subdomain** you can point at the VPS — e.g. `crm.italprotein.com`.
- The **`/data/` files** (gitignored, so they arrive out-of-band): `data/admins.json`
  (the admin allowlist) and `data/import/crm.csv` (the company export).

> ⚠️ **Cost reality:** the server is ~€5–20/month. The person who administers it
> (updates, backups, certs, monitoring) is the real cost — see the earlier cost
> discussion. This runbook assumes that person exists.

---

## 1. Prepare the server  **[YOU]**

SSH in, then install Docker Engine + the compose plugin:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out/in so `docker` works without sudo
```

Open the firewall for web traffic only:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

## 2. Point DNS at the server  **[YOU]**

Create an **A record**: `crm.italprotein.com → <VPS public IP>`. Wait for it to
resolve (`dig +short crm.italprotein.com`) before step 5 — Caddy needs it to
issue the certificate.

## 3. Get the code + secrets onto the server  **[RUNS]**

```bash
git clone https://github.com/Italprotein/ITALPROTEINCRM.git
cd ITALPROTEINCRM
git checkout backend-phase-1        # the live branch — see the warning below
cp .env.production.example .env.production
```

> ⚠️ **`backend-phase-1` is the live branch**, and it is what `origin/HEAD`
> points at. `main` and `master` are stale leftovers — as of 2026-08-02 they sit
> 26 commits behind, missing the Amina assistant, the operational dashboard, the
> responsive pass and the NDA work. Deploying either of them would roll
> production backwards. An earlier version of this runbook claimed the three
> branches were identical; they have not been for some time.

Edit `.env.production` and fill in every `REPLACE_…`. Generate the secrets:

```bash
npx auth secret                                                            # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  # each key/password
```

Set `APP_DOMAIN` and `APP_URL` to your domain. **Do not commit `.env.production`.**

## 4. Provide the gitignored data files  **[YOU]**

`/data/` never travels through git. Copy the two files to the server (from your
machine):

```bash
scp data/admins.json  user@server:~/ITALPROTEINCRM/data/admins.json
scp data/import/crm.csv user@server:~/ITALPROTEINCRM/data/import/crm.csv
```

> `data/admins.json` decides who can log in — the seed **purges every user not in
> it**. `labidimedamine53@gmail.com` (Amine) is the super-admin; the rest are
> crm_admin (full business CRUD, no admin powers).

## 5. Build and start  **[RUNS]**

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

This builds the image, starts Postgres, and boots the app — which **applies the
database migrations automatically** on start. Caddy obtains the HTTPS certificate
for your domain within a minute. Check:

```bash
docker compose -f docker-compose.prod.yml logs -f app     # watch "migrate deploy" then "Starting Next.js"
docker compose -f docker-compose.prod.yml ps              # all healthy?
```

## 6. Seed admins + import the companies  **[RUNS] (one-off)**

Migrations create the tables; these two commands fill them. Run them **inside**
the app container so they use the same database and code:

```bash
# 1) Roles + the admin allowlist (reads data/admins.json)
docker compose -f docker-compose.prod.yml exec app npx prisma db seed

# 2) The 426 real companies + contacts (reads data/import/crm.csv)
docker compose -f docker-compose.prod.yml exec app npm run import:crm
```

> If `exec` cannot see the `/data` files, they were not copied in step 4, or the
> image excluded them (it does, by design). Mount them for the one-off instead:
> `docker compose -f docker-compose.prod.yml run --rm -v "$PWD/data:/app/data" app npm run import:crm`.

## 7. Log in and smoke-test  **[YOU]**

Open `https://crm.italprotein.com/en/team-login` and sign in as Amine
(super_admin) or Giuseppe (crm_admin). You should land on **Companies** with the
426 real records. Confirm search, add, edit and delete work.

## 8. Schedule the Gmail sync  **[YOU]**

Nothing fires `/api/gmail/sync` off-Vercel. Add a host cron (hourly), using the
`CRON_SECRET` from `.env.production`:

```bash
# crontab -e
0 * * * * curl -fsS -X POST https://crm.italprotein.com/api/gmail/sync -H "Authorization: Bearer <CRON_SECRET>" >/dev/null 2>&1
```

(Or use an external scheduler such as cron-job.org with the same URL + header.)
The Gmail mailbox itself must be connected once from **Admin → Settings →
Integrations → Connect Gmail** by someone with the `ad@italprotein.com` login.

## 9. Back up the database  **[YOU] — do this from day one**

The data lives in the `db_data` volume. Dump it nightly to **off-server** storage
(losing this database would be a serious business event):

```bash
# crontab -e
30 2 * * * docker compose -f ~/ITALPROTEINCRM/docker-compose.prod.yml exec -T db \
  pg_dump -U italprotein_crm italprotein_crm | gzip > ~/backups/crm-$(date +\%F).sql.gz
```

Then copy `~/backups/` to object storage (S3/B2/R2) or another host. Test a
restore before you rely on it.

---

## Updating after a code change

```bash
git branch --show-current   # must be backend-phase-1; on main, `git pull` brings nothing
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Migrations re-apply automatically (only un-applied ones run). Re-run the import
only when the CSV changes — it is idempotent (upsert by company name).

## Object storage for uploaded documents  **[YOU] — before external portal users**

Uploads work with **no configuration**: file bytes are stored in Postgres and are
captured by the nightly `pg_dump`. That is fine for internal use and small
volumes. Before you invite external company accounts — or if you expect large or
numerous files — point the app at an S3-compatible bucket instead:

```bash
# in .env.production  (R2 shown; B2, AWS S3 and MinIO work the same way)
OBJECT_STORAGE_BUCKET=italprotein-crm-docs
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
OBJECT_STORAGE_ACCESS_KEY_ID=...
OBJECT_STORAGE_SECRET_ACCESS_KEY=...
```

Then `up -d --build` again. New uploads go to the bucket; documents already in
the database keep working, so the switch is safe at any time.

> ⚠️ **Create the bucket as PRIVATE with no public access.** The app never mints
> a public or pre-signed URL — every file is streamed through
> `/api/attachments/[id]`, which re-checks the caller's company and the
> document's confidentiality class. A public bucket would bypass all of that.

Remember the bucket is now part of your disaster-recovery surface: the nightly
`pg_dump` no longer contains the file bytes. Enable versioning/lifecycle rules on
the bucket, or add it to your backup job.

## Known follow-ups (not blockers)

- **External portal login + registration provisioning** are built but exercise
  them end-to-end (with two different company accounts) before inviting clients.
- **Amina, the AI assistant**, is visible to authenticated users and uses the
  configured AI provider. For the free Groq tier, set `AI_PROVIDER=groq`,
  `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-20b` on the host;
  live CRM/Drive retrieval remains disabled until its permission-filtered layer ships.
- Harden the container (it already runs as non-root; consider a read-only rootfs
  and dropped capabilities).
