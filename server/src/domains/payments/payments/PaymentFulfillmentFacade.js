/**
 * PaymentFulfillmentFacade — Deep Module for Payment Completion & Fulfillment Orchestration
 *
 * Implements Matt Pocock's "Deep Module" principle and Hexagonal Architecture:
 * - Small Interface: Single entry point for payment completion events.
 * - Deep Implementation: Encapsulates atomic database transactions, fraud detection,
 *   idempotent webhook handling, fulfillment state transitions, and event bus dispatching.
 */

import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import eventBus, { AppEvents } from '../../../application/events/eventBus.js';
import CorePaymentService from './CorePaymentService.js';
import {
  handlePaidOrderTransition,
  handleFailedOrderTransition
} from './paymentOrderCompletionHelper.js';
import { handleAmountMismatch } from './paymentIntegrityFraud.js';

class PaymentFulfillmentFacade {
  /**
   * Complete payment processing for an order in an atomic transaction.
   *
   * @param {object} params
   * @param {string} params.providerReference - External gateway reference (e.g. Paystack / M-Pesa)
   * @param {number|string} [params.orderId] - Optional explicit order id
   * @param {number} [params.paidAmount] - Amount confirmed by provider in KES
   * @param {object} [params.rawPayload] - Full webhook or STK callback payload
   * @param {object} [params.client] - Optional database transaction client
   * @returns {Promise<{ success: boolean, orderId: number|string, paymentId?: number, status: string, error?: string }>}
   */
  static async completePayment({
    providerReference,
    orderId = null,
    paidAmount = null,
    rawPayload = {},
    client = null
  }) {
    if (!providerReference) {
      throw new Error('providerReference is required for payment fulfillment');
    }

    const db = client || pool;
    const shouldManageTransaction = !client;
    const activeClient = shouldManageTransaction ? await pool.connect() : client;

    try {
      if (shouldManageTransaction) {
        await activeClient.query('BEGIN');
      }

      // 1. Resolve payment and order record atomically with row-level lock
      let paymentRecord = await CorePaymentService.findPaymentByProviderReference(
        providerReference,
        activeClient
      );

      // If not found by reference, probe by orderId if provided
      if (!paymentRecord && orderId) {
        const paymentRes = await activeClient.query(
          `SELECT * FROM payments WHERE order_id = $1 ORDER BY id DESC LIMIT 1 FOR UPDATE`,
          [orderId]
        );
        paymentRecord = paymentRes.rows[0] || null;
      }

      if (!paymentRecord) {
        if (shouldManageTransaction) await activeClient.query('ROLLBACK');
        logger.warn('[PaymentFulfillmentFacade] No matching payment record found', {
          providerReference,
          orderId
        });
        return {
          success: false,
          status: 'NOT_FOUND',
          error: `Payment record not found for reference ${providerReference}`
        };
      }

      const resolvedOrderId = paymentRecord.order_id || orderId;

      // 2. Lock and retrieve order
      const orderRes = await activeClient.query(
        `SELECT * FROM product_orders WHERE id = $1 FOR UPDATE`,
        [resolvedOrderId]
      );
      const order = orderRes.rows[0];

      if (!order) {
        if (shouldManageTransaction) await activeClient.query('ROLLBACK');
        return {
          success: false,
          status: 'ORDER_NOT_FOUND',
          error: `Order ${resolvedOrderId} not found`
        };
      }

      // 3. Idempotency Guard: if already PAID / COMPLETED, short-circuit gracefully
      const payStatus = String(paymentRecord.status || '').toLowerCase();
      const ordStatus = String(order.status || '').toUpperCase();
      const ordPayStatus = String(order.payment_status || '').toLowerCase();

      if (
        payStatus === 'completed' ||
        payStatus === 'paid' ||
        ordStatus === 'PAID' ||
        ordPayStatus === 'completed' ||
        ordPayStatus === 'paid'
      ) {
        if (shouldManageTransaction) await activeClient.query('COMMIT');
        logger.info('[PaymentFulfillmentFacade] Payment already completed (idempotent)', {
          orderId: resolvedOrderId,
          providerReference
        });
        return {
          success: true,
          orderId: resolvedOrderId,
          paymentId: paymentRecord.id,
          status: 'ALREADY_COMPLETED'
        };
      }

      // 4. Amount Mismatch verification (Fraud check)
      const expectedAmount = Number(order.total_amount);
      const actualAmount = paidAmount !== null ? Number(paidAmount) : Number(paymentRecord.amount);

      if (Math.abs(expectedAmount - actualAmount) > 1.0) {
        await handleAmountMismatch(activeClient, {
          paymentRow: paymentRecord,
          providerReference,
          providerStatus: 'mismatch',
          providerAmount: actualAmount,
          dbAmount: expectedAmount,
          source: 'PaymentFulfillmentFacade',
          providerPayload: rawPayload
        });
        if (shouldManageTransaction) await activeClient.query('COMMIT');
        return {
          success: false,
          orderId: resolvedOrderId,
          status: 'MANUAL_REVIEW_AMOUNT_MISMATCH',
          error: `Amount mismatch: expected ${expectedAmount}, received ${actualAmount}`
        };
      }

      // 5. Execute Atomic Transition to PAID
      const updatedPayment = await activeClient.query(
        `UPDATE payments 
         SET status = 'completed',
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [paymentRecord.id]
      );

      const transitionResult = await handlePaidOrderTransition({
        client: activeClient,
        orderId: resolvedOrderId,
        orderRow: order,
        completedAt: new Date()
      });

      if (shouldManageTransaction) {
        await activeClient.query('COMMIT');
      }

      // 6. Asynchronous Event Bus Notification
      try {
        eventBus.emit(AppEvents.PAYMENT.COMPLETED, {
          paymentId: paymentRecord.id,
          orderId: resolvedOrderId,
          amount: actualAmount,
          providerReference,
          timestamp: new Date().toISOString()
        });

        eventBus.emit(AppEvents.ORDER.PAID, {
          orderId: resolvedOrderId,
          sellerId: order.seller_id,
          buyerId: order.buyer_id,
          totalAmount: expectedAmount,
          timestamp: new Date().toISOString()
        });
      } catch (eventErr) {
        logger.warn('[PaymentFulfillmentFacade] Event dispatch warning:', eventErr);
      }

      logger.info('[PaymentFulfillmentFacade] Payment fulfillment completed successfully', {
        orderId: resolvedOrderId,
        paymentId: paymentRecord.id,
        amount: actualAmount
      });

      return {
        success: true,
        orderId: resolvedOrderId,
        paymentId: paymentRecord.id,
        status: 'COMPLETED'
      };
    } catch (err) {
      if (shouldManageTransaction) {
        try {
          await activeClient.query('ROLLBACK');
        } catch {}
      }
      logger.error('[PaymentFulfillmentFacade] Error completing payment:', err);
      throw err;
    } finally {
      if (shouldManageTransaction) {
        activeClient.release();
      }
    }
  }

  /**
   * Handle payment failure event idempotently.
   */
  static async handlePaymentFailure({
    providerReference,
    orderId = null,
    reason = 'Provider transaction failed',
    rawPayload = {},
    client = null
  }) {
    const shouldManageTransaction = !client;
    const activeClient = shouldManageTransaction ? await pool.connect() : client;

    try {
      if (shouldManageTransaction) await activeClient.query('BEGIN');

      let paymentRecord = await CorePaymentService.findPaymentByProviderReference(
        providerReference,
        activeClient
      );

      if (!paymentRecord && orderId) {
        const paymentRes = await activeClient.query(
          `SELECT * FROM payments WHERE order_id = $1 ORDER BY id DESC LIMIT 1 FOR UPDATE`,
          [orderId]
        );
        paymentRecord = paymentRes.rows[0] || null;
      }

      if (!paymentRecord) {
        if (shouldManageTransaction) await activeClient.query('ROLLBACK');
        return { success: false, status: 'NOT_FOUND' };
      }

      const resolvedOrderId = paymentRecord.order_id || orderId;

      await activeClient.query(
        `UPDATE payments 
         SET status = 'failed',
             updated_at = NOW()
         WHERE id = $1`,
        [paymentRecord.id]
      );

      if (resolvedOrderId) {
        await handleFailedOrderTransition({
          client: activeClient,
          orderId: resolvedOrderId,
          paymentRow: paymentRecord,
          source: 'PaymentFulfillmentFacade',
          providerStatus: 'failed'
        });
      }

      if (shouldManageTransaction) await activeClient.query('COMMIT');

      eventBus.emit(AppEvents.PAYMENT.FAILED, {
        paymentId: paymentRecord.id,
        orderId: resolvedOrderId,
        reason,
        providerReference
      });

      return { success: true, status: 'FAILED', orderId: resolvedOrderId };
    } catch (err) {
      if (shouldManageTransaction) {
        try { await activeClient.query('ROLLBACK'); } catch {}
      }
      throw err;
    } finally {
      if (shouldManageTransaction) activeClient.release();
    }
  }
}

export default PaymentFulfillmentFacade;
