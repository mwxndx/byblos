import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import Fees from '../../../shared/config/fees.js';
import { OrderStatus, ProductType, OrderType } from '../../../shared/constants/enums.js';
import Order from './order.model.js';
import Buyer from '../../commerce/buyers/buyer.model.js';
import escrowManager from '../escrow/EscrowManager.js';
import { assertValidTransition } from '../../../shared/utils/OrderStatusGuard.js';
import { assertOrderStatusUpdateAuthorized } from './orderStatusUpdatePolicy.js';
import domainEventDispatcher, { AppEvents, DomainEvents } from '../../../shared/core/domainEventDispatcher.js';
const eventBus = domainEventDispatcher;
import InventoryReservationService from '../../commerce/products/inventoryReservation.service.js';
import OrderReadService from './orderRead.service.js';
import { executeExceptionalReversalHelper } from './orderReversalHelper.js';
import {
  parseOrderMetadata,
  isPaidOrder,
  isPhysicalOnlineOrder,
  hasActivePickup,
  hasBuyerDoorDelivery,
  generateOrderNumber
} from './orderPredicates.js';

export class OrderService {
  static async updateOrderStatus(orderId, user, status) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query('SELECT * FROM product_orders WHERE id = $1 FOR UPDATE', [orderId]);
      if (orderRes.rows.length === 0) {
        throw new Error('Order not found');
      }
      const currentOrder = orderRes.rows[0];
      // Broken-access-control fix: this generic endpoint never verified the
      // caller owned the order, and let anyone drive an order to COMPLETED
      // (skipping escrow release). Enforce owner/admin + block money-terminal
      // states, which must go through their dedicated handlers.
      assertOrderStatusUpdateAuthorized(user, currentOrder, status);
      assertValidTransition(currentOrder.status, status);

      const updateRes = await client.query(
        'UPDATE product_orders SET status = $1::order_status, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, orderId]
      );
      const updatedOrder = updateRes.rows[0];

