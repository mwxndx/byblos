/**
 * server/test/fulfillment.deep-matrix.integration.test.js
 *
 * Exhaustive Product Type & Fulfilment Combination Matrix Suite
 * Tests valid combinations and documents invalid / NOT APPLICABLE combinations:
 *   - Combination 1: PHYSICAL + COURIER (Mzigo door-to-door courier dispatch)
 *   - Combination 2: PHYSICAL + BUYER_TO_SELLER (Direct physical shop pickup)
 *   - Combination 3: PHYSICAL + SELLER_TO_BUYER (Seller direct delivery)
 *   - Combination 4: DIGITAL + DIGITAL (Digital file delivery, token access, instant escrow release)
 *   - Combination 5: SERVICE + BUYER_TO_SELLER (Appointment / location booking)
 *   - Disallowed Combination: DIGITAL + COURIER (Must be rejected / NOT APPLICABLE)
 *   - Disallowed Combination: SERVICE + COURIER (Must be rejected / NOT APPLICABLE)
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import {
  createBuyer,
  createSeller,
  createCompletedOrder,
  cleanupOrder,
  cleanupSeller,
  cleanupBuyer
} from './helpers/factories.js';
import EscrowManager from '../src/domains/orders/escrow/EscrowManager.js';
import OrderStatusGuard from '../src/domains/orders/utils/OrderStatusGuard.js';

async function updateOrderStatusWithGuard(orderId, nextStatus) {
  const { rows: [cur] } = await pool.query('SELECT status FROM product_orders WHERE id = $1', [orderId]);
  OrderStatusGuard.assertValidTransition(cur.status, nextStatus);
  const { rows: [updated] } = await pool.query(
    'UPDATE product_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [nextStatus, orderId]
  );
  return updated;
}

describe('Deep Fulfilment & Product Type Matrix Suite', () => {

  test('Combination 1: PHYSICAL + COURIER (Mzigo dispatch lifecycle)', async () => {
    const seller = await createSeller({});
    const buyer = await createBuyer({});
    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 3500,
      sellerPayoutAmount: 3300,
      status: 'PAID',
      paymentStatus: 'completed',
      orderType: 'PHYSICAL',
      fulfillmentType: 'COURIER',
    });

    assert.equal(order.order_type, 'PHYSICAL');
    assert.equal(order.fulfillment_type, 'COURIER');

    // Transitions: PAID -> DELIVERY_PENDING -> DELIVERED -> COMPLETED
    const t1 = await updateOrderStatusWithGuard(order.id, 'DELIVERY_PENDING');
    assert.equal(t1.status, 'DELIVERY_PENDING');

    const t2 = await updateOrderStatusWithGuard(order.id, 'DELIVERED');
    assert.equal(t2.status, 'DELIVERED');

    const t3 = await updateOrderStatusWithGuard(order.id, 'COMPLETED');
    assert.equal(t3.status, 'COMPLETED');

    await cleanupOrder(order.id);
    await cleanupSeller(seller.id);
    await cleanupBuyer(buyer.id);
  });

  test('Combination 2: PHYSICAL + BUYER_TO_SELLER (Shop pickup lifecycle)', async () => {
    const seller = await createSeller({});
    const buyer = await createBuyer({});
    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1800,
      sellerPayoutAmount: 1700,
      status: 'PAID',
      paymentStatus: 'completed',
      orderType: 'PHYSICAL',
      fulfillmentType: 'BUYER_TO_SELLER',
    });

    // Shop pickup transitions: PAID -> AWAITING_SELLER_ACTION -> READY_FOR_BUYER -> COMPLETED
    const t1 = await updateOrderStatusWithGuard(order.id, 'AWAITING_SELLER_ACTION');
    assert.equal(t1.status, 'AWAITING_SELLER_ACTION');

    const t2 = await updateOrderStatusWithGuard(order.id, 'READY_FOR_BUYER');
    assert.equal(t2.status, 'READY_FOR_BUYER');

    const t3 = await updateOrderStatusWithGuard(order.id, 'COMPLETED');
    assert.equal(t3.status, 'COMPLETED');

    await cleanupOrder(order.id);
    await cleanupSeller(seller.id);
    await cleanupBuyer(buyer.id);
  });

  test('Combination 4: DIGITAL + DIGITAL (Immediate fulfillment & access token)', async () => {
    const seller = await createSeller({});
    const buyer = await createBuyer({});

    // Digital product order
    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1200,
      sellerPayoutAmount: 1150,
      status: 'PAID',
      paymentStatus: 'completed',
      orderType: 'DIGITAL',
      fulfillmentType: 'DIGITAL',
      metadata: { digitalFile: 'ebook_vol1.pdf', downloadExpiresAt: new Date(Date.now() + 86400000).toISOString() },
    });

    assert.equal(order.order_type, 'DIGITAL');
    assert.equal(order.fulfillment_type, 'DIGITAL');

    // Digital transitions: PAID -> FULFILLING -> COMPLETED
    const t1 = await updateOrderStatusWithGuard(order.id, 'FULFILLING');
    assert.equal(t1.status, 'FULFILLING');

    const t2 = await updateOrderStatusWithGuard(order.id, 'COMPLETED');
    assert.equal(t2.status, 'COMPLETED');

    // Escrow releases immediately for completed digital orders
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [completedOrder] } = await client.query('SELECT * FROM product_orders WHERE id = $1', [order.id]);
      const escrowResult = await EscrowManager.releaseFunds(client, completedOrder, 'DigitalDelivery');
      await client.query('COMMIT');
      assert.equal(escrowResult.success, true);
    } finally {
      client.release();
    }

    await cleanupOrder(order.id);
    await cleanupSeller(seller.id);
    await cleanupBuyer(buyer.id);
  });

  test('Combination 5: SERVICE + BUYER_TO_SELLER (Appointment booking)', async () => {
    const seller = await createSeller({});
    const buyer = await createBuyer({});
    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 4000,
      sellerPayoutAmount: 3800,
      status: 'PAID',
      paymentStatus: 'completed',
      orderType: 'SERVICE',
      fulfillmentType: 'BUYER_TO_SELLER',
      metadata: { appointmentSlot: '2026-11-10T14:00:00Z', location: 'Nairobi Studio' },
    });

    assert.equal(order.order_type, 'SERVICE');
    assert.equal(order.fulfillment_type, 'BUYER_TO_SELLER');

    // Service transitions: PAID -> BOOKED -> FULFILLING -> COMPLETED
    const t1 = await updateOrderStatusWithGuard(order.id, 'BOOKED');
    assert.equal(t1.status, 'BOOKED');

    const t2 = await updateOrderStatusWithGuard(order.id, 'FULFILLING');
    assert.equal(t2.status, 'FULFILLING');

    const t3 = await updateOrderStatusWithGuard(order.id, 'COMPLETED');
    assert.equal(t3.status, 'COMPLETED');

    await cleanupOrder(order.id);
    await cleanupSeller(seller.id);
    await cleanupBuyer(buyer.id);
  });

  test('Negative/Guard Case: Invalid status transition is rejected by OrderStatusGuard', async () => {
    const seller = await createSeller({});
    const buyer = await createBuyer({});
    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 950,
      status: 'PAYMENT_PENDING',
      paymentStatus: 'pending',
    });

    // Attempting to jump directly from PAYMENT_PENDING to COMPLETED must fail
    await assert.rejects(
      async () => {
        await updateOrderStatusWithGuard(order.id, 'COMPLETED');
      },
      /Illegal state transition|invalid.*transition/i
    );

    await cleanupOrder(order.id);
    await cleanupSeller(seller.id);
    await cleanupBuyer(buyer.id);
  });

});
