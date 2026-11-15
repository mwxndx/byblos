import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const AdminService = (await import('../src/domains/identity/admin/admin.service.js')).default;
const LedgerService = (await import('../src/domains/finance/ledger/LedgerService.js')).default;
const { pool } = await import('../src/infrastructure/database/database.js');

describe('Cryptographic Financial Ledger Phase 5 - Admin Oversight & End-to-End Verification', () => {
    test('AdminService.getLedgerStatus returns complete cryptographic health metrics', async () => {
        const status = await AdminService.getLedgerStatus();

        assert.ok(typeof status.totalEntries === 'number');
        assert.ok(status.totalEntries > 0);
        assert.ok(typeof status.latestSequence === 'string' || typeof status.latestSequence === 'number');
        assert.ok(Number(status.latestSequence) > 0);
        assert.ok(status.chainIntegrity);
        assert.equal(status.chainIntegrity.isValid, true);
        assert.equal(status.chainIntegrity.error, null);
    });

    test('AdminService.getLedgerEpochs returns paginated epoch audit records', async () => {
        const result = await AdminService.getLedgerEpochs({ limit: 10, offset: 0 });

        assert.ok(Array.isArray(result.epochs));
        assert.ok(typeof result.total === 'number');

        if (result.epochs.length > 0) {
            const firstEpoch = result.epochs[0];
            assert.ok(firstEpoch.epoch_id);
            assert.ok(firstEpoch.merkle_root);
            assert.ok(firstEpoch.anchor_type);
            assert.ok(firstEpoch.anchor_reference);
            assert.equal(firstEpoch.status, 'anchored');
        }
    });

    test('AdminService.triggerLedgerAudit triggers on-demand audit and returns result', async () => {
        const client = await pool.connect();
        try {
            // Append a test entry to ensure there is something to anchor
            await client.query('BEGIN');
            await LedgerService.appendEntry(client, {
                eventType: 'PLATFORM_FEE_COLLECTED',
                entityType: 'platform',
                entityId: 0,
                amount: 25,
                balanceAfter: 0,
                payload: { note: 'admin_audit_trigger_test' }
            });
            await client.query('COMMIT');

            // Trigger audit via AdminService
            const auditResult = await AdminService.triggerLedgerAudit();
            assert.equal(auditResult.created, true);
            assert.ok(auditResult.epoch);
            assert.ok(auditResult.epoch.merkle_root);

            // Fetch status again to verify latest sequence and epoch updated
            const updatedStatus = await AdminService.getLedgerStatus();
            assert.equal(updatedStatus.lastEpoch.epoch_id, auditResult.epoch.epoch_id);
            assert.equal(updatedStatus.chainIntegrity.isValid, true);
        } finally {
            client.release();
        }
    });
});

