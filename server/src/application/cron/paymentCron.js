/**
 * paymentCron.js
 *
 * Active payment recovery behavior is intentionally narrow:
 * - PaymentService.processPendingPayments claims rows with FOR UPDATE SKIP LOCKED.
 *
 * - Provider success/failure delegates to CorePaymentService.completeVerifiedPayment.
 * - CorePaymentService updates payment/order state and enqueues fulfillment in one transaction.
 * - The fulfillment repair cron below only re-enqueues through FulfillmentQueueService.
 */

// @ts-check
'use strict';

import cron from 'node-cron';
import logger from '../../shared/utils/logger.js';
import PaymentService from '../../domains/payments/payments/payment.service.js';
import { pool } from '../../infrastructure/database/database.js';
import FulfillmentQueueService from '../../domains/orders/fulfillment/fulfillmentQueue.service.js';

/**
 * @typedef {Object} CronOptions
 * @property {string} [schedule]
 * @property {number} [hoursAgo]
 * @property {number} [limit]
 */

/**
 * @param {CronOptions} [options]
 */
const schedulePaymentProcessing = (options = {}) => {
  const schedule = options.schedule || '*/5 * * * *';
  const hoursAgo = options.hoursAgo || 24;
  const limit = options.limit || 50;

  logger.info(`Scheduling payment processing cron job with schedule: ${schedule}`);

  return cron.schedule(schedule, async () => {
    const startTime = Date.now();
    const jobId = `payment-process-${startTime}`;

    logger.info(`[${jobId}] Starting payment processing job`);

    try {
      const result = await PaymentService.processPendingPayments(hoursAgo, limit);
      const duration = (Date.now() - startTime) / 1000;

      if (result.processedCount > 0) {
        logger.info(`[${jobId}] Payment processing completed in ${duration.toFixed(2)}s`, {
          processed: result.processedCount,
          successful: result.successCount,
          failed: result.errorCount,
          duration: `${duration.toFixed(2)}s`
        });
      }

      return result;
    } catch (err) {
      const error = /** @type {Error} */ (err);
      const duration = (Date.now() - startTime) / 1000;
      logger.error(`[${jobId}] Payment processing job failed after ${duration.toFixed(2)}s`, {
        error: error.message,
        stack: error.stack,
        duration: `${duration.toFixed(2)}s`
      });
      throw error;
    }
  }, {
    timezone: 'Africa/Nairobi'
  });
};

/**
 * P1-1 FIX: Unified fulfillment-retry cron.
 * Repairs paid orders that need fulfillment by enqueueing fulfillment jobs.
 * Both keys are checked for backward compatibility with the legacy path.
 *
 * @param {Object} [options]
 * @param {string} [options.schedule]
 */
const scheduleFulfillmentRetry = (options = {}) => {
  const schedule = options.schedule || '*/2 * * * *';

  return cron.schedule(schedule, async () => {
    const jobId = `fulfillment-retry-${Date.now()}`;
    try {
      // P1-1: Check BOTH keys for backward compat during the transition period
      const { rows } = await pool.query(
        `SELECT p.id, (p.metadata->>'order_id')::int AS order_id
         FROM payments p
         WHERE status = 'completed'
           AND (
             metadata->>'needs_fulfillment' = 'true'
             OR metadata->>'needs_completion' = 'true'
           )
           AND metadata->>'order_id' IS NOT NULL
           AND updated_at > NOW() - INTERVAL '24 hours'
         ORDER BY updated_at ASC
         LIMIT 20`
      );

      if (rows.length === 0) return;
      logger.info(`[${jobId}] Found ${rows.length} payment(s) needing fulfillment retry`);

      const retrySinglePayment = async (payment) => {
        let claimed = false;
        try {
          const { rowCount } = await pool.query(
            `UPDATE payments
             SET metadata = metadata - 'needs_fulfillment' - 'needs_completion'
             WHERE id = $1
               AND (metadata->>'needs_fulfillment' = 'true' OR metadata->>'needs_completion' = 'true')`,
            [payment.id]
          );
          claimed = rowCount === 1;
        } catch (err) {
          const e = /** @type {Error} */ (err);
          logger.error(`[${jobId}] Claim failed for payment ${payment.id}:`, e.message);
          return;
        }
        if (!claimed) return;

        try {
          await FulfillmentQueueService.enqueue(null, payment.order_id);
          logger.info(`[${jobId}] Successfully retried fulfillment for payment ${payment.id}`);
        } catch (err) {
          const e = /** @type {Error} */ (err);
          await pool.query(
            `UPDATE payments
             SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"needs_fulfillment":"true"}'::jsonb
             WHERE id = $1`,
            [payment.id]
          ).catch(() => {});
          logger.error(`[${jobId}] Retry failed for payment ${payment.id}:`, e.message);
        }
      };

      await Promise.all(rows.map(retrySinglePayment));
    } catch (err) {
      const e = /** @type {Error} */ (err);
      logger.error(`[${jobId}] Cron query error:`, e.message);
    }
  }, { timezone: 'Africa/Nairobi' });
};

export { schedulePaymentProcessing, scheduleFulfillmentRetry };



