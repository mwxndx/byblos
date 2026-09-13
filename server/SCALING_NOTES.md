# Scaling notes — deliberately deferred decisions

Two items from the database review are real but **not urgent**, and acting on
them now would cost more than it returns (a schema-wide migration and a public
API contract change, both on tables that are currently empty/small). They are
recorded here — with a concrete trigger for when to revisit — rather than
implemented prematurely (KISS/YAGNI). Revisit each when its trigger is met.

## 1. Integer (`SERIAL` / `int4`) primary keys

**Observation.** Core tables (`sellers`, `buyers`, `creators`, `product_orders`,
`payments`, `withdrawal_requests`, …) use 32-bit `SERIAL`/`integer` primary keys.
The `int4` ceiling is ~2.1 billion. This is not a bug and no single migration
introduced it.

**Why deferred.** Converting every PK (and every FK column that references it) to
`bigint` is a schema-wide, high-blast-radius migration touching most tables and
their foreign keys. Done wrong it risks referential-integrity bugs on live money
tables. There is no current pressure: row counts are tiny. The only real cost of
waiting is that the conversion is cheaper while tables are small — but it is
still cheap at, say, low-millions of rows, and doing it prematurely trades a real
migration risk for a benefit we do not yet need.

**Trigger to revisit.** When any table's sequence is realistically within a
couple of orders of magnitude of `int4` max, or before a data event expected to
add hundreds of millions of rows. At that point convert PKs + referencing FKs to
`bigint` in a staged, backfilled migration (identity-column swap or
`ALTER … TYPE bigint` per table, dependency order first), one table per migration.

## 2. Public seller directory pagination (`OFFSET`)

**Observation.** `seller.repository.findActiveWithStats({ limit, offset })` (the
public seller directory) paginates with `LIMIT … OFFSET …`. `OFFSET` re-scans and
discards all skipped rows, so deep pages get progressively slower.

**Why deferred.** It is correct and fast at today's page depths. Switching to
keyset/cursor pagination (`WHERE (sort_key, id) < ($cursor…)`) is a **contract
change** — the frontend seller-directory list would have to send an opaque cursor
instead of a page/offset — for a benefit that only materialises at deep pagination
over a large seller table, which does not exist yet.

**Trigger to revisit.** When the seller directory is large enough that users
actually page deep (or the endpoint shows up slow in query metrics). Then move to
keyset pagination: order by a stable `(created_at, id)` (or the chosen sort key
plus `id` tiebreaker) and page with a cursor of the last row's key rather than an
offset. `findAllForAdmin` (buyers) — now capped at 1000 with a warning — is the
other endpoint to give real pagination at that time.
