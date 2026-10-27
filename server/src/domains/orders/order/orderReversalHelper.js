import logger from '../../../shared/utils/logger.js';
import { OrderStatus, OrderType } from '../../../shared/constants/enums.js';
import eventBus, { AppEvents } from '../../../application/events/eventBus.js';
import InventoryReservationService from '../../commerce/products/inventoryReservation.service.js';
import refundAccountingService from '../../payments/refunds/refundAccounting.service.js';

export const executeExceptionalReversalHelper = async ({
  pool,
  orderId,
  adminUser,
  reason,
  notes = null,
  emitOrderUpdate
}) => {
  const { AppError } = await import('../../../shared/utils/errorHandler.js');
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw new AppError(
      'A valid administrative reason (minimum 5 characters) is required for exceptional reversal.',
      400,
      'INVALID_REVERSAL_REASON'
    );
  }

  const { default: settlementService } = await import('../escrow/settlement.service.js');
  const client = await pool.connect();
  let reversedEventId = null;

  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );

    if (orderRows.length === 0) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    const order = orderRows[0];

    if (order.status === OrderStatus.REFUNDED) {
      throw new AppError('Order is already refunded', 400, 'ORDER_ALREADY_REFUNDED');
    }

    const previousStatus = order.status;
    const accounting = await refundAccountingService.getOrderRefundAccounting(client, orderId);
    const refundAmount = accounting.remainingBalanceBeforePending;

    // 1. Buyer Refund: Credit buyer refund balance if order has captured refundable balance
    let buyerRefundResult = null;
    if (accounting.capturedAmount > 0 && refundAmount > 0) {
      let buyerRefunded = false;
      if (order.buyer_id) {
        await client.query(
          `UPDATE buyers 
           SET refunds = COALESCE(refunds, 0) + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [refundAmount, order.buyer_id]
        );
        buyerRefundResult = { refunded: true, amount: refundAmount, buyer_id: order.buyer_id };
        buyerRefunded = true;
      } else if (order.buyer_email) {
        const { rows: bRows } = await client.query(
          `UPDATE buyers 
           SET refunds = COALESCE(refunds, 0) + $1,
               updated_at = NOW()
           WHERE LOWER(email) = LOWER($2)
           RETURNING id`,
          [refundAmount, order.buyer_email]
        );
        if (bRows.length > 0) {
          buyerRefundResult = { refunded: true, amount: refundAmount, buyer_id: bRows[0].id };
          buyerRefunded = true;
        } else {
          await client.query(
            `UPDATE product_orders
             SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('uncredited_refund_amount', $2::numeric)
             WHERE id = $1`,
            [orderId, refundAmount]
          );
          buyerRefundResult = { refunded: false, pending_account_creation: true, amount: refundAmount };
        }
      }

      // Authoritative ledger entry in refund_requests
      const creditDetails = {
        credited_to_buyer: buyerRefunded,
        credited_amount: refundAmount,
        execution_source: 'admin_exceptional_reversal',
        admin_id: adminUser?.id || null,
        reason: reason.trim(),
        credited_at: new Date().toISOString()
      };

      await client.query(
        `INSERT INTO refund_requests (
           buyer_id, order_id, amount, status, notes, admin_notes, payment_method, payment_details, requested_at, processed_at
         ) VALUES ($1, $2, $3, 'completed', $4, $5, 'wallet', $6::jsonb, NOW(), NOW())`,
        [
          order.buyer_id || null,
          orderId,
          refundAmount,
          reason.trim(),
          `Admin exceptional reversal by ${adminUser?.email || adminUser?.id || 'admin'}: ${notes || reason}`,
          JSON.stringify(creditDetails)
        ]
      );
    }

    // 2. Seller Settlement Reversal
    const sellerReversalResult = await settlementService.reverseOrderSettlementForRefund(
      client,
      orderId,
      'admin_exceptional_reversal',
      refundAmount,
      accounting.capturedAmount
    );

    // 3. Creator Commission & Referral Reversal (with Deficit Protection)
    const creatorReversalResult = await settlementService.reverseCreatorEarningsForRefund(
      client,
      orderId,
      'admin_exceptional_reversal',
      refundAmount,
      accounting.capturedAmount
    );

    // 4. Release slots / reservations if applicable
    if (order.order_type === OrderType.SERVICE) {
      await client.query(
        `UPDATE service_slots 
         SET status = 'AVAILABLE', reserved_by_order_id = NULL, expires_at = NULL, updated_at = NOW()
         WHERE reserved_by_order_id = $1`,
        [orderId]
      );
    } else if (order.order_type === OrderType.PHYSICAL) {
      try {
        await InventoryReservationService.releaseOrderInventory(client, orderId);
      } catch (invErr) {
        logger.warn(`[ExceptionalReversal] Inventory release skipped or not needed for Order ${orderId}:`, invErr.message);
      }
    }

    // Invalidate any open pending or manual-review refund requests on this reversed order
    await client.query(
      `UPDATE refund_requests
       SET status = 'rejected',
           admin_notes = 'Auto-rejected: order reversed by admin',
           updated_at = NOW()
       WHERE order_id = $1 AND status IN ('pending', 'manual_review')`,
      [orderId]
    );

    // 5. Update Order Status to REFUNDED with audit metadata
    const reversalAudit = {
      exceptional_reversal: true,
      reversal_type: 'ADMIN_EXCEPTIONAL_REVERSAL',
      reversed_at: new Date().toISOString(),
      admin_id: adminUser?.id || null,
      admin_email: adminUser?.email || 'admin',
      reason: reason.trim(),
      notes: notes || null,
      previous_status: previousStatus,
      financial_summary: {
        buyer_refund: buyerRefundResult,
        seller_reversal: sellerReversalResult,
        creator_reversal: creatorReversalResult
      }
    };

    const { rows: updatedRows } = await client.query(
      `UPDATE product_orders 
       SET status = $1::order_status,
           cancelled_at = COALESCE(cancelled_at, NOW()),
           updated_at = NOW(),
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{exceptional_reversal}',
             $2::jsonb,
             true
           )
       WHERE id = $3
       RETURNING *`,
      [OrderStatus.REFUNDED, JSON.stringify(reversalAudit), orderId]
    );
    const updatedOrder = updatedRows[0];

    // 6. Enqueue durable domain event
    const reversedEvent = await eventBus.enqueueInTransaction(client, AppEvents.ORDER.CANCELLED, {
      eventId: `order.exceptional_reversal:${orderId}`,
      order: updatedOrder,
      cancelledBy: `admin:${adminUser?.id || 'system'}`,
      reason,
      reversalAudit
    });
    reversedEventId = reversedEvent.eventId;

    await client.query('COMMIT');

    if (reversedEventId) {
      eventBus.dispatchAfterCommit(reversedEventId, 'OrderService.executeExceptionalReversal');
    }
    if (typeof emitOrderUpdate === 'function') {
      emitOrderUpdate(orderId, previousStatus, OrderStatus.REFUNDED, `Admin exceptional reversal: ${reason}`, adminUser?.id);
    }

    logger.info(`[ExceptionalReversal] Order ${orderId} reversed by Admin ${adminUser?.id || 'admin'}. Reason: ${reason}`);

    return {
      success: true,
      order: updatedOrder,
      audit: reversalAudit
    };
  } catch (error) {
    await client.query('ROLLBACK').catch((rErr) => logger.error('[executeExceptionalReversal] Rollback failed:', rErr));
    throw error;
  } finally {
    client.release();
  }
};
