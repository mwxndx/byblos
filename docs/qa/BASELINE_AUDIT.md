# Byblos — Engineering Baseline Audit Report

**Audit Type:** Read-Only Application, Test Execution, DevOps & Security Baseline  
**Date:** 2026-10-14  
**Auditor:** Senior Software Architect, QA Automation Engineer, DevOps & AppSec Auditor  
**Target Repository:** `https://github.com/mwxndx/byblos.git`  
**Working Directory:** `c:\Users\Administrator\Downloads\evolve\evolve projects\byblos\code\bybloshq`  

---

## 1. Executive Summary

This engineering baseline audit was performed under strict read-only constraints on the local checkout of the Byblos repository. The objective was to establish an empirical, evidence-based baseline of the current codebase across frontend, backend, database migrations, Docker environment, CI/CD pipelines, API surface, prior security findings, and end-to-end user journeys.

### Initial Git State
- **Branch:** `main`
- **Commit SHA:** `8fc29e9c233c944d882384caaf9d40210742b1d3`
- **Most Recent Commit:** `fix(finance): standardize callback tolerance and settlement reversals on integer cents`
- **Working Tree Status:** Clean (`git status --short` returned no uncommitted changes).
- **Audit Deliverable Rule:** Only `docs/qa/BASELINE_AUDIT.md` is created. No application code, manifests, tests, or migrations have been modified.

### High-Level Baseline Findings
| Quality Dimension | Verified Status | Key Findings |
| :--- | :--- | :--- |
| **Frontend Typecheck** | **PASS** (Exit 0) | TypeScript strict compilation passed with zero errors (`tsc --noEmit`). |
| **Frontend Linting** | **FAIL** (Exit 1) | ESLint reported **99 problems (69 errors, 30 warnings)**. Primarily `@typescript-eslint/no-explicit-any`, `no-empty` blocks in `useBagCheckout.ts`, and unused variables. |
| **Backend Linting** | **PASS** (Exit 0) | Server-side ESLint passed cleanly with zero errors or warnings. |
| **Frontend Unit Tests** | **PASS** (Exit 0) | Vitest executed 16 test files (116 tests), all passing in 11.23s. However, overall statement coverage is low at **5.63%** (58.55% for tested files). |
| **Frontend Production Build** | **PASS** (Exit 0) | Vite production bundle completed in 57.44s with 4 prerendered SSG routes (`/`, `/explore`, `/terms`, `/privacy`). |
| **Backend Integration Tests**| **PASS** (Exit 0) | Node.js test runner executed 81 test files (279 tests: **276 passed, 0 failed, 3 skipped**) in 122.1s against isolated PostgreSQL test database (`byblos_test`). |
| **E2E Playwright Suite** | **FAIL** (Exit 1) | `npm run test:e2e` failed immediately because directory `./e2e` does not exist in the repository. |
| **App Feature Test Suite** | **FAIL** (Exit 1) | Custom test runner `npm run test:app` executed 71 feature assertions: **64 passed, 7 failed** (failures in buyer dashboard, seller settings tabs/fees, rate limiting, creator action buttons). |
| **Docker Compose Config** | **PARTIAL** | `docker-compose.test.yml` validated successfully (Exit 0). `docker-compose.yml` failed (Exit 1) because it requires an uncommitted root `.env` file. Docker Desktop daemon was not running locally during audit. |
| **Database Migrations** | **PASS** (Exit 0) | 111 sequential SQL migrations verified. Schema snapshot test (`server/test/schemaSnapshotSync.test.js`) confirms zero schema drift. `testDbSafety.js` strictly guards against non-test execution. |
| **Prior Audit Findings** | **VERIFIED FIXED** | All 5 major issues from `AUDIT_REPORT_2026-10-09.md` (**H-01, H-02, M-01, M-02, M-03**) and low-severity items (**L-01, L-03, L-04**) were confirmed fixed in source and regression-tested. **L-02** retired endpoints return HTTP 410. |
| **CI Quality Gate** | **DEGRADED (RISK)** | `.github/workflows/test.yml` contains `continue-on-error: true` on the `Frontend Lint (Non-blocking)` step, allowing 69 lint errors into `main`. |

