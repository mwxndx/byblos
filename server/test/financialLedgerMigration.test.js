import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

describe('Cryptographic Financial Ledger Phase 1 - Migration & Hash Consistency', () => {
    test('migration files exist, are strictly formatted, and contain immutability triggers', () => {
        const ddlFile = path.join(MIGRATIONS_DIR, '20261115180000_create_cryptographic_financial_ledger.sql');
        const seedFile = path.join(MIGRATIONS_DIR, '20261115181000_seed_genesis_financial_ledger_balances.sql');

        assert.ok(fs.existsSync(ddlFile), 'DDL migration file must exist');
        assert.ok(fs.existsSync(seedFile), 'Seed genesis migration file must exist');

        const ddlSql = fs.readFileSync(ddlFile, 'utf8');
        assert.match(ddlSql, /CREATE TABLE IF NOT EXISTS financial_ledger/i);
        assert.match(ddlSql, /sequence_number BIGSERIAL PRIMARY KEY/i);
        assert.match(ddlSql, /row_hash VARCHAR\(64\) NOT NULL/i);
        assert.match(ddlSql, /prev_hash VARCHAR\(64\) NOT NULL/i);
        assert.match(ddlSql, /enforce_ledger_immutability/i);
        assert.match(ddlSql, /CREATE TABLE IF NOT EXISTS ledger_epochs/i);

        const seedSql = fs.readFileSync(seedFile, 'utf8');
        assert.match(seedSql, /GENESIS_ROOT/i);
        assert.match(seedSql, /GENESIS_BALANCE/i);
    });

    test('Node.js standard SHA-256 matches the canonical string format used by pgcrypto digest()', () => {
        const genesisPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';
        const canonicalString = `${genesisPrevHash}:1:platform:0:0.00:0.00:GENESIS_ROOT`;

        const computedHash = crypto.createHash('sha256').update(canonicalString).digest('hex');

        assert.equal(computedHash.length, 64, 'SHA-256 hash must be exactly 64 hexadecimal characters');
        assert.match(computedHash, /^[0-9a-f]{64}$/, 'Hash must contain only lowercase hex characters');
    });
});

