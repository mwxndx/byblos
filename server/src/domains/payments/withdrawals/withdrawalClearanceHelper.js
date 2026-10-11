/**
 * withdrawalClearanceHelper.js
 *
 * Dedicated helper to compute locked clearance balances for Creators and Buyer Refunds
 * inside active database transactions (FOR UPDATE).
 * Isolates multi-table clearance calculation from withdrawal.service.js.
 */
import { computeClearance } from '../../growth/creators/creatorMoney.utils.js';

export async function computeCreatorClearingBalance(client, creatorId, lockedBalance) {
    const toEarning = (e) => ({
        amount: Number.parseFloat(e.amount || 0),
        createdAt: new Date(e.created_at),
        flaggedForReview: (e.metadata || {}).flagged_for_review === true
    });

    const [salesResult, referralResult] = await Promise.all([
        client.query(
            `SELECT id, amount, created_at, metadata
               FROM creator_earnings
              WHERE creator_id = $1 AND status = 'credited'
                AND (created_at >= NOW() - INTERVAL '10 days'
                     OR (metadata->>'flagged_for_review') = 'true')`,
            [creatorId]
        ),
        client.query(
            `SELECT id, amount, created_at, metadata
               FROM creator_referral_earnings
              WHERE referrer_creator_id = $1 AND status = 'credited'
                AND (created_at >= NOW() - INTERVAL '10 days'
                     OR (metadata->>'flagged_for_review') = 'true')`,
            [creatorId]
        )
    ]);
    const earnings = [...salesResult.rows.map(toEarning), ...referralResult.rows.map(toEarning)];
    return computeClearance({ totalBalance: lockedBalance, earnings }).clearingBalance;
}

export async function computeBuyerRefundClearingBalance(client, buyerId, lockedRefunds) {
    const [refundRequestsResult, refundedOrdersResult] = await Promise.all([
        client.query(
            `SELECT amount, processed_at, updated_at, requested_at, payment_details
               FROM refund_requests
              WHERE buyer_id = $1 AND status = 'completed'`,
            [buyerId]
        ),
        client.query(
            `SELECT total_amount AS amount, updated_at
               FROM product_orders
              WHERE buyer_id = $1 AND status = 'REFUNDED'
                AND id NOT IN (SELECT order_id FROM refund_requests WHERE buyer_id = $1 AND order_id IS NOT NULL)`,
            [buyerId]
        )
    ]);
    const events = [
        ...refundRequestsResult.rows.map((rr) => ({
            amount: Number.parseFloat(rr.amount || 0),
            createdAt: (rr.payment_details?.credited_at || rr.payment_details?.reconciled_at)
                ? new Date(rr.payment_details.credited_at || rr.payment_details.reconciled_at)
                : new Date(rr.updated_at || rr.processed_at || rr.requested_at),
            flaggedForReview: false
        })),
        ...refundedOrdersResult.rows.map((po) => ({
            amount: Number.parseFloat(po.amount || 0),
            createdAt: new Date(po.updated_at),
            flaggedForReview: false
        }))
    ];
    return computeClearance({ totalBalance: lockedRefunds, earnings: events }).clearingBalance;
}

export default {
    computeCreatorClearingBalance,
    computeBuyerRefundClearingBalance
};