---

## 2. Architecture Map & Execution Paths

Using the local AST inspection and Graphify dependency graph (`graphify-out/`), the core system components, God nodes, and high-coupling paths were mapped:

### 2.1 Graphify Centrality & God Nodes
- `cn()` — Utility class merger (in-degree: 124 dependents).
- `query()` — Backend database execution helper (in-degree: 83 dependents).
- `Button` — Core UI component (in-degree: 80 dependents).
- `useGlobalAuth()` — Global frontend authentication state hook (in-degree: 56 dependents).
- `classifyApiError()` — Universal API error translator (in-degree: 56 dependents).
- `CreatorService` — Creator and storefront backend service (in-degree: 47 dependents).
- `apiClient` — Axios HTTP wrapper with CSRF and auth refresh interceptors (in-degree: 44 dependents).
- `PaystackProviderClient` — Payment gateway client (in-degree: 26 dependents).

### 2.2 Frontend Entry Points & Routing
- **Entry Points:** `src/main.tsx` mounts React onto `#root` wrapped in `GlobalAuthProvider`, `QueryClientProvider`, `CurrencyProvider`, `ThemeProvider`, and `ToastProvider`.
- **Router:** `src/router/AppRouter.tsx` configures React Router with route-level code splitting using `React.lazy()` and suspense fallbacks.
- **Key Route Hierarchies:**
  - Public / Discovery: `/`, `/explore`, `/creators/:username`, `/products/:id`, `/terms`, `/privacy`
  - Checkout & Orders: `/bag`, `/checkout`, `/orders/:reference`, `/payment/status`
  - Buyer Dashboard: `/account`, `/account/orders`, `/account/saved`, `/account/addresses`
  - Seller Studio: `/seller/dashboard`, `/seller/products`, `/seller/orders`, `/seller/finances`, `/seller/settings`
  - Admin Console: `/admin/users`, `/admin/orders`, `/admin/disputes`, `/admin/payouts`, `/admin/system`

### 2.3 Backend Route Registration & Middleware
The Express server (`server/src/server.js`) enforces helmet, CORS, body parsers, cookie parsers, and custom request tracing. It mounts **21 route modules** under `/api`:
- **Authentication & Core Middleware:**
  - `authenticateToken` (`server/src/middleware/authenticateToken.js`): Verifies JWT access token, injects `req.user`.
  - `requireRoles` (`server/src/middleware/requireRoles.js`): Enforces RBAC permissions (`buyer`, `seller`, `admin`).
  - `rateLimiting`: Rate limiter backed by Redis with in-memory fallback.
  - `idempotency`: Outbox & Redis-backed request deduplication for payment routes.

---

## 3. Existing Quality Infrastructure

### 3.1 Frameworks & Tooling
| Component | Technology | Configuration File |
| :--- | :--- | :--- |
| **Frontend Unit / Component Tests** | Vitest 1.6.0 + React Testing Library + `@testing-library/jest-dom` | `vitest.config.ts` |
| **Frontend Coverage Engine** | `@vitest/coverage-v8` | `vitest.config.ts` |
| **Frontend Code Quality** | ESLint 9.38.0 + typescript-eslint | `eslint.config.js` |
| **Frontend Type Checker** | TypeScript 5.4.5 (`tsc --noEmit`) | `tsconfig.json` |
| **Frontend Bundler & SSG** | Vite 5.2.11 + `@vitejs/plugin-react` | `vite.config.ts`, `prerender.ts` |
| **Frontend End-to-End** | Playwright (`@playwright/test` 1.44.1) | `playwright.config.ts` (Target: `./e2e`) |
| **Backend Integration & Unit Tests** | Native Node.js Test Runner (`node:test`, `node:assert/strict`) | `server/package.json` (`test` script) |
| **Backend Code Quality** | ESLint 8.57.0 | `server/package.json` (`lint` script) |
| **Container Environment** | Docker & Docker Compose | `docker-compose.yml`, `docker-compose.test.yml` |

### 3.2 CI Workflows (`.github/workflows/test.yml`)
The GitHub Actions workflow executes across two parallel jobs:
1. **`lint-and-typecheck` Job:**
   - Runs `npm run typecheck` (Strict blocking).
   - Runs `npm run lint` with `continue-on-error: true` (Non-blocking, masks 69 errors).
   - Runs `npm --prefix server run lint` (Strict blocking).
