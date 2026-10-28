import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool } from '../src/infrastructure/database/database.js';
import { OrderStatus, OrderType } from '../src/shared/constants/enums.js';
import { assertValidTransition } from '../src/domains/orders/utils/OrderStatusGuard.js';
import { assertValidTransition as sharedAssertValidTransition } from '../src/shared/utils/OrderStatusGuard.js';
import { safeJson, normalizeOrderInput } from '../src/shared/utils/order.utils.js';
import { sanitizeOrder } from '../src/shared/utils/orderSanitizer.js';
import { releaseOrderReservations } from '../src/domains/orders/utils/reservationRelease.js';
import OrderCancellationService from '../src/domains/orders/order/orderCancellation.service.js';
import orderDeadlineService from '../src/domains/orders/order/orderDeadline.service.js';

describe('Track 5: Orders, Checkout & Fulfillment Lifecycle Domain Hardening', () => {
  let testUserId;
  let testBuyerId;
  let testSellerId;
  let testProductId;
  let testOrderIds = [];

  before(async () => {
    const email = `track5-test-${Date.now()}@byblos.test`;
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active, is_verified)
       VALUES ($1, 'hash_test_123', 'seller', true, true)
       RETURNING id`,
      [email]
    );
    testUserId = userRes.rows[0].id;

    const buyerRes = await pool.query(
      `INSERT INTO buyers (user_id, full_name, email, whatsapp_number, mobile_payment, terms_accepted, refunds)
       VALUES ($1, 'Track 5 Buyer', $2, '0712345678', '0712345678', true, 0)
       RETURNING id`,
      [testUserId, email]
    );
    testBuyerId = buyerRes.rows[0].id;

    const sellerRes = await pool.query(
      `INSERT INTO sellers (user_id, full_name, email, shop_name, whatsapp_number, terms_accepted, location, city, status)
       VALUES ($1, 'Track 5 Seller', $2, $3, '0787654321', true, 'Westlands', 'Nairobi', 'active')
       RETURNING id`,
      [testUserId, `seller-${email}`, `shop-t5-${Date.now()}`]
    );
    testSellerId = sellerRes.rows[0].id;

    const prodRes = await pool.query(
      `INSERT INTO products (seller_id, name, description, price, quantity, reserved_quantity, track_inventory, product_type, status)
       VALUES ($1, 'Track 5 Product', 'Test product', 1000, 20, 0, true, 'physical', 'available')
       RETURNING id`,
      [testSellerId]
    );
    testProductId = prodRes.rows[0].id;
  });

  after(async () => {
    if (testOrderIds.length > 0) {
      await pool.query('DELETE FROM order_items WHERE order_id = ANY($1)', [testOrderIds]);
      await pool.query('DELETE FROM payouts WHERE order_id = ANY($1)', [testOrderIds]);
      // refund_requests references buyers with ON DELETE RESTRICT
      await pool.query('DELETE FROM refund_requests WHERE order_id = ANY($1)', [testOrderIds]);
      await pool.query('DELETE FROM refund_requests WHERE buyer_id = $1', [testBuyerId]);
      await pool.query('DELETE FROM product_orders WHERE id = ANY($1)', [testOrderIds]);
    }
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = $1', [testProductId]);
    }
    if (testSellerId) {
      await pool.query('DELETE FROM sellers WHERE id = $1', [testSellerId]);
    }
    if (testBuyerId) {
      await pool.query('DELETE FROM refund_requests WHERE buyer_id = $1', [testBuyerId]);
      await pool.query('DELETE FROM buyers WHERE id = $1', [testBuyerId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  test('Action 5.1: Backward-compatible re-exports and domain locality in orders/utils', () => {
    // Both direct domain utils and shared/utils barrels point to the same functions
    assert.equal(typeof assertValidTransition, 'function');
    assert.equal(typeof sharedAssertValidTransition, 'function');
    assert.equal(assertValidTransition, sharedAssertValidTransition);

    assert.equal(typeof safeJson, 'function');
    assert.equal(typeof normalizeOrderInput, 'function');
    assert.equal(typeof sanitizeOrder, 'function');
    assert.equal(typeof releaseOrderReservations, 'function');

    // Test safeJson functionality
    assert.deepEqual(safeJson(null), {});
    assert.deepEqual(safeJson('{\"test\": true}'), { test: true });
    assert.deepEqual(safeJson('malformed'), {});
  });

  test('Action 5.1: reservationRelease executes with column pruning without SELECT *', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const token = `tok-${crypto.randomUUID()}`;
      const orderRes = await client.query(
        `INSERT INTO product_orders (\n          buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,\n          status, payment_status, order_type, client_checkout_token\n        ) VALUES ($1, $2, 1000, 50, 950, 'RESERVED', 'pending', 'PHYSICAL', $3)\n        RETURNING id`,
        [testBuyerId, testSellerId, token]
      );
      const orderId = orderRes.rows[0].id;
      testOrderIds.push(orderId);

      const res = await releaseOrderReservations(client, orderId);
      assert.ok(res);
      assert.equal(typeof res.releasedInventory, 'number');
      assert.equal(typeof res.releasedSlots, 'number');

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  test('Action 5.2: OrderStatusGuard validates PAID -> CANCELLED, DELIVERY_PENDING -> CANCELLED, and DELIVERY_COMPLETE', () => {
    assert.equal(assertValidTransition(OrderStatus.PAID, OrderStatus.CANCELLED, 'test-order-1'), true);
    assert.equal(assertValidTransition(OrderStatus.DELIVERY_PENDING, OrderStatus.CANCELLED, 'test-order-2'), true);
    assert.equal(assertValidTransition(OrderStatus.DELIVERY_COMPLETE, OrderStatus.COMPLETED, 'test-order-3'), true);
    assert.equal(assertValidTransition(OrderStatus.DELIVERY_COMPLETE, OrderStatus.CANCELLED, 'test-order-4'), true);
    assert.equal(assertValidTransition(OrderStatus.DELIVERY_COMPLETE, OrderStatus.REFUND_PENDING, 'test-order-5'), true);

    assert.throws(
      () => assertValidTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED, 'test-order-6'),
      /Illegal state transition/i
    );
    assert.throws(
      () => assertValidTransition(OrderStatus.CANCELLED, OrderStatus.FULFILLING, 'test-order-7'),
      /Illegal state transition/i
    );
    assert.throws(
      () => assertValidTransition(OrderStatus.PAYMENT_PENDING, OrderStatus.COMPLETED, 'test-order-8'),
      /Illegal state transition/i
    );
  });

  test('Action 5.3: OrderCancellationService strictly validates state transitions and blocks terminal orders', async () => {
    const token = `tok-${crypto.randomUUID()}`;
    const orderRes = await pool.query(
      `INSERT INTO product_orders (\n        buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,\n        status, payment_status, order_type, client_checkout_token\n      ) VALUES ($1, $2, 1000, 50, 950, 'PAID', 'completed', 'PHYSICAL', $3)\n      RETURNING id`,
      [testBuyerId, testSellerId, token]
    );
    const orderId = orderRes.rows[0].id;
    testOrderIds.push(orderId);

    const cancelled = await OrderCancellationService.cancelOrder(orderId, 'Buyer changed mind');
    assert.ok(cancelled);
    assert.equal(cancelled.status, OrderStatus.CANCELLED);

    await assert.rejects(
      async () => OrderCancellationService.cancelOrder(orderId, 'Duplicate cancel'),
      /already cancelled/i
    );
  });

  test('Action 5.4: orderDeadlineService reverses escrow settlement on auto-cancellation', async () => {
    const pastDeadline = new Date(Date.now() - 3600 * 1000);
    const token = `tok-${crypto.randomUUID()}`;
    const orderRes = await pool.query(
      `INSERT INTO product_orders (\n        buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,\n        status, payment_status, order_type, seller_dropoff_deadline, client_checkout_token\n      ) VALUES ($1, $2, 1200, 60, 1140, 'DELIVERY_PENDING', 'completed', 'PHYSICAL', $3, $4)\n      RETURNING id`,
      [testBuyerId, testSellerId, pastDeadline, token]
    );
    const orderId = orderRes.rows[0].id;
    testOrderIds.push(orderId);

    await pool.query(
      `INSERT INTO payouts (\n        order_id, seller_id, amount, platform_fee, status, settlement_status\n      ) VALUES ($1, $2, 1140, 60, 'pending', 'pending_settlement')`,
      [orderId, testSellerId]
    );

    const dummyOrder = { id: orderId, order_number: `ORD-${orderId}`, total_amount: 1200, buyer_id: testBuyerId };
    await orderDeadlineService.cancelOrderAndRefund(dummyOrder, 'Seller dropoff deadline expired');

    const { rows: oRows } = await pool.query('SELECT status, payment_status FROM product_orders WHERE id = $1', [orderId]);
    assert.equal(oRows[0].status, OrderStatus.CANCELLED);

    const { rows: pRows } = await pool.query('SELECT settlement_status FROM payouts WHERE order_id = $1', [orderId]);
    assert.equal(pRows[0].settlement_status, 'refunded_before_settlement');
  });
});
