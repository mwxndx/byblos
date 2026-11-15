import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const { pool } = await import('../src/infrastructure/database/database.js');
const LedgerService = (await import('../src/domains/finance/ledger/LedgerService.js')).default;
const LedgerAnchorClient = (await import('../src/domains/finance/ledger/LedgerAnchorClient.js')).default;
const LedgerAuditService = (await import('../src/domains/finance/ledger/LedgerAuditService.js')).default;
const { auditLedgerOnce } = await import('../src/application/cron/ledgerAuditCron.js');

describe('Cryptographic Financial Ledger Phase 4 - Audit Worker & Epoch Anchoring', () => {
    test('LedgerAnchorClient anchors manifest to local immutable archive with computed SHA-256', async () => {
        const dummyLeafHashes = [
            'aa'.repeat(32),
            'bb'.repeat(32),
            'cc'.repeat(32)
        ];
        const merkleRoot = LedgerService.computeMerkleRoot(dummyLeafHashes);

        const result = await LedgerAnchorClient.anchorEpoch({
            startSequence: 1,
            endSequence: 3,
            entryCount: 3,
            merkleRoot,
            leafHashes: dummyLeafHashes,
            payloadSummary: { test: true }
        });

        assert.ok(result.anchorReference);
        assert.equal(result.anchorType, 'local_archive');
        assert.ok(result.sha256);

        // Verify the file was written and is parseable
        const filePath = result.anchorReference.replace('file://', '');
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(content);

        assert.equal(parsed.merkleRoot, merkleRoot);
        assert.equal(parsed.startSequence, 1);
        assert.equal(parsed.endSequence, 3);
        assert.equal(parsed.entryCount, 3);
        assert.deepEqual(parsed.leafHashes, dummyLeafHashes);
    });

    test('LedgerAuditService audits unanchored ledger slice and records epoch in ledger_epochs', async () => {
        const client = await pool.connect();
        try {
            // Append a genuine row so there are new unanchored entries
            await client.query('BEGIN');
            await LedgerService.appendEntry(client, {
                eventType: 'PLATFORM_FEE_COLLECTED',
                entityType: 'platform',
                entityId: 0,
                amount: 15,
                balanceAfter: 0,
                payload: { note: 'audit_test_entry' }
            });
            await client.query('COMMIT');

            // Run epoch audit
            const result = await LedgerAuditService.auditAndAnchorEpoch(client);

            assert.equal(result.created, true);
            assert.ok(result.epoch);
            assert.ok(result.epoch.epoch_id);
            assert.ok(result.epoch.merkle_root);
            assert.equal(result.epoch.status, 'anchored');

            // Running immediately again without new entries should skip cleanly
            const rerun = await LedgerAuditService.auditAndAnchorEpoch(client);
            assert.equal(rerun.created, false);
            assert.equal(rerun.reason, 'no_new_entries');
        } finally {
            client.release();
        }
    });

    test('auditLedgerOnce acquires advisory lock and skips execution when lock is active', async () => {
        const client = await pool.connect();
        const LOCK_KEY = 'byblos:ledger-audit-cron';

        try {
            // Manually hold the advisory lock on client
            const { rows: [lockRow] } = await client.query(
                'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
                [LOCK_KEY]
            );
            assert.equal(lockRow.locked, true);

            // Calling auditLedgerOnce concurrently should detect lock and skip safely
            const cronResult = await auditLedgerOnce();
            assert.equal(cronResult.skipped, true);
            assert.equal(cronResult.reason, 'lock_not_acquired');

            // Release lock
            await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]);
        } finally {
            client.release();
        }
    });
});