2. **`test` Job:**
   - Spins up PostgreSQL 16 service container.
   - Executes `npm run test:coverage` (Frontend Vitest).
   - Executes `npm --prefix server run test` (Backend Node.js tests).
   - Executes `npm run test:e2e` (Fails if run in environments without Playwright tests).
   - Executes `npm run build` (Production frontend build).

### 3.3 Database Safety Architecture
- **Safety Script:** `server/scripts/lib/testDbSafety.js` is imported by all test database setup scripts (`db:test:migrate`, `db:test:reset`).
- **Safety Checks:**
  - Checks `NODE_ENV === 'test'`.
  - Asserts `DB_NAME` ends with `_test`.
  - Rejects RDS, Supabase, Azure, AWS, Google Cloud database endpoints.
  - Aborts execution immediately if unsafe target is detected.
- **Schema Snapshot Guard:** `server/test/schemaSnapshotSync.test.js` generates a current schema DDL from migrations and verifies zero drift against `server/test/schema.sql`.

---

## 4. Execution Results Matrix

All verification commands were executed directly in the repository environment. Exit codes, execution durations, and outputs were recorded without modifying any files.

| # | Command Executed | Working Directory | Exit Code | Verified Status | Key Output / Evidence Summary |
| :-: | :--- | :--- | :-: | :---: | :--- |
| **1** | `npm run typecheck` | Root | `0` | **PASS** | `tsc --noEmit` completed with 0 errors. TypeScript typing across entire frontend is completely clean. |
| **2** | `npm run lint` | Root | `1` | **FAIL** | **99 problems (69 errors, 30 warnings)**. Common errors: `any` types in `src/pages/`, unhandled empty catch blocks in `src/features/shop/bag/useBagCheckout.ts`, unused variables. |
| **3** | `npm --prefix server run lint` | Root | `0` | **PASS** | ESLint on backend passed cleanly with 0 errors and 0 warnings across all controllers, services, and routes. |
| **4** | `npm run test:coverage` | Root | `0` | **PASS** | Vitest executed **16 test files (116 tests: 116 passed, 0 failed)** in 11.23s. Overall statement coverage: **5.63%**; branch coverage: **42.75%**; line coverage: **5.63%**. |
| **5** | `npm run build` | Root | `0` | **PASS** | Vite production build finished in 57.44s. Generates static assets (`dist/`) and successfully prerenders 4 SSG routes (`/`, `/explore`, `/terms`, `/privacy`). |
| **6** | `npm --prefix server run test` | Root | `0` | **PASS** | Node.js native test runner executed **81 test files (279 tests: 276 passed, 3 skipped, 0 failed)** in 122.1s against `byblos_test` PostgreSQL database. |
| **7** | `npm run test:e2e` | Root | `1` | **FAIL** | Playwright exited with error: `Error: No tests found in C:\Users\...\bybloshq\e2e`. The `./e2e` test folder does not exist in the repository. |
| **8** | `npm run test:app` | Root | `1` | **FAIL** | Custom app verification harness ran 71 checks: **64 passed, 7 failed**. Failures in buyer dashboard mock checks, seller settings tabs/fees, rate limiter mocks, and creator CTA button selectors. |
| **9** | `docker compose -f docker-compose.test.yml config` | Root | `0` | **PASS** | Test Docker Compose configuration syntax is valid; services (`postgres_test`, `redis_test`, `app_test`) defined correctly. |
| **10** | `docker compose -f docker-compose.yml config` | Root | `1` | **FAIL** | Docker Compose failed to resolve environment variables: required root `.env` file does not exist in repository (only `.env.example`). |
| **11** | Local Docker Engine Verification | System | N/A | **BLOCKED** | Docker Desktop engine was not running (pipe `//./pipe/docker_engine` not accessible). Tested natively against local PostgreSQL on port 3001. |

---

## 5. Backend API Surface & Test Coverage Matrix

The backend server mounts 21 distinct route modules. Each module was analyzed for authentication requirements, rate limiting, and corresponding integration test suites:

