#!/usr/bin/env node
/**
 * Byblos Payout Reconciliation Runner
 *
 * Scans withdrawal_requests stuck in 'processing' and reconciles their
 * status against Paystack.
 *
 * Usage:
 *   node server/scripts/reconcile-payouts.js       # Reconcile all processing payouts
 *   node server/scripts/reconcile-payouts.js 2     # Reconcile payouts stuck > 2 hours
 */

import 'dotenv/config';
import { reconcileStuckWithdrawalsHelper } from '../src/domains/payments/withdrawals/withdrawalReconciliationHelper.js';
import withdrawalService from '../src/domains/payments/withdrawals/withdrawal.service.js';
import { pool } from '../src/infrastructure/database/database.js';

async function main() {
    const hoursAgo = Number.parseFloat(process.argv[2] || '0');
    console.log(`[PayoutReconciliation] Starting payout reconciliation for requests stuck > ${hoursAgo} hours...`);

    try {
        await reconcileStuckWithdrawalsHelper(withdrawalService, hoursAgo);
        console.log('[PayoutReconciliation] Reconciliation pass completed successfully.');
    } catch (err) {
        console.error('[PayoutReconciliation] Reconciliation failed:', err);
        process.exitCode = 1;
    } finally {
        try {
            await pool.end();
        } catch {
            // Ignored on shutdown
        }
    }
}

main();