      await client.query('COMMIT');
      OrderService._emitOrderUpdate(orderId, currentOrder.status, status, 'Status update', user.id);
      return updatedOrder;
    } catch (err) {
      await client.query('ROLLBACK').catch(rErr => logger.error('Rollback failed:', rErr));
      throw err;
    } finally {
      client.release();
    }
  }

  // Seller confirms a (service) booking: PAID/AWAITING_SELLER_ACTION/BOOKED -> FULFILLING.
  // Restored against product_orders + the current OrderStatusGuard.
  static async confirmBooking(orderId, sellerId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT * FROM product_orders WHERE id = $1 AND seller_id = $2 FOR UPDATE',
        [orderId, sellerId]
      );
      if (rows.length === 0) throw new Error('Order not found or unauthorized seller');
      const order = rows[0];
      assertValidTransition(order.status, OrderStatus.FULFILLING);
      const upd = await client.query(
        'UPDATE product_orders SET status = $1::order_status, updated_at = NOW() WHERE id = $2 RETURNING *',
        [OrderStatus.FULFILLING, orderId]
      );
      await client.query('COMMIT');
      OrderService._emitOrderUpdate(orderId, order.status, OrderStatus.FULFILLING, 'Seller confirmed booking', sellerId);
      return upd.rows[0];
    } catch (err) {
      await client.query('ROLLBACK').catch((rErr) => logger.error('[confirmBooking] Rollback failed:', rErr));
      throw err;
    } finally {
      client.release();
    }
  }

  // Buyer confirms receipt/collection: READY_FOR_BUYER/DELIVERED/FULFILLED -> COMPLETED.
  // Per the authoritative rule, the BUYER's confirmation marks completion (for both
  // delivery and collection); completion fires the payout trigger. Mzigo does not complete.
  static async _buyerComplete(orderId, buyerId, note) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT * FROM product_orders WHERE id = $1 AND buyer_id = $2 FOR UPDATE',
        [orderId, buyerId]
      );
      if (rows.length === 0) {
        const { AppError } = await import('../../../shared/utils/errorHandler.js');
        throw new AppError('Order not found or unauthorized buyer', 404, 'ORDER_NOT_FOUND');
      }
      const order = rows[0];
      assertValidTransition(order.status, OrderStatus.COMPLETED, orderId);

      const completionMetadata = {
        completed_by: 'buyer',
        completion_reason: 'buyer_confirmation',
        financial_finality: true,
        confirmed_at: new Date().toISOString()
      };

      const upd = await client.query(
        `UPDATE product_orders 
         SET status = $1::order_status, 
             completed_at = NOW(), 
             updated_at = NOW(),
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
         WHERE id = $2 
         RETURNING *`,
        [OrderStatus.COMPLETED, orderId, JSON.stringify(completionMetadata)]
      );
      const completedOrder = upd.rows[0];

      await escrowManager.releaseFunds(client, completedOrder, 'BuyerConfirmation');

      await client.query('COMMIT');
      OrderService._emitOrderUpdate(orderId, order.status, OrderStatus.COMPLETED, note, buyerId);
      return completedOrder;
    } catch (err) {
      await client.query('ROLLBACK').catch((rErr) => logger.error('[buyerComplete] Rollback failed:', rErr));
      throw err;
    } finally {
      client.release();
    }
  }

  static async confirmOrderReceipt(orderId, buyerId) {
    return OrderService._buyerComplete(orderId, buyerId, 'Buyer confirmed receipt');
  }

  static async markAsCollected(orderId, buyerId) {
    return OrderService._buyerComplete(orderId, buyerId, 'Buyer collected order');
  }

  // System backstop (48h): Mzigo confirmed the buyer has the package
  // (delivered/collected) but the buyer never tapped confirm. Auto-complete to
  // the seller. Mirrors _buyerComplete but is system-initiated (no buyer scope)
  // and refuses to complete when escrow release is blocked by a logistics hold,
  // leaving the order for manual review rather than marking it COMPLETED with
  // funds stranded.
  static async autoCompleteAfterHandoffTimeout(orderId, reason = 'buyer_confirmation_timeout_48h') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT * FROM product_orders WHERE id = $1 FOR UPDATE', [orderId]);
      if (rows.length === 0) throw new Error('Order not found');
      const order = rows[0];
      if (order.status === OrderStatus.COMPLETED) {
        await client.query('ROLLBACK');
        return order; // already completed (e.g. buyer confirmed first) — idempotent
      }
      assertValidTransition(order.status, OrderStatus.COMPLETED, orderId);

      const completionMetadata = {
        completed_by: 'system',
        completion_reason: reason,
        financial_finality: true,
        auto_completed_at: new Date().toISOString(),
      };
      const upd = await client.query(
        `UPDATE product_orders
            SET status = $1::order_status,
                completed_at = NOW(),
                updated_at = NOW(),
                metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
          WHERE id = $2
          RETURNING *`,
        [OrderStatus.COMPLETED, orderId, JSON.stringify(completionMetadata)]
      );
      const completedOrder = upd.rows[0];

      const release = await escrowManager.releaseFunds(client, completedOrder, 'AutoHandoffTimeout');
      if (release && release.success === false) {
        await client.query('ROLLBACK');
        logger.warn(`[autoComplete] Order ${orderId} not auto-completed; escrow release blocked: ${release.reason}`);
        return null;
      }

      await client.query('COMMIT');
      OrderService._emitOrderUpdate(orderId, order.status, OrderStatus.COMPLETED, reason, null);
      return completedOrder;
    } catch (err) {
      await client.query('ROLLBACK').catch(rErr => logger.error('[autoComplete] Rollback failed:', rErr));
      throw err;
    } finally {
      client.release();
    }
  }

  // Cancellation delegates to the (previously orphaned) OrderCancellationService,
  // which cancels on product_orders and refunds the buyer when already paid.
  // order.controller cancelOrder/sellerCancelOrder call OrderService.cancelOrder,
  // which was missing after the refactor (runtime TypeError → cancellation broken).
  static async cancelOrder(orderId, reason = null) {
    const { default: OrderCancellationService } = await import('./orderCancellation.service.js');
    return OrderCancellationService.cancelOrder(orderId, reason);
  }

  /**
   * Exceptional administrative reversal of an order (even after completion).
   * Authorized strictly for admins to handle fraud, chargebacks, legal disputes, etc.
   * Performs complete accounting reversal across Buyer, Seller, Creator, and Platform allocations.
   */
  static async executeExceptionalReversal(orderId, adminUser, reason, notes = null) {
    return executeExceptionalReversalHelper({
      pool,
      orderId,
      adminUser,
      reason,
      notes,
      emitOrderUpdate: OrderService._emitOrderUpdate
    });
  }

  static _parseMetadata(metadata) {
    return parseOrderMetadata(metadata);
  }

  static _isPaidOrder(order) {
    return isPaidOrder(order);
  }

  static _isPhysicalOnlineOrder(order) {
    return isPhysicalOnlineOrder(order);
  }

  static _hasActivePickup(order) {
    return hasActivePickup(order);
  }

  static _hasBuyerDoorDelivery(order) {
    return hasBuyerDoorDelivery(order);
  }

  static async _emitOrderUpdate(orderId, oldStatus, newStatus, notes, source) {
    try {
      eventBus.emit(AppEvents.ORDER.UPDATED, {
        payload: { id: orderId, order_id: orderId, oldStatus, newStatus, notes, source }
      });
    } catch (err) {
      logger.error('Failed to emit order update event:', err);
    }
  }

  static async _generateOrderNumber(client = pool) {
    return generateOrderNumber(client);
  }
}

export default OrderService;