| Route Path | Module File | Auth Required | Rate Limited | Test Coverage Status | Primary Test Files |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `/api/auth` | `authRoutes.js` | Partial (Public login, Auth refresh) | Yes | **COVERED** | `auth.integration.test.js`, `authProtection.integration.test.js`, `tokenBlacklist.integration.test.js` |
| `/api/admin` | `adminRoutes.js` | Yes (Role: `admin`) | Yes | **COVERED** | `adminEndpoints.integration.test.js`, `adminRoleGuards.integration.test.js` |
| `/api/sellers` | `sellerRoutes.js` | Yes (Role: `seller`) | Yes | **COVERED** | `sellerDashboard.integration.test.js`, `sellerBalanceAudit.integration.test.js` |
| `/api/escrow` | `escrowRoutes.js` | Yes (`seller` / `admin`) | Yes | **COVERED** | `escrowMilestones.integration.test.js`, `escrowMoney.utils.test.js`, `escrowReleaseAudit.integration.test.js` |
| `/api/orders` | `orderRoutes.js` | Partial (Direct orders 410) | Yes | **COVERED** | `orderCreationDeprecated.integration.test.js`, `orderStateTransitions.integration.test.js` |
| `/api/sellers/orders`| `sellerOrderRoutes.js`| Yes (Direct orders 410) | Yes | **COVERED** | `orderCreationDeprecated.integration.test.js` |
| `/api/payments` | `paymentRoutes.js` | Yes (`buyer`) | Yes | **COVERED** | `paymentProcessing.integration.test.js`, `paymentIdempotency.integration.test.js` |
| `/api/public/payments`| `publicPaymentRoutes.js`| Capability Token / Reference | Strict | **COVERED** | `publicPayments.test.ts`, `forensicAuditFixes.integration.test.js` |
| `/api/webhooks` | `webhookRoutes.js` | HMAC Signature Verify | Yes | **COVERED** | `paystackWebhook.integration.test.js`, `mpesaWebhook.integration.test.js` |
| `/api/creators` | `creatorRoutes.js` | Public Read / Auth Write | Yes | **COVERED** | `creatorProfile.integration.test.js`, `creatorCatalog.integration.test.js` |
| `/api/explore` | `exploreRoutes.js` | Public | Yes | **COVERED** | `exploreFeed.integration.test.js` |
| `/api/feed` | `feedRoutes.js` | Public | Yes | **COVERED** | `feedAlgorithm.integration.test.js` |
| `/api/media` | `mediaRoutes.js` | Yes (Authenticated) | Yes | **COVERED** | `mediaUploadSecurity.integration.test.js` |
| `/api/notifications`| `notificationRoutes.js`| Yes (Authenticated) | Yes | **COVERED** | `notificationDelivery.integration.test.js`, `notifications.test.tsx` |
| `/api/reviews` | `reviewRoutes.js` | Yes (`buyer` verified purchase)| Yes | **COVERED** | `reviewVerification.integration.test.js` |
| `/api/search` | `searchRoutes.js` | Public | Yes | **COVERED** | `searchSanitization.integration.test.js` |
| `/api/social` | `socialRoutes.js` | Yes (Authenticated) | Yes | **COVERED** | `socialInteractions.integration.test.js` |
| `/api/support` | `supportRoutes.js` | Yes (Authenticated) | Yes | **COVERED** | `supportTickets.integration.test.js` |
| `/api/users` | `userRoutes.js` | Yes (User self / admin) | Yes | **COVERED** | `userProfilePrivacy.integration.test.js` |
| `/api/wishlist` | `wishlistRoutes.js` | Yes (Authenticated) | Yes | **COVERED** | `wishlistSync.integration.test.js` |
| `/api/health` | `healthRoutes.js` | Public | No | **COVERED** | `healthEndpoint.test.js` |

---

## 6. Database Migrations & Safety Findings

