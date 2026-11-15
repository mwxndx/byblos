import cron from 'node-cron';
import { pool } from '../../infrastructure/database/database.js';
import logger from '../../shared/utils/logger.js';
import LedgerAuditService from '../../domains/finance/ledger/LedgerAuditService.js';

const LOCK_KEY = 'byblos:ledger-audit-cron';

/**
 * Runs one pass of the ledger audit and epoch anchoring job.
 * Serialized across backend replicas using Postgres advisory locks.
 */
export async function auditLedgerOnce() {
    const client = await pool.connect();
    try {
        const { rows: [lockRow] } = await client.query(
            'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
            [LOCK_KEY]
        );

        if (!lockRow?.locked) {
            logger.info('[LedgerAuditCron] Ledger audit already running on another instance; skipping');
            return { skipped: true, reason: 'lock_not_acquired' };
        }

        logger.info('[LedgerAuditCron] Starting scheduled cryptographic ledger audit & epoch anchoring');
        const result = await LedgerAuditService.auditAndAnchorEpoch(client);
        return result;
    } catch (error) {
        logger.error('[LedgerAuditCron] Ledger audit job failed:', error.message);
        throw error;
    } finally {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]).catch(() => {});
        client.release();
    }
}

/**
 * Schedules the periodic cryptographic ledger audit job.
 * Default: hourly at minute 0 ('0 * * * *').
 */
export function scheduleLedgerAudit({
    schedule = process.env.LEDGER_AUDIT_CRON || '0 * * * *'
} = {}) {
    return cron.schedule(schedule, () => {
        auditLedgerOnce().catch(error => {
            logger.error('[LedgerAuditCron] Scheduled ledger audit failed:', error.message);
        });
    });
}
