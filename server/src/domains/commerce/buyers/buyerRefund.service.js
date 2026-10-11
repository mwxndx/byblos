/**
 * buyerRefund.service.js
 *
 * Dedicated domain service managing buyer refund clearance and T+2 availability.
 * De-bloats buyer.controller.js while preserving exact query shapes and holding math.
 */
import { pool } from '../../../infrastructure/database/database.js';
import { addBusinessDays } from '../../orders/escrow/settlement.service.js';

export async function getBuyerRefundClearance(buyerId) {
  const [buyerResult, refundRequestsResult, refundedOrdersResult] = await Promise.all([
    pool.query(`SELECT refunds, mobile_payment, whatsapp_number, full_name FROM buyers WHERE id = $1`, [buyerId]),
    pool.query(
      `SELECT id, amount, processed_at, updated_at, requested_at, payment_details
       FROM refund_requests
       WHERE buyer_id = $1 AND status = 'completed'
       ORDER BY COALESCE(processed_at, updated_at, requested_at) DESC`,
      [buyerId]
    ),
    pool.query(
      `SELECT id, total_amount AS amount, updated_at
       FROM product_orders
       WHERE buyer_id = $1 AND status = 'REFUNDED'
         AND id NOT IN (SELECT order_id FROM refund_requests WHERE buyer_id = $1 AND order_id IS NOT NULL)
       ORDER BY updated_at DESC`,
      [buyerId]
    )
  ]);

  const buyer = buyerResult.rows[0];
  const totalRefunds = Number.parseFloat(buyer?.refunds || 0);

  let unclearedAmount = 0;
  let nextAvailableAt = null;
  const now = new Date();

  // Aggregate all completed refund events
  const allEvents = [
    ...refundRequestsResult.rows.map(rr => ({
      amount: Number.parseFloat(rr.amount || 0),
      creditedAt: (rr.payment_details?.credited_at || rr.payment_details?.reconciled_at)
        ? new Date(rr.payment_details.credited_at || rr.payment_details.reconciled_at)
        : new Date(rr.updated_at || rr.processed_at || rr.requested_at)
    })),
    ...refundedOrdersResult.rows.map(po => ({
      amount: Number.parseFloat(po.amount || 0),
      creditedAt: new Date(po.updated_at)
    }))
  ];

  for (const event of allEvents) {
    if (!Number.isFinite(event.amount) || event.amount <= 0) continue;
    const availableTime = addBusinessDays(event.creditedAt, 2);
    if (now < availableTime) {
      unclearedAmount += event.amount;
      if (!nextAvailableAt || availableTime < nextAvailableAt) {
        nextAvailableAt = availableTime;
      }
    }
  }

  const clearingBalance = Math.min(totalRefunds, unclearedAmount);
  const availableBalance = Math.max(0, totalRefunds - clearingBalance);

  return {
    totalRefunds,
    availableBalance,
    clearingBalance,
    nextAvailableAt: nextAvailableAt ? nextAvailableAt.toISOString() : null,
    isClearing: clearingBalance > 0,
    buyerPhone: buyer?.mobile_payment || buyer?.whatsapp_number || '',
    buyerName: buyer?.full_name || ''
  };
}

import Fees from '../../../shared/config/fees.js';
import WithdrawalService from '../../payments/withdrawals/withdrawal.service.js';
import { AppError } from '../../../shared/utils/errorHandler.js';

export async function processBuyerRefundRequest({ buyerId, amount, mpesaNumber, mpesaName, idempotencyKey }) {
  const withdrawalAmount = Number.parseFloat(amount);
  if (!Number.isFinite(withdrawalAmount) || withdrawalAmount < Fees.MIN_WITHDRAWAL_AMOUNT) {
    throw new AppError(`Minimum withdrawal amount is KES ${Fees.MIN_WITHDRAWAL_AMOUNT}`, 400);
  }
  if (withdrawalAmount > Fees.MAX_WITHDRAWAL_AMOUNT) {
    throw new AppError(`Maximum withdrawal amount is KES ${Fees.MAX_WITHDRAWAL_AMOUNT.toLocaleString()}`, 400);
  }

  const withdrawalFee = Fees.calculateWithdrawalFee(withdrawalAmount);
  const totalDeducted = withdrawalAmount + withdrawalFee;

  const clearance = await getBuyerRefundClearance(buyerId);

  if (totalDeducted > clearance.availableBalance) {
    if (totalDeducted <= clearance.totalRefunds && clearance.clearingBalance > 0) {
      const nextDateStr = clearance.nextAvailableAt
        ? new Date(clearance.nextAvailableAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'soon';
      throw new AppError(
        `Your withdrawal of KES ${withdrawalAmount.toLocaleString()} requires KES ${totalDeducted.toLocaleString()} from your balance (including KES ${withdrawalFee} withdrawal charge). KES ${clearance.clearingBalance.toLocaleString()} is currently clearing under the standard T+2 holding period and will be ready for withdrawal on ${nextDateStr}.`,
        400
      );
    }
    throw new AppError(
      `Insufficient available balance. Available: KES ${clearance.availableBalance.toLocaleString()}, Required: KES ${totalDeducted.toLocaleString()} (including KES ${withdrawalFee} withdrawal charge).`,
      400
    );
  }

  const payoutPhone = mpesaNumber || clearance.buyerPhone;
  const payoutName = mpesaName || clearance.buyerName;

  const request = await WithdrawalService.createWithdrawalRequest({
    entityId: buyerId,
    entityType: 'buyer_refund',
    amount: withdrawalAmount,
    mpesaNumber: payoutPhone,
    mpesaName: payoutName,
    idempotencyKey: idempotencyKey || `refund-w-${buyerId}-${Date.now()}`
  });

  return {
    request,
    withdrawalFee,
    totalDeducted,
    withdrawalAmount
  };
}

export default {
  getBuyerRefundClearance,
  processBuyerRefundRequest
};
