# Migration conventions

These rules exist because three real hazards were found in already-applied
migrations during a production audit. The historical instances are inert (see
"Why the old ones are harmless" below); these conventions stop the patterns from
recurring, and `server/test/migrationHygiene.test.js` **enforces the mechanical
ones automatically** for every migration authored after 2026-09-13.

Migrations run through `server/scripts/migrate.js` (node-pg-migrate, `checkOrder:
true`). **Each `.sql` migration runs inside a single transaction.** A fresh/empty
database is NOT built by replaying migrations — it is bootstrapped from
`server/test/schema.sql` (the single source of truth), which also records
`pgmigrations` 1..N so only migrations newer than the snapshot ever run. Keep
`schema.sql` in lockstep with every migration (see `schemaSnapshotSync.test.js`).

## 1. Never ride a data backfill inside a schema (DDL) migration

A bulk `UPDATE`/`INSERT ... SELECT` over a large table, run in the same
transaction as `CREATE TABLE` / `ADD COLUMN`, holds row locks and extends the
deploy for the whole scan — and if it fails, the schema change rolls back too.

- Put schema changes in one migration and the backfill in a **separate** one.
- **Batch** large backfills (`WHERE id BETWEEN $1 AND $2`, loop) or run them
  out-of-band rather than as one statement over the whole table.
- Make backfills idempotent (`WHERE col IS NULL`) so a re-run is safe.

_Example of what not to do:_ `20260419000000_master_migration.sql` backfilled
`product_orders` location/service columns inside its DDL transaction.

## 2. Build indexes on hot/large tables without locking writes

`CREATE INDEX` (non-concurrent) takes a lock that blocks writes for the whole
build. On a large `product_orders` / `payments` / `order_items` /
`withdrawal_requests`, that is deploy-time downtime. But `CREATE INDEX
CONCURRENTLY` **cannot run inside a transaction**, and every `.sql` migration
here runs in one — so a plain `.sql` migration cannot use it.

For an index on a hot table, do one of:

- Build it **out-of-band** with `CREATE INDEX CONCURRENTLY` during a low-traffic
  window, before/after the deploy, then add a plain `CREATE INDEX IF NOT EXISTS`
  to the migration + `schema.sql` so the catalog agrees (the concurrent build
  makes the migration's build a no-op); or
- Write a **JavaScript** migration that sets `export const noTransaction = true`
  and runs `CREATE INDEX CONCURRENTLY IF NOT EXISTS`.

Small/cold tables can use a normal `CREATE INDEX` in a `.sql` migration.

## 3. `schema.sql` is the only source of truth for table shape

Do not re-declare an existing table (`CREATE TABLE [IF NOT EXISTS] <existing>`)
inside a later migration. A second copy silently drifts from the real schema.

_Example:_ `20260419000000_master_migration.sql` re-declares core tables with
types that no longer match `schema.sql` (e.g. `sellers.total_sales INTEGER` vs
`numeric(15,2)`). It is a landmine that only stays harmless because that file is
never replayed.

## Opt-out

If a rule genuinely does not apply (e.g. a tiny backfill on a table that is known
to be small), add a single-line marker in the migration explaining why:

```
-- migration-hygiene:allow-backfill-with-ddl reason: <one line>
-- migration-hygiene:allow-nonconcurrent-index reason: <one line>
```

The lint honours these; use them sparingly and always with a reason.

## Why the old ones are harmless (and were left as-is)

`20260419000000_master_migration.sql` and the non-concurrent index migrations
(`20260520120000`, `20260831110000`) already ran in production and are recorded
in `pgmigrations`, so node-pg-migrate never re-runs them; and a fresh database is
bootstrapped from `schema.sql`, never by replaying them (replaying from zero is
unsupported — early migrations reference tables created later). Rewriting an
applied migration changes nothing at runtime, so the historical instances are
left intact (and version-controlled) rather than churned; only recurrence is
prevented.
