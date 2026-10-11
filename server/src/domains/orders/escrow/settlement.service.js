import logger from '../../../shared/utils/logger.js';
import { toCents, roundMoney } from './escrowMoney.utils.js';
import {
    reverseOrderSettlementForRefundHelper,
    reverseCreatorEarningsForRefundHelper
} from './settlementReversalHelper.js';

const DEFAULT_SETTLEMENT_BUSINESS_DAYS = 2;

function isWeekend(date) {
    const day = date.getUTCDay();
    return day === 0 || day === 6;
}

export function addBusinessDays(startDate, days) {
    const result = new Date(startDate);
    let remaining = Math.max(0, Number.parseInt(days, 10) || 0);

    while (remaining > 0) {
        result.setUTCDate(result.getUTCDate() + 1);
        if (!isWeekend(result)) {
            remaining -= 1;
        }
    }

    return result;
}

class SettlementService {
    getSettlementBusinessDays(env = process.env) {
        const configured = Number.parseInt(env.PAYSTACK_SETTLEMENT_BUSINESS_DAYS, 10);
        return Number.isFinite(configured) && configured >= 0
            ? configured
            : DEFAULT_SETTLEMENT_BUSINESS_DAYS;
    }

    calculateAvailableAt(fromDate = new Date(), env = process.env) {
        return addBusinessDays(fromDate, this.getSettlementBusinessDays(env));
    }

    parseMetadata(value) {
        if (!value) return {};
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return {};
            }
        }
        return value;
    }

    getWithdrawalTotal(request) {
        const metadata = this.parseMetadata(request?.metadata);
        const withdrawalFee = Number.parseFloat(metadata.withdrawal_fee || 0);
        const amount = Number.parseFloat(request?.amount || 0);
        const safeAmount = Number.isFinite(amount) ? amount : 0;
        const safeFee = Number.isFinite(withdrawalFee) ? withdrawalFee : 0;
        return safeAmount + safeFee;
    }

    async promoteEligibleSettlements(client, { limit = 100 } = {}) {
        const { rows: payouts } = await client.query(
            `SELECT id, seller_id, amount
             FROM payouts
             WHERE settlement_status = 'pending_settlement'
               AND available_at <= NOW()
               AND seller_id IS NOT NULL
             ORDER BY available_at ASC, id ASC
             LIMIT $1
             FOR UPDATE SKIP LOCKED`,
            [limit]
        );

        let promoted = 0;
        for (const payout of payouts) {
            const amount = Number.parseFloat(payout.amount || 0);
            if (!Number.isFinite(amount) || amount <= 0) {
                await client.query(
                    `UPDATE payouts
                     SET settlement_status = 'settlement_review',
                         settlement_metadata = COALESCE(settlement_metadata, '{}'::jsonb) || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1
                       AND settlement_status = 'pending_settlement'`,
                    [payout.id, JSON.stringify({ reason: 'invalid_settlement_amount' })]
                );
                continue;
            }

            const { rowCount } = await client.query(
                `UPDATE sellers
                 SET pending_settlement_balance = GREATEST(COALESCE(pending_settlement_balance, 0) - $1, 0),
                     balance = COALESCE(balance, 0) + $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [amount, payout.seller_id]
            );

            if (rowCount === 0) {
                await client.query(
                    `UPDATE payouts
                     SET settlement_status = 'settlement_review',
                         settlement_metadata = COALESCE(settlement_metadata, '{}'::jsonb) || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1
                       AND settlement_status = 'pending_settlement'`,
                    [payout.id, JSON.stringify({ reason: 'seller_missing_at_settlement' })]
                );
                continue;
            }

            await client.query(
                `UPDATE payouts
                 SET status = 'completed',
                     settlement_status = 'settled',
                     settled_at = NOW(),
                     completed_at = COALESCE(completed_at, NOW()),
                     settlement_metadata = COALESCE(settlement_metadata, '{}'::jsonb) || $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $1
                   AND settlement_status = 'pending_settlement'`,
                [payout.id, JSON.stringify({ promoted_by: 'settlement_service' })]
            );
            promoted += 1;
        }

        if (promoted > 0) {
            logger.info(`[SettlementService] Promoted ${promoted} payout(s) to available seller balance`);
        }

        return { scanned: payouts.length, promoted };
    }

    async reverseOrderSettlementForRefund(client, orderId, source = 'refund', refundAmount = null, orderTotal = null) {
        return reverseOrderSettlementForRefundHelper(client, orderId, source, refundAmount, orderTotal, this.parseMetadata.bind(this));
    }

    async reverseCreatorEarningsForRefund(client, orderId, source = 'refund', refundAmount = null, orderTotal = null) {
        return reverseCreatorEarningsForRefundHelper(client, orderId, source, refundAmount, orderTotal, this.parseMetadata.bind(this));
    }
}

export default new SettlementService();
