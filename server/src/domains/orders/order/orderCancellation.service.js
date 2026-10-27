import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import { OrderStatus, OrderType } from '../../../shared/constants/enums.js';
import Order from './order.model.js';
import eventBus, { AppEvents } from '../../../application/events/eventBus.js';
import InventoryReservationService from '../../commerce/products/inventoryReservation.service.js';
import settlementService from '../escrow/settlement.service.js';
import refundAccountingService from '../../payments/refunds/refundAccounting.service.js';
import { assertValidTransition } from '../utils/OrderStatusGuard.js';
import { AppError } from '../../../shared/utils/errorHandler.js';

class OrderCancellationService {
  static async cancelOrder(orderId, reason = null) {
    const client = await pool.connect();
    let cancelledEventId = null;
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }
      const order = orderResult.rows[0];

      // Invariant: Once COMPLETED, normal user-facing cancellation/refund is prohibited.
      if (order.status === OrderStatus.COMPLETED) {
        throw new AppError(
          'This order has already been confirmed and is no longer eligible for a normal refund.',
          400,
          'ORDER_FINANCIALLY_FINAL'
        );
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new AppError('Order is already cancelled', 400, 'ORDER_ALREADY_CANCELLED');
      }
      if (order.status === OrderStatus.REFUNDED) {
        throw new AppError('Order is already refunded', 400, 'ORDER_ALREADY_REFUNDED');
      }

      assertValidTransition(order.status, OrderStatus.CANCELLED, orderId);

      const updatedOrder = await Order.updateStatusWithReason(client, orderId, OrderStatus.CANCELLED, reason);

      if (updatedOrder) {
        const accounting = await refundAccountingService.getOrderRefundAccounting(client, orderId);
        const refundableAmount = accounting.remainingBalanceBeforePending;

        if (accounting.capturedAmount > 0 && refundableAmount > 0) {
          let buyerRefunded = false;
          if (order.buyer_id) {
            await client.query(
              `UPDATE buyers 
               SET refunds = COALESCE(refunds, 0) + $1,
                   updated_at = NOW()
               WHERE id = $2`,
              [refundableAmount, order.buyer_id]
            );
            buyerRefunded = true;
          } else if (order.buyer_email) {
            const { rowCount } = await client.query(
              `UPDATE buyers 
               SET refunds = COALESCE(refunds, 0) + $1,
                   updated_at = NOW()
               WHERE LOWER(email) = LOWER($2)`,
              [refundableAmount, order.buyer_email]
            );
            if (rowCount > 0) buyerRefunded = true;
          }

          // Authoritative ledger entry in refund_requests
          const creditDetails = {
            credited_to_buyer: buyerRefunded,
            credited_amount: refundableAmount,
            execution_source: 'order_cancellation',
            reason: reason || 'order_cancelled',
            credited_at: new Date().toISOString()
          };

          await client.query(
            `INSERT INTO refund_requests (
               buyer_id, order_id, amount, status, notes, admin_notes, payment_method, payment_details, requested_at, processed_at
             ) VALUES ($1, $2, $3, 'completed', $4, 'Order cancellation refund', 'wallet', $5::jsonb, NOW(), NOW())`,
            [
              order.buyer_id || null,
              orderId,
              refundableAmount,
              reason || 'Order cancelled',
              JSON.stringify(creditDetails)
            ]
          );

          const newTotalRefunded = refundAccountingService.roundMoney(accounting.completedRefunds + refundableAmount);
          const refundItem = {
            amount: refundableAmount,
            reason: reason || 'order_cancelled',
            execution_source: 'order_cancellation',
            completed_at: new Date().toISOString()
          };

          let orderMeta = {};
          if (order.metadata) {
            try {
              orderMeta = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : order.metadata;
            } catch {
              orderMeta = {};
            }
          }

          const priorHistory = Array.isArray(orderMeta?.refund_summary?.history)
            ? orderMeta.refund_summary.history
            : [];

          const refundSummary = {
            total_refunded: newTotalRefunded,
            refund_status: 'FULLY_REFUNDED',
            history: [...priorHistory, refundItem],
            updated_at: new Date().toISOString()
          };

          const updatedMetadata = {
            ...orderMeta,
            refund_summary: refundSummary,
            refund_credited: buyerRefunded ? true : false
          };

          if (!buyerRefunded) {
            updatedMetadata.uncredited_refund_amount = refundableAmount;
          }

          // Invalidate any open pending or manual-review refund requests on this cancelled order
          await client.query(
            `UPDATE refund_requests
             SET status = 'rejected',
                 admin_notes = 'Auto-rejected: order cancelled',
                 updated_at = NOW()
             WHERE order_id = $1 AND status IN ('pending', 'manual_review')`,
            [orderId]
          );

          await client.query(
            `UPDATE product_orders
             SET metadata = $2::jsonb,
                 payment_status = 'cancelled'::payment_status
             WHERE id = $1`,
            [orderId, JSON.stringify(updatedMetadata)]
          );

          await settlementService.reverseOrderSettlementForRefund(
            client,
            orderId,
            'order_cancellation',
            refundableAmount,
            accounting.capturedAmount
          );
          // Defence-in-depth, symmetric with the refund/reversal paths. Today this
          // is a no-op: creator earnings are only created at escrow release
          // (EscrowManager.releaseFunds -> creditCreatorForOrder), which fires on
          // COMPLETION, and a COMPLETED order cannot reach here (guarded above).
          // Kept so the invariant is enforced, not merely assumed, if creator
          // crediting ever moves earlier (e.g. to payment time). Safe when there
          // is nothing to reverse — it only acts on 'credited' earnings.
          await settlementService.reverseCreatorEarningsForRefund(
            client,
            orderId,
            'order_cancellation',
            refundableAmount,
            accounting.capturedAmount
          );
        }

        if (order.order_type === OrderType.SERVICE) {
          await client.query(
            `UPDATE service_slots 
             SET status = 'AVAILABLE', reserved_by_order_id = NULL, expires_at = NULL, updated_at = NOW()
             WHERE reserved_by_order_id = $1`,
            [orderId]
          );
          logger.info(`[SLOT-RELEASE] Released slot for cancelled Order ${orderId}`);
        }

        const statusForRelease = String(order.status || '').toUpperCase();
        const canReleaseInventory = ['CREATED', 'RESERVED', 'HELD', 'PAYMENT_PENDING', 'FAILED', 'EXPIRED'].includes(statusForRelease);
        if (order.order_type === OrderType.PHYSICAL && canReleaseInventory) {
          await InventoryReservationService.releaseOrderInventory(client, orderId);
        } else if (order.order_type === OrderType.PHYSICAL) {
          logger.warn(`[RESERVATION-RELEASE] Skipped inventory release for Order ${orderId} in status ${order.status}`);
        }

        const cancelledEvent = await eventBus.enqueueInTransaction(client, AppEvents.ORDER.CANCELLED, {
          eventId: `order.cancelled:${orderId}`,
          order: updatedOrder,
          cancelledBy: reason || 'system',
          reason
        });
        cancelledEventId = cancelledEvent.eventId;
      }

      await client.query('COMMIT');
      if (cancelledEventId) {
        eventBus.dispatchAfterCommit(cancelledEventId, 'OrderCancellationService.cancelOrder');
      }
      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK').catch(rollbackError =>
        logger.error('[OrderCancellationService] Rollback failed:', rollbackError)
      );
      throw error;
    } finally {
      client.release();
    }
  }
}

export default OrderCancellationService;
