import logger from '../../../shared/utils/logger.js';
import { reportAlert } from '../../../shared/utils/alerting.js';

/**
 * Recognized Payment Purposes in Byblos.
 * Reflects genuine active business payment flows in the application.
 * @readonly
 * @enum {string}
 */
export const PaymentPurpose = Object.freeze({
  ORDER_CHECKOUT: 'order_checkout',
  SELLER_PICKUP_FEE: 'seller_pickup_fee'
});

/**
 * Declares the refundability policy per payment purpose for order cancellations and refunds.
 * - true: counts towards buyer's captured refundable balance on order cancellation/refund.
 * - false: auxiliary/non-order payment that must not be refunded to the buyer on order cancellation.
 */
export const PAYMENT_PURPOSE_REFUNDABILITY = Object.freeze({
  [PaymentPurpose.ORDER_CHECKOUT]: true,
  [PaymentPurpose.SELLER_PICKUP_FEE]: false
});

/**
 * Normalizes and validates a payment purpose string.
 * @param {string|null|undefined} purpose
 * @returns {string|null} Normalized purpose string, or null if empty/absent.
 */
export function normalizePaymentPurpose(purpose) {
  if (!purpose || typeof purpose !== 'string') return null;
  const trimmed = purpose.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Extracts normalized payment purpose from a payment row's metadata.
 * Inspects both `payment_purpose` and legacy `logistics_payment_type`.
 * Fails closed by returning sentinel values ('malformed_metadata', 'invalid_metadata', 'invalid_purpose')
 * when metadata is corrupted or non-conforming, so isPaymentPurposeRefundable can alert and fail closed.
 * Only genuine absent metadata (null/undefined/empty object) returns null (representing supported legacy checkout rows).
 * @param {object|string|null} metadata
 * @returns {string|null}
 */
export function extractPaymentPurpose(metadata) {
  if (metadata === null || metadata === undefined) return null;

  let parsed = metadata;
  if (typeof metadata === 'string') {
    const trimmed = metadata.trim();
    if (trimmed.length === 0) return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return 'malformed_metadata';
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return 'invalid_metadata';
  }

  // Check if payment_purpose was explicitly provided
  if ('payment_purpose' in parsed) {
    if (typeof parsed.payment_purpose !== 'string' || !parsed.payment_purpose.trim()) {
      return 'invalid_purpose';
    }
    return normalizePaymentPurpose(parsed.payment_purpose);
  }

  // Check legacy logistics_payment_type
  if ('logistics_payment_type' in parsed) {
    if (typeof parsed.logistics_payment_type !== 'string' || !parsed.logistics_payment_type.trim()) {
      return 'invalid_purpose';
    }
    return normalizePaymentPurpose(parsed.logistics_payment_type);
  }

  // Object without purpose fields (supported legacy records e.g. {} or { source: 'web' })
  return null;
}

/**
 * Determines whether a given payment purpose is refundable under order-cancellation accounting.
 *
 * Rules:
 * 1. Absent or empty purpose (null): Recognized as legacy checkout row -> REFUNDABLE.
 * 2. Recognized purposes: Governed by PAYMENT_PURPOSE_REFUNDABILITY map.
 * 3. Unknown non-empty purposes: Fails closed -> NON-REFUNDABLE, and triggers alert/warning.
 *
 * @param {string|null} purpose
 * @param {object} [context] Optional debugging context for alerting (orderId, paymentId)
 * @returns {boolean}
 */
export function isPaymentPurposeRefundable(purpose, context = {}) {
  const normalized = normalizePaymentPurpose(purpose);

  // Legacy checkout rows without an explicit payment_purpose are treated as standard order checkout payments.
  if (normalized === null) {
    return true;
  }

  // Declared purpose lookup
  if (Object.prototype.hasOwnProperty.call(PAYMENT_PURPOSE_REFUNDABILITY, normalized)) {
    return PAYMENT_PURPOSE_REFUNDABILITY[normalized];
  }

  // Unknown non-empty purpose: fail-closed (non-refundable for order cancellation) and alert.
  // Alert delivery is fully isolated so alert failure never breaks accounting decisions.
  try {
    logger.warn('[PAYMENT_PURPOSE_POLICY] Unknown payment purpose detected during refund accounting', {
      purpose: normalized,
      ...context
    });

    reportAlert({
      level: 'warn',
      title: 'Unknown Payment Purpose in Refund Accounting',
      message: `Payment purpose "${normalized}" is not registered in PAYMENT_PURPOSE_REFUNDABILITY. Failing closed (non-refundable).`,
      context: { purpose: normalized, ...context }
    });
  } catch (alertErr) {
    try {
      logger.error?.('[PAYMENT_PURPOSE_POLICY] Failed to emit alert for unknown payment purpose', {
        purpose: normalized,
        error: alertErr?.message,
        ...context
      });
    } catch {
      // Intentionally ignore secondary logging failures
    }
  }

  return false;
}

export default {
  PaymentPurpose,
  PAYMENT_PURPOSE_REFUNDABILITY,
  normalizePaymentPurpose,
  extractPaymentPurpose,
  isPaymentPurposeRefundable
};