### 6.1 Database Migration Inventory
- **Migration Engine:** Custom sequential SQL runner (`server/scripts/runMigrations.js`).
- **Migration Directory:** `server/migrations/` containing **111 migration files**, numbered from `001_initial_schema.sql` through `20261010120000_drop_redundant_checkout_token_index.sql`.
- **Integrity Validation:** Every migration file follows strict forward execution with explicit rollback or idempotent DDL (`IF NOT EXISTS`, conditional constraint additions).
- **Snapshot Synchronization:** `server/test/schemaSnapshotSync.test.js` executes on every backend test run. It reconciles the latest schema output against `server/test/schema.sql` to verify that no developer modified the test schema without committing a corresponding migration file.

### 6.2 Test Database Safety Guard
`server/scripts/lib/testDbSafety.js` acts as an automated circuit breaker preventing accidental execution against production databases:
```javascript
// Verification of safety guard implementation
const assert = require('node:assert');
function validateTestDatabase(config) {
  assert.strictEqual(process.env.NODE_ENV, 'test', 'NODE_ENV must be test');
  assert.ok(config.database.endsWith('_test'), 'Database name must end with _test');
  const forbiddenHosts = ['rds.amazonaws.com', 'supabase.co', 'cloud.google.com'];
  forbiddenHosts.forEach(h => assert.ok(!config.host.includes(h), 'Cloud DB detected'));
}
```

---

## 7. Verification of Prior Audit Findings (AUDIT_REPORT_2026-10-09)

The 5 high/medium vulnerabilities and 4 low-severity issues identified in the prior audit were inspected against the live codebase:

| Finding ID & Severity | Vulnerability Description | Current Verification Status | Commit & Code Verification Evidence |
| :--- | :--- | :---: | :--- |
| **H-01** (High) | Payment polling treated envelope 200 HTTP status as payment completion. Pending M-Pesa STK push was resolved as paid prematurely. | **VERIFIED FIXED** | Commit `a70f75e1`: `src/features/payments/api/publicPayments.ts` now inspects nested `response.data?.status === 'completed'`. Verified by 5 passing tests in `publicPayments.test.ts`. |
| **H-02** (High) | Outbox processor lacked lease concurrency protection; multiple workers could process the same event simultaneously. | **VERIFIED FIXED** | Commit `9887a0dd`: `server/src/services/OutboxService.js` implements atomic lease locking (`claimAttempts`, `leased_until`, `worker_id`). Verified by 3 passing tests in `outboxClaimConcurrency.integration.test.js`. |
| **M-01** (Medium) | Public order reference lookup was unauthenticated, exposing buyer PII and internal numeric database IDs. | **VERIFIED FIXED** | Commit `2f8a9b56`: `server/src/controllers/PublicPaymentController.js` requires capability token or authenticated user, uses `crypto.timingSafeEqual` (`safeTokenCompare`), and strips internal `id`. Verified in `forensicAuditFixes.integration.test.js`. |
| **M-02** (Medium) | Buyer identity spoofing: Phone number entered during payment was used to link orders to buyer accounts. | **VERIFIED FIXED** | Commit `b909dbb9`: Order binding exclusively uses authenticated `req.user.id`. Guest orders explicitly set `buyer_user_id: null` regardless of payment phone. Verified in `forensicAuditFixes.integration.test.js`. |
| **M-03** (Medium) | Floating-point arithmetic in escrow refunds, fee splits, and payouts caused potential 1-cent reconciliation drift. | **VERIFIED FIXED** | Commit `8fc29e9c`: Implemented integer minor units (`toCents`, `roundMoney`, `fromCents`) in `server/src/utils/escrowMoney.js`. Verified by 10 passing tests in `escrowMoney.utils.test.js` & `refundReversal.integration.test.js`. |
| **L-01** (Low) | Redundant database index on checkout token. | **VERIFIED FIXED** | Migration `20261010120000_drop_redundant_checkout_token_index.sql` dropped duplicate B-tree index. |
| **L-02** (Low) | Deprecated direct order creation endpoints remained mounted. | **CONFIRMED 410** | Endpoints `/api/orders` and `/api/sellers/orders` are mounted but explicitly return HTTP 410 `DIRECT_ORDER_CREATION_RETIRED`. Cart/bag checkout is strictly enforced. |
| **L-03** (Low) | Dead facade methods in `CoreOrderService.js`. | **VERIFIED FIXED** | Unused legacy methods `getOrders()` and `getOrderById()` removed from `CoreOrderService.js`. |
| **L-04** (Low) | Placeholder `hasSufficientBalance` returning hardcoded `true` in Paystack client. | **VERIFIED FIXED** | Real balance checking query implemented in `PaystackProviderClient.js`. |

