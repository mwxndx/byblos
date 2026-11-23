import logger from '../../../shared/utils/logger.js';
import { AppError } from '../../../shared/utils/errorHandler.js';
import {
  extractPaymentPurpose,
  isPaymentPurposeRefundable
} from '../payments/paymentPurpose.policy.js';

/**
 * Normalizes monetary amounts to 2 decimal places to prevent float drift.
 * @param {number|string} val
 * @returns {number}
 */
export function roundMoney(val) {
  const num = typeof val === 'number' ? val : Number.parseFloat(val || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

/**
 * Returns verified captured payment amounts for a batch of orders from the payments table.
 * If no payments rows exist for an order but the order is marked 'completed', falls back to order.total_amount.
 *
 * @param {import('pg').PoolClient} client
 * @param {Array<object|number|string>} orders Array of order rows or order IDs
 * @returns {Promise<Map<string, number>>}
 */
export async function getCapturedPaymentAmountsBatch(client, orders) {
  const result = new Map();
  if (!orders || orders.length === 0) return result;

  const orderMap = new Map();
  const orderIds = [];
  const orderIdStrings = [];

  for (const ord of orders) {
    if (!ord) continue;
    const id = ord.id !== undefined ? ord.id : ord;
    const key = String(id);
    orderMap.set(key, ord);
    orderIds.push(Number(id) || id);
    orderIdStrings.push(key);
  }

  if (orderIds.length === 0) return result;

  const { rows: payRows } = await client.query(
    `SELECT 
       id,
       order_id,
       invoice_id,
       amount,
       status,
       metadata
     FROM payments
     WHERE order_id = ANY($1) OR (invoice_id IS NOT NULL AND invoice_id = ANY($2))`,
    [orderIds, orderIdStrings]
  );

  const paymentsByOrder = new Map();
  for (const pay of payRows) {
    const key = pay.order_id != null ? String(pay.order_id) : String(pay.invoice_id);
    if (!paymentsByOrder.has(key)) {
      paymentsByOrder.set(key, []);
    }
    paymentsByOrder.get(key).push(pay);
  }

  for (const [key, ord] of orderMap.entries()) {
    const pays = paymentsByOrder.get(key) || [];
    if (pays.length > 0) {
      let capturedRefundableSum = 0;
      let refundableCapturesCount = 0;
      let recognizedRefundablePaymentExists = false;

      for (const pay of pays) {
        const isCaptured = ['completed', 'success', 'paid'].includes(String(pay.status).toLowerCase());
        const purpose = extractPaymentPurpose(pay.metadata);
        const isRefundable = isPaymentPurposeRefundable(purpose, { orderId: key, paymentId: pay.id });

        if (isRefundable) {
          recognizedRefundablePaymentExists = true;
          if (isCaptured) {
            capturedRefundableSum += Number(pay.amount || 0);
            refundableCapturesCount++;
          }
        }
      }

      if (recognizedRefundablePaymentExists) {
        result.set(key, refundableCapturesCount === 0 ? 0 : roundMoney(capturedRefundableSum));
        continue;
      }

      result.set(key, 0);
      continue;
    }

    // Fallback: If no detached payments rows exist at all for this order
    const paymentStatus = typeof ord === 'object' && ord !== null ? ord.payment_status : null;
    const totalAmount = typeof ord === 'object' && ord !== null ? ord.total_amount : 0;
    if (paymentStatus && ['completed', 'paid', 'success'].includes(String(paymentStatus).toLowerCase())) {
      result.set(key, roundMoney(totalAmount));
    } else {
      result.set(key, 0);
    }
  }

  return result;
}

/**
 * Returns verified captured payment amount for an order from the payments table.
 * If no payments rows exist but the order is marked 'completed', falls back to order.total_amount
 * (for legacy fixtures and environments without detached payment rows).
 *
 * @param {import('pg').PoolClient} client
 * @param {number|string} orderId
 * @param {object} [orderRow] Optional pre-locked order row
 * @returns {Promise<number>}
 */
export async function getCapturedPaymentAmount(client, orderId, orderRow = null) {
  const order = orderRow || (await client.query(
    'SELECT id, total_amount, payment_status FROM product_orders WHERE id = $1',
    [orderId]
  )).rows[0];

  if (!order) return 0;

  const batchMap = await getCapturedPaymentAmountsBatch(client, [order]);
  return batchMap.get(String(order.id)) || 0;
}

/**
 * Authoritative accounting lookup for an order inside an active transaction.
 * Locks the product_orders row and aggregates completed and pending refunds from refund_requests.
 *
 * @param {import('pg').PoolClient} client
 * @param {number|string} orderId
 * @param {object} [options]
 * @param {number|string} [options.excludeRequestId] - Request ID to exclude from calculations (e.g. current request being executed)
 * @returns {Promise<{
 *   order: object,
 *   capturedAmount: number,
 *   completedRefunds: number,
 *   pendingRefunds: number,
 *   totalAllocated: number,
 *   availableBalance: number,
 *   remainingBalanceBeforePending: number,
 *   isLegacyCredited: boolean,
 *   isFullyRefunded: boolean
 * }>}
 */
export async function getOrderRefundAccounting(client, orderId, { excludeRequestId = null } = {}) {
  const { rows: orderRows } = await client.query(
    `SELECT id, total_amount, status, payment_status, metadata, buyer_id, buyer_email
     FROM product_orders
     WHERE id = $1
     FOR UPDATE`,
    [orderId]
  );

  if (orderRows.length === 0) {
    throw new AppError(`Order #${orderId} not found`, 404, 'ORDER_NOT_FOUND');
  }

  const order = orderRows[0];
  const capturedAmount = await getCapturedPaymentAmount(client, orderId, order);

  let orderMeta = {};
  if (order.metadata) {
    try {
      orderMeta = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : order.metadata;
    } catch {
      orderMeta = {};
    }
  }

  // Aggregate authoritative records from refund_requests
  const { rows: aggRows } = await client.query(
    `SELECT 
       COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE((payment_details->>'credited_amount')::numeric, amount) ELSE 0 END), 0) AS completed_sum,
       COALESCE(SUM(CASE WHEN status IN ('pending', 'manual_review', 'approved') THEN amount ELSE 0 END), 0) AS pending_sum,
       COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_count
     FROM refund_requests
     WHERE order_id = $1
       AND ($2::int IS NULL OR id != $2::int)`,
    [orderId, excludeRequestId]
  );

  let completedRefunds = roundMoney(aggRows[0]?.completed_sum || 0);
  const pendingRefunds = roundMoney(aggRows[0]?.pending_sum || 0);
  const completedCount = aggRows[0]?.completed_count || 0;

  // Handle legacy refund records (e.g. orders marked refund_credited or refund_summary without refund_requests rows)
  let isLegacyCredited = false;
  if (completedCount === 0) {
    if (orderMeta.refund_credited === true || order.status === 'REFUNDED') {
      isLegacyCredited = true;
      // If legacy credited flag is set, consider captured amount as already credited
      completedRefunds = Math.max(completedRefunds, capturedAmount);
    } else if (orderMeta.refund_summary?.total_refunded) {
      const metaTotal = roundMoney(orderMeta.refund_summary.total_refunded);
      if (metaTotal > completedRefunds) {
        completedRefunds = metaTotal;
      }
    }
  }

  const totalAllocated = roundMoney(completedRefunds + pendingRefunds);
  const availableBalance = Math.max(0, roundMoney(capturedAmount - totalAllocated));
  const remainingBalanceBeforePending = Math.max(0, roundMoney(capturedAmount - completedRefunds));

  return {
    order,
    capturedAmount,
    completedRefunds,
    pendingRefunds,
    totalAllocated,
    availableBalance,
    remainingBalanceBeforePending,
    isLegacyCredited,
    isFullyRefunded: completedRefunds >= capturedAmount && capturedAmount > 0
  };
}

/**
 * Validates whether a proposed refund amount can be reserved or executed for an order.
 * Throws AppError if captured amount is 0 or if the amount exceeds available balance.
 *
 * @param {import('pg').PoolClient} client
 * @param {number|string} orderId
 * @param {number} requestedAmount
 * @param {object} [options]
 * @returns {Promise<object>} Accounting summary
 */
export async function validateRefundEligibility(client, orderId, requestedAmount, options = {}) {
  const accounting = await getOrderRefundAccounting(client, orderId, options);
  const reqAmount = roundMoney(requestedAmount);

  if (reqAmount <= 0) {
    throw new AppError('Refund amount must be positive', 400);
  }

  if (accounting.capturedAmount <= 0) {
    throw new AppError(
      `Cannot refund order #${orderId}: no verified captured payment found`,
      400,
      'ORDER_NO_CAPTURED_PAYMENT'
    );
  }

  if (reqAmount > accounting.availableBalance) {
    throw new AppError(
      `Refund amount (${reqAmount}) exceeds remaining order balance (${accounting.availableBalance}) for order #${orderId}`,
      400,
      'REFUND_EXCEEDS_BALANCE'
    );
  }

  return accounting;
}

export default {
  roundMoney,
  getCapturedPaymentAmount,
  getCapturedPaymentAmountsBatch,
  getOrderRefundAccounting,
  validateRefundEligibility
};
