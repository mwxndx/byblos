# Byblos

Byblos is a marketplace for Nairobi social-commerce sellers: it gives each seller a trusted shop link, secure checkout (M‑Pesa via Paystack), escrow-style order fulfilment, delivery tracking, receipts, refunds, seller withdrawals, and a creator affiliate programme. It ships as one codebase to the web and to Android (via Capacitor).

This repository is a two-part project:

- **`/` (root)** — the React + Vite single-page app (web + Android shell).
- **`server/`** — the Node/Express + PostgreSQL API and background workers. It has its own `package.json` and its own [README](server/README.md).

## Tech stack

| Area | Choices |
|------|---------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS, shadcn/ui, TanStack Query v5, React Router v6, react-hook-form + Zod |
| Mobile | Capacitor 8 (Android) |
| Backend | Node.js, Express, PostgreSQL, ioredis, node-cron, node-pg-migrate |
| Payments | Paystack (M‑Pesa STK, card), escrow settlement, seller payouts |
| Media | Cloudinary |
| Tests | Vitest (frontend), Node’s built-in `node:test` (backend), Playwright (E2E) |
| Hosting | Vercel (frontend), Render (API + worker + Postgres + Redis) |

## Prerequisites

- Node.js **22** (CI and local dev run on 22)
- npm 10+
- Docker (for a local PostgreSQL + Redis, via the provided compose files) — or your own Postgres 17 / Redis 7

## Getting started

```bash
# 1. Install dependencies (frontend + backend)
npm install
cd server && npm install && cd ..

# 2. Configure environment (see the sections below)
cp .env.example .env                 # frontend
cp server/.env.example server/.env   # backend

# 3. Start Postgres + Redis for the backend
docker compose up -d

# 4. Run the API (terminal 1)
cd server && npm run migrate && npm run dev   # http://localhost:3002

# 5. Run the web app (terminal 2)
npm run dev                                   # http://localhost:3000
```

The Vite dev server proxies `/api/*` to the backend (`VITE_API_URL`, default `http://localhost:3002`), so the app and API share an origin in development.

### Environment variables

**Frontend (`.env`)**

| Var | Purpose |
|-----|---------|
| `VITE_API_URL` | Backend origin the dev proxy targets (default `http://localhost:3002`) |
| `VITE_PUBLIC_WEB_URL` | Canonical public origin for shareable shop links (default `https://www.byblosafrica.site`) |
| `VITE_GOOGLE_SITE_VERIFICATION` | Optional Search Console verification token |
| `DB_URL` | **Build-time only** — read by `scripts/generate-sitemap.mjs` to add seller-shop URLs to the sitemap. Never hardcode it; set it in the build environment. |

**Backend (`server/.env`)** — see [server/README.md](server/README.md) for the full list (DB, JWT, Paystack, Redis, email, Cloudinary).

## Testing

```bash
npm run test           # frontend unit tests (Vitest)
npm run test:coverage  # frontend tests + coverage gate
npm run test:e2e       # Playwright E2E

# backend (from server/) — needs Postgres + Redis
cd server
docker compose -f docker-compose.test.yml up -d
npm run db:test:setup
npm test               # unit/contract
npm run test:integration
```

CI (`.github/workflows/test.yml`) runs the frontend and backend suites on Node 22 against ephemeral Postgres/Redis service containers, on every push and PR to `main`.

## Production build

```bash
npm run build   # typecheck → generate sitemap → vite build → dist/
```

`generate-sitemap` needs `DB_URL` in the environment to include seller-shop URLs; without it, only the static routes are emitted (the build still succeeds).

## Android (Capacitor)

```bash
npm run mobile:sync      # build web + copy into the Android project
npm run mobile:android   # open the Android project in Android Studio
```

The same React app runs inside the Capacitor WebView; native-only behaviour is gated with `isNativeApp()`.

## Deployment

- **Frontend → Vercel.** `vercel.json` rewrites `/api/*` to the Render API, serves the SPA for all other paths, and 301-redirects the apex host to `www`. Canonical host is `https://www.byblosafrica.site`.
- **Backend → Render.** `server/render.yaml` defines the API web service (migrations run before deploy), a background worker, PostgreSQL, and Redis. A single service can also run everything in-process — see **Process roles** in [server/README.md](server/README.md).

## Project structure

```
.
├── src/                     # Frontend (feature-sliced)
│   ├── app/                 # Router, providers, layouts, bootstrap
│   ├── features/            # Domain features (shop, seller, buyer, creator, admin, payments, …)
│   ├── shared/              # Reusable UI, hooks, utils, types
│   ├── infrastructure/      # Platform adapters (navigation, native bridges)
│   ├── App.tsx / main.tsx   # App entry
│   └── app.css              # Design tokens + global styles
├── public/                  # Static assets, robots.txt, generated sitemap.xml
├── scripts/                 # Build helpers (sitemap generation, …)
├── server/                  # Backend API + workers (own package.json + README)
├── index.html               # SPA shell + base SEO/structured data
├── vercel.json              # Frontend hosting (rewrites, redirects)
└── vite.config.ts           # Vite + Vitest config
```

## SEO notes

The app is a client-rendered SPA served from a single `index.html`. Per-route metadata and canonicals are set at runtime by `SEOHead` (`react-helmet-async`); the static `index.html` deliberately carries **no** hardcoded canonical so deep pages don’t all inherit the homepage’s. Only routes that actually exist belong in the sitemap and in `robots.txt`.

## Support

Open an issue, or contact the team at `bybloshqke@zohomail.com`.