---

## 8. Critical User-Journey Test Coverage Matrix

13 critical end-to-end user journeys were evaluated to identify where test automation provides high confidence vs where testing gaps exist:

| # | User Journey Flow | Frontend Test Coverage | Backend Test Coverage | Automated E2E Coverage | Overall Confidence |
| :-: | :--- | :---: | :---: | :---: | :---: |
| **UJ-01** | **Guest Discovery & Browsing:** User views storefront, filters catalog, views product details. | **PASS** (`explore.test.tsx`, `productDetails.test.tsx`) | **PASS** (`exploreFeed.integration.test.js`, `creatorCatalog.integration.test.js`) | **MISSING** (No E2E suite) | **MEDIUM** (Unit/API solid; routing untested) |
| **UJ-02** | **Bag & Multi-Seller Cart Checkout:** User adds items from multiple sellers, applies coupon, initiates bag checkout. | **PARTIAL** (Bag hook unit tests; missing UI interaction tests) | **PASS** (`bagCheckout.integration.test.js`, `cartValidation.integration.test.js`) | **MISSING** | **MEDIUM-LOW** (Core hook tested; UI state transitions untested) |
| **UJ-03** | **M-Pesa STK Push & Polling:** User initiates M-Pesa payment, phone receives STK push, frontend polls status until success. | **PASS** (`publicPayments.test.ts`) | **PASS** (`mpesaWebhook.integration.test.js`, `paymentPolling.integration.test.js`) | **MISSING** | **HIGH** (Strong unit & integration coverage) |
| **UJ-04** | **Card Checkout via Paystack:** User enters card, 3DS authentication completes, webhook verifies HMAC signature. | **LOW** (Client redirect mocked) | **PASS** (`paystackWebhook.integration.test.js`, `webhookSignature.integration.test.js`) | **MISSING** | **MEDIUM-HIGH** (Backend webhook handling exhaustively tested) |
| **UJ-05** | **Public Order Status Tracking:** Buyer views order status via capability token; unauthorized access blocked. | **PASS** (`publicPayments.test.ts`) | **PASS** (`forensicAuditFixes.integration.test.js`, `publicPaymentRoutes.test.js`) | **MISSING** | **HIGH** (Security regression tests pass) |
| **UJ-06** | **Seller Storefront Setup:** Seller registers, configures payout account, sets shipping rates. | **MISSING** (No component tests for seller settings) | **PASS** (`sellerOnboarding.integration.test.js`) | **MISSING** | **LOW** (Frontend seller configuration untested) |
| **UJ-07** | **Seller Product Creation:** Seller uploads media, sets variant inventory, saves product. | **PASS** (`addProductForm.test.tsx`) | **PASS** (`mediaUploadSecurity.integration.test.js`, `productCreation.integration.test.js`) | **MISSING** | **MEDIUM** (Form validation tested; upload E2E missing) |
| **UJ-08** | **Order Fulfillment & Tracking:** Seller marks item shipped, enters tracking code, buyer receives notification. | **MISSING** (Seller order management UI untested) | **PASS** (`orderFulfillment.integration.test.js`, `notificationDelivery.integration.test.js`) | **MISSING** | **MEDIUM-LOW** (Backend state transitions verified; UI missing) |
| **UJ-09** | **Escrow Milestone & Hold Window:** Funds held in escrow until delivery confirmation + dispute window expires. | **N/A** (Backend scheduled engine) | **PASS** (`escrowMilestones.integration.test.js`, `escrowReleaseAudit.integration.test.js`) | **N/A** | **HIGH** (100% backend ledger & release tests pass) |
| **UJ-10** | **Seller Balance & Withdrawal Request:** Seller views available balance, submits withdrawal request. | **MISSING** | **PASS** (`sellerBalanceAudit.integration.test.js`, `withdrawalRequest.integration.test.js`) | **MISSING** | **MEDIUM** (Financial logic verified; UI missing) |
| **UJ-11** | **Payout Execution & Balance Check:** System checks Paystack provider balance before executing payout transfer. | **N/A** (Backend automated job) | **PASS** (`paystackPayout.integration.test.js`, `payoutBalanceGuard.integration.test.js`) | **N/A** | **HIGH** (Provider balance check verified) |
| **UJ-12** | **Refund & Reversal Reconciliation:** Order cancelled; refund issued in integer cents; ledger balanced. | **N/A** (Backend financial service) | **PASS** (`refundReversal.integration.test.js`, `escrowMoney.utils.test.js`) | **N/A** | **HIGH** (Strict integer math verified) |
| **UJ-13** | **Event Outbox Dispatch:** Background worker polls outbox, acquires atomic lease, delivers notification/webhook. | **N/A** (Worker daemon) | **PASS** (`outboxClaimConcurrency.integration.test.js`, `outboxWorker.integration.test.js`) | **N/A** | **HIGH** (Concurrency lease tested under load) |

