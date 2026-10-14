import { toCents, roundMoney } from './escrowMoney.utils.js';

export const reverseOrderSettlementForRefundHelper = async (client, orderId, source = 'refund', refundAmount = null, orderTotal = null, parseMetadata = null) => {
    const parseMeta = parseMetadata || ((val) => {
        if (!val) return {};
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return {}; }
        }
        return val;
    });

    const { rows: payouts } = await client.query(
        `SELECT id, seller_id, amount, settlement_status, status, settlement_metadata
         FROM payouts
         WHERE order_id = $1
         FOR UPDATE`,
        [orderId]
    );

    const payout = payouts[0];
    if (!payout || !payout.seller_id) {
        return { adjusted: false, reason: 'no_seller_payout' };
    }

    const totalPayoutCents = toCents(payout.amount);
    if (totalPayoutCents <= 0) {
        return { adjusted: false, reason: 'invalid_payout_amount' };
    }

    const existingMetadata = parseMeta(payout.settlement_metadata);
    const previouslyReversedCents = toCents(existingMetadata.total_reversed);
    const remainingPayoutCents = Math.max(0, totalPayoutCents - previouslyReversedCents);

    if (remainingPayoutCents <= 0) {
        return { adjusted: false, reason: 'payout_already_fully_reversed' };
    }

    let reversalCents = remainingPayoutCents;
    const refundCents = toCents(refundAmount);
    const totalOrderCents = toCents(orderTotal);

    if (refundCents > 0 && totalOrderCents > 0 && refundCents < totalOrderCents) {
        const calculatedCents = Math.round(totalPayoutCents * (refundCents / totalOrderCents));
        reversalCents = Math.min(remainingPayoutCents, calculatedCents);
    }

    if (reversalCents <= 0) {
        return { adjusted: false, reason: 'zero_reversal_amount' };
    }

    const newTotalReversedCents = previouslyReversedCents + reversalCents;
    const reversalAmount = roundMoney(reversalCents / 100);
    const newTotalReversed = roundMoney(newTotalReversedCents / 100);
    const isFinal = newTotalReversedCents >= totalPayoutCents;

    const updatedHistory = Array.isArray(existingMetadata.reversals) ? [...existingMetadata.reversals] : [];
    updatedHistory.push({
        amount: reversalAmount,
        refund_source: source,
        reversed_at: new Date().toISOString()
    });

    const newMetadata = {
        ...existingMetadata,
        refund_source: source,
        refunded_at: new Date().toISOString(),
        total_reversed: newTotalReversed,
        reversals: updatedHistory
    };

    const settlementStatus = String(payout.settlement_status || '').toLowerCase();
    if (settlementStatus === 'pending_settlement' || settlementStatus === 'partially_refunded') {
        await client.query(
            `UPDATE sellers
             SET pending_settlement_balance = GREATEST(COALESCE(pending_settlement_balance, 0) - $1, 0),
                 refund_reserved_balance = COALESCE(refund_reserved_balance, 0) + $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [reversalAmount, payout.seller_id]
        );
        await client.query(
            `UPDATE payouts
             SET status = CASE WHEN $2 THEN 'refunded' ELSE status END,
                 settlement_status = CASE WHEN $2 THEN 'refunded_before_settlement' ELSE 'partially_refunded' END,
                 settlement_metadata = $3::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [payout.id, isFinal, JSON.stringify(newMetadata)]
        );
        return { adjusted: true, bucket: 'pending_settlement', amount: reversalAmount, isFinal };
    }

    if (settlementStatus === 'settled') {
        const { rows: reservedRows } = await client.query(
            `UPDATE sellers
             SET balance = balance - $1,
                 refund_reserved_balance = COALESCE(refund_reserved_balance, 0) + $1,
                 updated_at = NOW()
             WHERE id = $2
               AND balance >= $1
             RETURNING balance`,
            [reversalAmount, payout.seller_id]
        );

        if (reservedRows.length === 0) {
            await client.query(
                `UPDATE payouts
                 SET settlement_status = 'refund_compensation_required',
                     settlement_metadata = $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $1`,
                [payout.id, JSON.stringify({
                    ...newMetadata,
                    reason: 'seller_available_balance_insufficient',
                    manual_compensation_required: true
                })]
            );
            return { adjusted: false, reason: 'manual_compensation_required' };
        }

        await client.query(
            `UPDATE payouts
             SET status = CASE WHEN $2 THEN 'refunded' ELSE status END,
                 settlement_status = CASE WHEN $2 THEN 'refunded_after_settlement' ELSE 'partially_refunded' END,
                 settlement_metadata = $3::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [payout.id, isFinal, JSON.stringify(newMetadata)]
        );
        return { adjusted: true, bucket: 'available_balance', amount: reversalAmount, isFinal };
    }

    return { adjusted: false, reason: `settlement_status_${settlementStatus || 'unknown'}` };
};

const reverseSingleCreatorEarning = async (client, earning, source, isPartialOrder, numRefund, numTotal, parseMeta, balanceField, table, creatorIdField) => {
    const totalAmountCents = toCents(earning.amount);
    if (totalAmountCents <= 0 || earning.status === 'reversed') return null;

    const earningMeta = parseMeta(earning.metadata);
    const prevReversedCents = toCents(earningMeta.total_reversed);
    const remainingCents = Math.max(0, totalAmountCents - prevReversedCents);

    let deductionCents = remainingCents;
    const refundCents = toCents(numRefund);
    const totalOrderCents = toCents(numTotal);

    if (isPartialOrder && refundCents > 0 && totalOrderCents > 0) {
        const calcCents = Math.round(totalAmountCents * (refundCents / totalOrderCents));
        deductionCents = Math.min(remainingCents, calcCents);
    }
    if (deductionCents <= 0) return null;

    const newTotalReversedCents = prevReversedCents + deductionCents;
    const deduction = roundMoney(deductionCents / 100);
    const newTotalReversed = roundMoney(newTotalReversedCents / 100);
    const isFinal = newTotalReversedCents >= totalAmountCents;

    const updatedHistory = Array.isArray(earningMeta.reversals) ? [...earningMeta.reversals] : [];
    updatedHistory.push({
        amount: deduction,
        reversal_source: source,
        reversed_at: new Date().toISOString()
    });

    const newMeta = {
        ...earningMeta,
        reversal_source: source,
        reversed_at: new Date().toISOString(),
        total_reversed: newTotalReversed,
        reversals: updatedHistory
    };

    const creatorId = earning[creatorIdField];
    const { rows: creatorRows } = await client.query(
        `SELECT id, balance FROM creators WHERE id = $1 FOR UPDATE`,
        [creatorId]
    );

    if (creatorRows.length === 0) return null;
    const currentBalanceCents = toCents(creatorRows[0].balance);
    const currentBalance = roundMoney(currentBalanceCents / 100);

    if (currentBalanceCents >= deductionCents) {
        await client.query(
            `UPDATE creators
             SET balance = balance - $1,
                 ${balanceField} = GREATEST(${balanceField} - $1, 0),
                 updated_at = NOW()
             WHERE id = $2`,
            [deduction, creatorId]
        );

        await client.query(
            `UPDATE ${table}
             SET status = CASE WHEN $2 THEN 'reversed' ELSE 'partially_reversed' END,
                 metadata = $3::jsonb
             WHERE id = $1`,
            [earning.id, isFinal, JSON.stringify(newMeta)]
        );
        return { adjusted: true, amount: deduction, [creatorIdField]: creatorId, isFinal };
    }

    const deficitCents = deductionCents - currentBalanceCents;
    const deficitAmount = roundMoney(deficitCents / 100);

    await client.query(
        `UPDATE ${table}
         SET status = 'reversal_compensation_required',
             metadata = $2::jsonb
         WHERE id = $1`,
        [
            earning.id,
            JSON.stringify({
                ...newMeta,
                deficit: true,
                shortfall: deficitAmount,
                available_balance: currentBalance,
                reason: `${creatorIdField}_balance_insufficient`,
                manual_compensation_required: true,
                flagged_at: new Date().toISOString()
            })
        ]
    );

    return {
        adjusted: false,
        reason: 'creator_balance_insufficient',
        deficit: deficitAmount,
        [creatorIdField]: creatorId
    };
};

export const reverseCreatorEarningsForRefundHelper = async (client, orderId, source = 'refund', refundAmount = null, orderTotal = null, parseMetadata = null) => {
    const parseMeta = parseMetadata || ((val) => {
        if (!val) return {};
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return {}; }
        }
        return val;
    });

    const results = {
        salesCommission: null,
        referralCommission: null
    };

    const refundCents = toCents(refundAmount);
    const totalOrderCents = toCents(orderTotal);
    const isPartialOrder = refundCents > 0 && totalOrderCents > 0 && refundCents < totalOrderCents;

    // 1. Reversal for creator sales earnings
    const { rows: earningsRows } = await client.query(
        `SELECT id, creator_id, amount, status, metadata
         FROM creator_earnings
         WHERE order_id = $1
         FOR UPDATE`,
        [orderId]
    );

    if (earningsRows.length > 0) {
        results.salesCommission = await reverseSingleCreatorEarning(
            client,
            earningsRows[0],
            source,
            isPartialOrder,
            refundAmount,
            orderTotal,
            parseMeta,
            'total_earnings',
            'creator_earnings',
            'creator_id'
        );
    }

    // 2. Reversal for creator-refers-seller earnings
    const { rows: refEarningsRows } = await client.query(
        `SELECT id, referrer_creator_id, amount, status, metadata
         FROM creator_referral_earnings
         WHERE order_id = $1
         FOR UPDATE`,
        [orderId]
    );

    if (refEarningsRows.length > 0) {
        results.referralCommission = await reverseSingleCreatorEarning(
            client,
            refEarningsRows[0],
            source,
            isPartialOrder,
            refundAmount,
            orderTotal,
            parseMeta,
            'total_referral_earnings',
            'creator_referral_earnings',
            'referrer_creator_id'
        );
    }

    return results;
};
