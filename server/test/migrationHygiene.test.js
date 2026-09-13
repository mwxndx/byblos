// Enforces the migration conventions in server/MIGRATIONS.md for every migration
// authored AFTER the cutoff below. All migrations that existed when the convention
// was introduced are grandfathered (they carry the historical anti-patterns the
// production audit flagged, which are inert — see server/MIGRATIONS.md), so this
// test only guards NEW migrations against RE-introducing those patterns.
//
// It also guards the directory itself: node-pg-migrate loads EVERY file in
// migrations/, so a stray non-.sql file (e.g. a docs .md) fails the whole deploy —
// keep this directory to .sql migration files only.
//
// Two mechanical rules, both scoped to hot/large tables (where the hazard is real):
//   1. no bulk backfill (UPDATE / INSERT..SELECT) in the same file as DDL
//   2. no non-CONCURRENT CREATE INDEX in a .sql migration (which always runs in a
//      transaction, so it locks the table for the whole build)
// A migration can opt out of a rule with a `-- migration-hygiene:allow-...` marker.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

// Timestamp prefix of the newest migration that existed when these conventions
// landed. Files with a strictly greater prefix are linted; everything at or
// before it is grandfathered. Bump this ONLY to grandfather a deliberate,
// reviewed exception — never to silence a real violation.
const GRANDFATHER_CUTOFF = '20260913130000';

// Tables large/hot enough that a lock-taking build or a batch backfill is a
// deploy-time hazard. Cold/small tables are intentionally not covered.
const HOT_TABLES = ['product_orders', 'payments', 'order_items', 'withdrawal_requests'];
const HOT = `(?:${HOT_TABLES.join('|')})`;

function prefixOf(filename) {
  const m = filename.match(/^(\d{14})_/);
  return m ? m[1] : null;
}

function lintable() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => {
      const p = prefixOf(f);
      return p && p > GRANDFATHER_CUTOFF;
    })
    .sort();
}

function hasDDL(sql) {
  return /\bCREATE\s+TABLE\b/i.test(sql) || /\bALTER\s+TABLE\b[\s\S]*?\bADD\s+COLUMN\b/i.test(sql);
}

function hotBackfill(sql) {
  // UPDATE <hot> SET ...  or  INSERT INTO <hot> ... SELECT ...
  const update = new RegExp(`\\bUPDATE\\s+(?:public\\.)?${HOT}\\b[\\s\\S]*?\\bSET\\b`, 'i');
  const insertSelect = new RegExp(`\\bINSERT\\s+INTO\\s+(?:public\\.)?${HOT}\\b[\\s\\S]*?\\bSELECT\\b`, 'i');
  return update.test(sql) || insertSelect.test(sql);
}

function nonConcurrentHotIndex(sql) {
  // CREATE INDEX [IF NOT EXISTS] <name> ON <hot> ...  without CONCURRENTLY
  const re = new RegExp(
    `\\bCREATE\\s+INDEX\\s+(?!CONCURRENTLY\\b)(?:IF\\s+NOT\\s+EXISTS\\s+)?[\\w".]+\\s+ON\\s+(?:public\\.)?${HOT}\\b`,
    'i'
  );
  return re.test(sql);
}

describe('migration hygiene (server/MIGRATIONS.md) — enforced for new migrations', () => {
  test('migrations/ contains only .sql files (node-pg-migrate loads every file here)', () => {
    // A stray non-.sql file (e.g. a docs .md) makes node-pg-migrate try to parse
    // it as a migration and fails the entire deploy. Keep this directory clean.
    const strays = fs.readdirSync(MIGRATIONS_DIR).filter((f) => {
      const full = path.join(MIGRATIONS_DIR, f);
      return fs.statSync(full).isFile() && !f.endsWith('.sql');
    });
    assert.deepEqual(
      strays, [],
      `Non-migration files in server/migrations/ will break the deploy (node-pg-migrate loads every file). Move them out (docs belong at server/MIGRATIONS.md): ${strays.join(', ')}`
    );
  });

  test(`grandfather cutoff ${GRANDFATHER_CUTOFF} is a real, existing migration prefix`, () => {
    const prefixes = new Set(
      fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).map(prefixOf).filter(Boolean)
    );
    assert.ok(prefixes.has(GRANDFATHER_CUTOFF), 'cutoff must match an existing migration so nothing is accidentally skipped');
  });

  test('no new migration rides a hot-table backfill inside a schema migration (Convention #1)', () => {
    const offenders = [];
    for (const file of lintable()) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      if (/migration-hygiene:allow-backfill-with-ddl/i.test(sql)) continue;
      if (hasDDL(sql) && hotBackfill(sql)) offenders.push(file);
    }
    assert.deepEqual(
      offenders, [],
      `These migrations mix a hot-table backfill with DDL in one transaction — split the backfill into its own, batched migration (see server/MIGRATIONS.md #1), or add "-- migration-hygiene:allow-backfill-with-ddl reason: ...": ${offenders.join(', ')}`
    );
  });

  test('no new .sql migration builds a non-concurrent index on a hot table (Convention #2)', () => {
    const offenders = [];
    for (const file of lintable()) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      if (/migration-hygiene:allow-nonconcurrent-index/i.test(sql)) continue;
      if (nonConcurrentHotIndex(sql)) offenders.push(file);
    }
    assert.deepEqual(
      offenders, [],
      `These migrations build a non-concurrent index on a hot table, locking writes for the whole build. Build it CONCURRENTLY out-of-band or in a JS noTransaction migration (see server/MIGRATIONS.md #2), or add "-- migration-hygiene:allow-nonconcurrent-index reason: ...": ${offenders.join(', ')}`
    );
  });
});