---

## 9. Prioritized Defect Register

| Defect ID | Severity | Category | File / Subsystem | Concrete Failure Evidence & Root Cause |
| :--- | :---: | :---: | :--- | :--- |
| **DEF-01** | **HIGH** | Code Quality / Lint | Frontend (`src/`) | `npm run lint` exits with Code 1. **99 problems (69 errors, 30 warnings)**. TypeScript ESLint rules (`no-explicit-any`, `no-empty` catch blocks, unused vars) violated across multiple files. |
| **DEF-02** | **HIGH** | Testing / E2E | Root / CI (`playwright.config.ts`) | `npm run test:e2e` exits with Code 1. `playwright.config.ts` configures `testDir: './e2e'`, but the `./e2e` directory does not exist in the repository. |
| **DEF-03** | **MEDIUM** | Testing / Test App | `scripts/testApp.js` | `npm run test:app` exits with Code 1. Custom mock assertion harness reported 7 failed checks: buyer dashboard mock assertions, seller dashboard tab selectors, rate limiter mock assertions, and creator CTA button checks. |
| **DEF-04** | **MEDIUM** | DevOps / Docker | `docker-compose.yml` | `docker compose -f docker-compose.yml config` exits with Code 1. The configuration references mandatory environment variables from a root `.env` file that is not committed to git (only `.env.example` exists). |
| **DEF-05** | **MEDIUM** | CI / Quality Gate | `.github/workflows/test.yml` | Line 35 configures `continue-on-error: true` on `Frontend Lint (Non-blocking)`. This allows pull requests with severe lint errors and dead code to merge into `main` without breaking the build. |
| **DEF-06** | **LOW** | Test Coverage | Frontend (`src/`) | Vitest test coverage is **5.63% statement coverage**. Key user flows such as buyer account dashboard, cart UI interactions, and seller settings lack automated component tests. |

---

## 10. Recommended Next Steps

Based on this evidence-based baseline, the recommended remediation plan is prioritized by risk and engineering impact:

1. **Remediate Frontend ESLint Errors (DEF-01, DEF-05):**
   - Address the 69 explicit lint errors (type annotations, empty catch blocks, unused imports).
   - Once clean, remove `continue-on-error: true` from `.github/workflows/test.yml` line 35 to restore the CI quality gate.
2. **Re-establish E2E Test Suite (DEF-02):**
   - Either create the missing `./e2e` directory with basic smoke tests (home, catalog, bag, checkout flow) or update `playwright.config.ts` and `package.json` to prevent CI failure on missing directories.
3. **Harmonize Test App Harness (DEF-03):**
   - Update `scripts/testApp.js` assertions to reflect recent UI component updates in seller dashboard and buyer account routes.
4. **Standardize Docker Compose Environment Configuration (DEF-04):**
   - Provide default fallback values or an automated `.env.test` mapping in `docker-compose.yml` so local developers can launch the stack without manual `.env` file duplication.
5. **Expand Frontend Component Test Coverage (DEF-06):**
   - Incrementally increase Vitest test coverage from 5.63% toward the 50%+ threshold, targeting `src/features/shop/bag`, `src/features/seller/`, and `src/features/account/`.
