# Byblos API

The backend for the [Byblos](../README.md) marketplace: a Node.js + Express + PostgreSQL service (ESM, `"type": "module"`, entry `src/index.js`) that handles authentication, seller/creator/buyer accounts, products, orders and escrow-style fulfilment, Paystack payments (M‑Pesa STK + card), settlement and seller withdrawals, the creator affiliate programme, delivery tracking, and the scheduled jobs that reconcile all of it.

## Tech stack

- **Runtime:** Node.js 22, Express
- **Database:** PostgreSQL 17, accessed via `pg`; migrations with `node-pg-migrate` (forward-only `.sql` files)
- **Cache/queues:** Redis via `ioredis`
- **Scheduling:** `node-cron`
- **Payments:** Paystack (payments + payouts)
- **Media/email:** Cloudinary, Resend/Nodemailer
- **Auth:** JWT access + refresh tokens, `bcryptjs`
- **Tests:** Node’s built-in `node:test` runner

## Prerequisites

- Node.js **22**
- PostgreSQL 17 and Redis 7 (the repo’s Docker compose files provide both)

## Quick start

```bash
cd server
npm install
cp .env.example .env            # then fill in the values below

# start Postgres + Redis (from the repo root compose file)
docker compose -f ../docker-compose.yml up -d

npm run migrate                 # apply all migrations
npm run dev                     # nodemon, http://localhost:3002
```

The API is served under `/api`. In development the web app proxies `/api/*` here, so you normally hit it through `http://localhost:3000`.

### Environment variables

Fill `server/.env` (see `.env.example` for the complete list). The essentials:

| Group | Variables |
|-------|-----------|
| Server | `NODE_ENV`, `PORT` (default 3002), `APP_NAME`, `BYBLOS_PROCESS_ROLE` |
| Database | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` |
| Redis | `REDIS_URL` |
| Auth | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` |
| CORS/URLs | `FRONTEND_URL`, `BACKEND_URL`, `ALLOWED_ORIGINS` |
| Payments | `PAYMENT_PROVIDER`, `PAYOUT_PROVIDER`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_BASE_URL` |
| Email | `EMAIL_FROM_EMAIL`, `EMAIL_FROM_NAME` |
| Cron toggles | `ENABLE_PAYMENT_CRON`, `ENABLE_PAYOUT_RECONCILIATION`, `ENABLE_SETTLEMENT_PROMOTION_CRON`, `ENABLE_ORDER_DEADLINE_CRON`, `ENABLE_CLEANUP_CRON`, `ENABLE_REFERRAL_CRON` (all default on) |

Never commit real secrets. Any credential that lands in the repo (or its git history) must be rotated.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start with nodemon + `dotenv/config` |
| `npm start` | Start the API (`src/index.js`) |
| `npm run start:worker` | Start a standalone worker process (`src/worker.js`) |
| `npm run migrate` | Apply pending migrations |
| `npm run migrate:create <name>` | Scaffold a new migration |
| `npm run seed` | Seed development data |
| `npm test` | Unit/contract tests (`test/*.test.js`) |
| `npm run test:integration` | DB-backed integration tests (`test/**/*.integration.test.js`) |
| `npm run test:all` | Both suites |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Database migrations

Migrations are **forward-only** `.sql` files applied by `node-pg-migrate`; there are no down migrations. Roll a schema change forward with a new migration — never edit an applied one. Because there is no automated rollback, recovery from a bad migration is a point-in-time database restore followed by a redeploy, so stage destructive changes carefully.

```bash
npm run migrate:create add_widgets_table   # create server/migrations/<ts>_add_widgets_table.sql
npm run migrate                             # apply
```

## Testing

Tests use `node:test` and need a disposable Postgres + Redis. The `db:test:*` scripts are guarded so they can only ever touch a database whose name contains `test`.

```bash
cd server
npm run db:test:up        # Postgres + Redis via ../docker-compose.test.yml
npm run db:test:setup     # create the test DB and load test/schema.sql
npm test                  # unit/contract
npm run test:integration  # integration
npm run db:test:down      # tear down
```

`test/schema.sql` is a committed snapshot of the full schema (the incremental migrations can’t build from an empty DB in CI), kept in sync by `schemaSnapshotSync.test.js`. CI runs the same flow on Node 22 against service containers.

## Process roles & background jobs

The server is a single Express app (`src/index.js`) that runs in one of two roles, set by `BYBLOS_PROCESS_ROLE`:

| `BYBLOS_PROCESS_ROLE` | What runs |
|---|---|
| unset, or `all` (**default**) | API routes **and** every cron/background worker, in one process |
| `api` or `web` | API routes only — crons/workers are skipped (`application/bootstrap/index.js`); run them separately via `src/worker.js` |

**In production the single web service runs with role `all`**, so one process serves the API and every job below. `server/render.yaml` also describes a two-service split (API + dedicated worker) as a possible target architecture; it is not required for the current single-service deployment. If you scale the web service beyond one instance, first set `BYBLOS_PROCESS_ROLE=api` on it and run `src/worker.js` as its own service — otherwise every instance starts its own copy of every cron.

Because crons live in the web process, a free-tier instance that sleeps also pauses its schedules; an uptime pinger keeps it warm. Each job is individually toggleable via its `ENABLE_*_CRON` variable (see `application/bootstrap/cron.js`):

- **Payment processing** (`ENABLE_PAYMENT_CRON`) — reconciles pending payments with Paystack (every ~5 min)
- **Reconciliation engine** — self-healing pass over payout/withdrawal state
- **Fulfilment worker** — processes the order-fulfilment queue
- **Payout reconciliation** (`ENABLE_PAYOUT_RECONCILIATION`)
- **Settlement promotion** (`ENABLE_SETTLEMENT_PROMOTION_CRON`) — promotes Paystack-settled earnings into withdrawable balance
- **Order deadline checks** (`ENABLE_ORDER_DEADLINE_CRON`) — custom-production SLA reminders/refunds
- **Cleanup** (`ENABLE_CLEANUP_CRON`) — daily housekeeping
- **Referral rewards** (`ENABLE_REFERRAL_CRON`) — periodic referral payouts

## Deployment

Deployed on **Render** (`server/render.yaml`): a web service with `preDeployCommand: npm run migrate` and `startCommand: npm start`, plus managed PostgreSQL and Redis. Migrations run before each deploy; keep them forward-only and backwards-compatible so a deploy can roll without downtime.

## Security notes

- Enforce HTTPS; keep `.env` out of version control; rotate any exposed secret.
- Auth endpoints are rate-limited (IP- and account-keyed); parameterise every query; verify Paystack webhook signatures before trusting payloads.
- Money paths use row locks (`FOR UPDATE`), `ON CONFLICT` idempotency, `NUMERIC(15,2)` columns, and non-negative check constraints — preserve these when changing them.
