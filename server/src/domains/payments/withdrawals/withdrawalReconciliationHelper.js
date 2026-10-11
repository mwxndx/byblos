/**
 * withdrawalReconciliationHelper.js
 *
 * Dedicated helper to reconcile stuck withdrawal requests with Paystack/mock provider.
 * Extracts reconciliation polling, manual review flags, and amount verification
 * from withdrawal.service.js.
 */
import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import payoutService from '../payouts/payout.service.js';
import {
    providerPayloadIndicatesSuccess,
    providerPayloadIndicatesFailure
} from '../payouts/payoutCallbackStateMachine.service.js';

export async function reconcileStuckWithdrawalsHelper(withdrawalServiceInstance, hoursAgo = 2) {
    logger.info(`[WithdrawalService] Reconciling requests stuck > ${hoursAgo} hours`);

    const { rows: stuck } = await pool.query(
        `SELECT wr.*,
                COALESCE(s.full_name, CONCAT_WS(' ', c.first_name, c.last_name), b.full_name) AS entity_name,
                COALESCE(s.whatsapp_number, c.whatsapp_number, c.mpesa_number, b.whatsapp_number, b.mobile_payment) AS whatsapp_number
         FROM withdrawal_requests wr
         LEFT JOIN sellers s ON wr.seller_id = s.id
         LEFT JOIN creators c ON wr.creator_id = c.id
         LEFT JOIN buyers b ON wr.buyer_id = b.id
         WHERE wr.status = 'processing'
           AND wr.created_at < NOW() - ($1 * INTERVAL '1 hour')
           AND wr.created_at > NOW() - INTERVAL '48 hours'
         ORDER BY wr.created_at ASC
         LIMIT 50`,
        [hoursAgo]
    );

    logger.info(`[WithdrawalService] Found ${stuck.length} stuck request(s)`);

    for (const request of stuck) {
        try {
            if (!request.provider_reference) {
                logger.warn(`[WithdrawalService] Request ${request.id} has no provider_reference. Marking needs_review.`);
                await pool.query(
                    `UPDATE withdrawal_requests 
                     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{reconciliation_flag}', '"no_provider_reference"'::jsonb)
                     WHERE id = $1`,
                    [request.id]
                );
                continue;
            }

            try {
                const statusCheck = await payoutService.checkPayoutStatus(request.provider_reference);
                const statusPayload = statusCheck?.raw_response || statusCheck || {};
                const providerAmount = Number.parseFloat(statusPayload.amount ?? statusCheck?.amount);
                const expectedAmount = Number.parseFloat(request.amount || 0);

                if (statusCheck?.success && providerPayloadIndicatesSuccess(statusPayload)) {
                    if (!Number.isNaN(providerAmount) && Math.abs(providerAmount - expectedAmount) > 0.01) {
                        await pool.query(
                            `UPDATE withdrawal_requests
                             SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
                                 updated_at = NOW()
                             WHERE id = $2`,
                            [JSON.stringify({
                                reconciliation_flag: 'provider_success_amount_mismatch',
                                expected_amount: expectedAmount,
                                provider_amount: providerAmount,
                                needs_manual_review: true
                            }), request.id]
                        );
                        continue;
                    }

                    await withdrawalServiceInstance.updateStatusWithSideEffects(request.id, 'completed', {
                        provider_reference: request.provider_reference,
                        mpesa_receipt: statusPayload.third_party_trans_id || statusPayload.mpesa_receipt || null,
                        remarks: 'Payout confirmed by provider status reconciliation'
                    });
                    continue;
                }

                if (statusCheck?.success && providerPayloadIndicatesFailure(statusPayload)) {
                    await withdrawalServiceInstance.updateStatusWithSideEffects(request.id, 'failed', {
                        provider_reference: request.provider_reference,
                        remarks: statusPayload.message || 'Payout failed by provider status reconciliation'
                    });
                    continue;
                }
            } catch (statusError) {
                logger.warn(`[WithdrawalService] Status reconciliation unavailable for request ${request.id}: ${statusError.message}`);
            }

            await pool.query(
                `UPDATE withdrawal_requests 
                 SET metadata = jsonb_set(
                     COALESCE(metadata, '{}'::jsonb),
                     '{reconciliation_flag}',
                     '"needs_manual_review"'::jsonb
                 )
                 WHERE id = $1 AND metadata ->> 'reconciliation_flag' IS NULL`,
                [request.id]
            );

            logger.info(`[WithdrawalService] Request ${request.id} (ref: ${request.provider_reference}) flagged for manual review`);

        } catch (err) {
            logger.error(`[WithdrawalService] Reconcile error for request ${request.id}: `, err.message);
        }
    }
}

export default {
    reconcileStuckWithdrawalsHelper
};
