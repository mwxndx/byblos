import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';

export const REFUND_POLICY_CONSTANTS = {
  MAX_AUTO_REFUND_AMOUNT: 1500, // Maximum KES for automated low-value refund
  MAX_MONTHLY_BUYER_REFUNDS: 2, // Maximum auto-refunds permitted per buyer in 30 days
  POLICY_VERSION: 'v1.0'
};

const UNFULFILLED_STATUSES = new Set(['CREATED', 'PAYMENT_PENDING', 'CANCELLED', 'FAILED', 'EXPIRED']);
const RMA_REQUIRED_STATUSES = new Set(['IN_TRANSIT', 'DELIVERED', 'COMPLETED']);

export class RefundPolicyService {
  /**
   * Pure evaluation of policy rules against order and buyer context.
   *
   * @param {object} params
   * @param {object} [params.order]
   * @param {number|string} params.amount
   * @param {string} [params.reason]
   * @param {object} [params.payout]
   * @param {number} [params.buyerPastRefundCount=0]
   * @returns {{decision: 'AUTO_APPROVE'|'MANUAL_REVIEW', reason: string, policyVersion: string}}
   */
  evaluatePolicyRules({
    order,
    amount,
    reason = '',
    payout = null,
    buyerPastRefundCount = 0
  }) {
    const numAmount = Number.parseFloat(amount);
    const orderStatus = String(order?.status || '').toUpperCase();

    // 1. Clear-cut Case: Late payment capture on unfulfilled / cancelled / expired orders
    if (reason === 'late_payment_on_cancelled_order') {
      const isSettled = payout?.status === 'completed' || payout?.settlement_status === 'settled';
      if (isSettled) {
        return {
          decision: 'MANUAL_REVIEW',
          reason: 'Seller payout has already settled; manual clawback review required',
          policyVersion: REFUND_POLICY_CONSTANTS.POLICY_VERSION
        };
      }

      if (!orderStatus || UNFULFILLED_STATUSES.has(orderStatus)) {
        return {
          decision: 'AUTO_APPROVE',
          reason: 'Late payment received for unfulfilled cancelled order',
          policyVersion: REFUND_POLICY_CONSTANTS.POLICY_VERSION
        };
      }

      // If the order somehow advanced to physical fulfillment, require manual triage
      return {
        decision: 'MANUAL_REVIEW',
        reason: `Late payment arrived while order is in state ${orderStatus}`,
        policyVersion: REFUND_POLICY_CONSTANTS.POLICY_VERSION
      };
    }

    // 2. Post-fulfillment / Physical return guardrail
    if (RMA_REQUIRED_STATUSES.has(orderStatus)) {
      return {
        decision: 'MANUAL_REVIEW',
        reason: 'Order is in transit or delivered; requires physical return and RMA inspection',
        policyVersion: REFUND_POLICY_CONSTANTS.POLICY_VERSION
      };
    }

    // 3. Disbursed escrow guardrail
    if (payout?.settlement_status === 'settled' || payout?.status === 'completed') {
      return {
        decision: 'MANUAL_REVIEW',
        reason: 'Seller settlement has already disbursed; manual platform intervention required',
        policyVersion: REFUND_POLICY_CONSTANTS.POLICY_VERSION
      };
    }

    // 4. Value ceiling guardrail
    if (numAmount > REFUND_POLICY_CONSTANTS.MAX_AUTO_REFUND_AMOUNT) {
      return {
        decision: 'MANUAL_REVIEW',
        reason: `Requested amount (${numAmount} KES) exceeds auto-approval ceiling of ${REFUND_POLICY_CONSTANTS.MAX_AUTO_REFUND_AMOUNT} KES`,
        policyVersion: REFUND_POLICY_CONSTANTS.POLICY_VERSION
      };
    }

    // 5. Anti-fraud velocity guardrail
    if (buyerPastRefundCount >= REFUND_POLICY_CONSTANTS.MAX_MONTHLY_BUYER_REFUNDS) {
      return {
        decision: 'MANUAL_REVIEW',
        reason: `Buyer refund velocity threshold reached (${buyerPastRefundCount} refunds in 30 days)`,
        policyVersion: REFUND_POLICY_CONSTANTS.POLICY_VERSION
      };
    }

    // 6. Low-value, pre-fulfillment clear-cut case
    return {
      decision: 'AUTO_APPROVE',
      reason: 'Low-value unfulfilled order within standard risk thresholds',
      policyVersion: REFUND_POLICY_CONSTANTS.POLICY_VERSION
    };
  }

  /**
   * Evaluates refund policy against database state for an order and buyer.
   *
   * @param {import('pg').PoolClient|import('pg').Pool} executor
   * @param {object} params
   * @param {number|string} [params.orderId]
   * @param {number|string} params.buyerId
   * @param {number|string} params.amount
   * @param {string} [params.reason]
   * @returns {Promise<{decision: 'AUTO_APPROVE'|'MANUAL_REVIEW', reason: string, policyVersion: string}>}
   */
  async evaluateRefundEligibility(executor = pool, {
    orderId,
    buyerId,
    amount,
    reason = ''
  }) {
    try {
      let order = null;
      let payout = null;

      if (orderId) {
        const orderResult = await executor.query(
          `SELECT id, status, payment_status, total_amount, order_type
           FROM product_orders
           WHERE id = $1`,
          [orderId]
        );
        order = orderResult.rows[0] || null;

        const payoutResult = await executor.query(
          `SELECT id, status, settlement_status
           FROM payouts
           WHERE order_id = $1`,
          [orderId]
        );
        payout = payoutResult.rows[0] || null;
      }

      // Check buyer 30-day completed refund count
      let buyerPastRefundCount = 0;
      if (buyerId) {
        const countResult = await executor.query(
          `SELECT COUNT(*)::int as count
           FROM refund_requests
           WHERE buyer_id = $1
             AND status = 'completed'
             AND requested_at >= NOW() - INTERVAL '30 days'`,
          [buyerId]
        );
        buyerPastRefundCount = countResult.rows[0]?.count || 0;
      }

      return this.evaluatePolicyRules({
        order,
        amount,
        reason,
        payout,
        buyerPastRefundCount
      });
    } catch (err) {
      logger.error('[RefundPolicyService] Error evaluating refund eligibility:', err);
      // Fallback safely to manual review if policy check errors
      return {
        decision: 'MANUAL_REVIEW',
        reason: `Policy check error (${err.message}); routing to admin review`,
        policyVersion: REFUND_POLICY_CONSTANTS.POLICY_VERSION
      };
    }
  }
}

export default new RefundPolicyService();
