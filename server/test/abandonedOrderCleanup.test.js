import { test, describe, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const { pool } = await import('../src/infrastructure/database/database.js');
const { releaseExpiredUnpaidReservations } = await import('../src/application/cron/cleanupCron.js');
const {
  createUser,
  createBuyer,
  createSeller,
  createProduct,
  createCompletedOrder,
  createOrderItem,
  createPayment,
  cleanupOrder,
  cleanupProduct,
  cleanupSeller,
  cleanupBuyer,
  cleanupUser
} = await import('./helpers/factories.js');

describe('DEF-04: Abandoned unpaid order cleanup & payment state synchronization', () => {
  let user, buyer, seller, product;
  const createdOrders = [];
  const createdPayments = [];

  beforeEach(async () => {
    user = await createUser({ role: 'seller' });
    seller = await createSeller({ userId: user.id });
    const buyerUser = await createUser({ role: 'buyer' });
    buyer = await createBuyer({ userId: buyerUser.id });

    product = await createProduct({
      sellerId: seller.id,
      name: 'Cleanup Test Product',
      price: 250,
      trackInventory: true,
      quantity: 10
    });
  });

  after(async () => {
    for (const paymentId of createdPayments) {
      await pool.query('DELETE FROM payments WHERE id = $1', [paymentId]).catch(() => {});
    }
    for (const orderId of createdOrders) {
      await cleanupOrder(orderId).catch(() => {});
    }
    if (product) await cleanupProduct(product.id).catch(() => {});
    if (seller) await cleanupSeller(seller.id).catch(() => {});
    if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    if (user) await cleanupUser(user.id).catch(() => {});
  });

  test('cancels abandoned unpaid order, releases reserved stock, AND transitions associated pending payment to failed', async () => {
    // Set reserved quantity for 2 items
    await pool.query(
      `UPDATE products SET reserved_quantity = 2 WHERE id = $1`,
      [product.id]
    );

    // Create an order with status PAYMENT_PENDING, payment_status pending
    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 500,
      sellerPayoutAmount: 490,
      status: 'PAYMENT_PENDING',
      paymentStatus: 'pending'
    });
    createdOrders.push(order.id);

    // Backdate the order to 20 minutes ago (exceeding 15-minute cleanup TTL)
    await pool.query(
      `UPDATE product_orders SET created_at = NOW() - INTERVAL '20 minutes' WHERE id = $1`,
      [order.id]
    );

    // Link product to order via order_items
    await createOrderItem({
      orderId: order.id,
      productId: product.id,
      price: 250,
      quantity: 2
    });

    // Create a pending payment linked to this order
    const payment = await createPayment({
      orderId: order.id,
      amount: 500,
      status: 'pending'
    });
    createdPayments.push(payment.id);

    // Execute the reservation cleanup
    const result = await releaseExpiredUnpaidReservations(pool);
    assert.ok(result.scanned >= 1, 'Should scan at least 1 expired order');
    assert.ok(result.cancelled >= 1, 'Should cancel at least 1 expired order');

    // Verify order state
    const { rows: orderRows } = await pool.query(
      `SELECT status, payment_status FROM product_orders WHERE id = $1`,
      [order.id]
    );
    assert.equal(orderRows[0].status, 'CANCELLED', 'Order status must be CANCELLED');
    assert.equal(orderRows[0].payment_status, 'failed', 'Order payment_status must be failed');

    // Verify inventory released
    const { rows: productRows } = await pool.query(
      `SELECT quantity, reserved_quantity FROM products WHERE id = $1`,
      [product.id]
    );
    assert.equal(productRows[0].reserved_quantity, 0, 'Reserved inventory must be released to 0');

    // Verify payment state: DEF-04 requires associated pending payment to be transitioned to failed
    const { rows: paymentRows } = await pool.query(
      `SELECT id, status, metadata FROM payments WHERE id = $1`,
      [payment.id]
    );
    assert.equal(
      paymentRows[0].status,
      'failed',
      'Associated pending payment record must be transitioned to failed when order is cancelled'
    );
    assert.equal(
      paymentRows[0].metadata?.cancelled_by_cleanup,
      true,
      'Payment metadata should record cancelled_by_cleanup'
    );
    assert.equal(
      paymentRows[0].metadata?.cancellation_reason,
      'reservation_ttl_expired',
      'Payment metadata should record cancellation_reason'
    );
  });

  test('does not cancel or alter payments for an order whose payment completed', async () => {
    // Create an order that was completed
    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 250,
      sellerPayoutAmount: 245,
      status: 'PAID',
      paymentStatus: 'completed'
    });
    createdOrders.push(order.id);

    // Backdate the order to 30 minutes ago
    await pool.query(
      `UPDATE product_orders SET created_at = NOW() - INTERVAL '30 minutes' WHERE id = $1`,
      [order.id]
    );

    // Create a completed payment
    const payment = await createPayment({
      orderId: order.id,
      amount: 250,
      status: 'completed'
    });
    createdPayments.push(payment.id);

    // Execute cleanup
    await releaseExpiredUnpaidReservations(pool);

    // Verify order remains PAID and payment remains completed
    const { rows: orderRows } = await pool.query(
      `SELECT status, payment_status FROM product_orders WHERE id = $1`,
      [order.id]
    );
    assert.equal(orderRows[0].status, 'PAID');
    assert.equal(orderRows[0].payment_status, 'completed');

    const { rows: paymentRows } = await pool.query(
      `SELECT status FROM payments WHERE id = $1`,
      [payment.id]
    );
    assert.equal(paymentRows[0].status, 'completed');
  });

  test('does not cancel an order that is younger than 15 minutes', async () => {
    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 250,
      sellerPayoutAmount: 245,
      status: 'PAYMENT_PENDING',
      paymentStatus: 'pending'
    });
    createdOrders.push(order.id);

    // Order created 5 minutes ago (within TTL)
    await pool.query(
      `UPDATE product_orders SET created_at = NOW() - INTERVAL '5 minutes' WHERE id = $1`,
      [order.id]
    );

    const payment = await createPayment({
      orderId: order.id,
      amount: 250,
      status: 'pending'
    });
    createdPayments.push(payment.id);

    // Execute cleanup
    await releaseExpiredUnpaidReservations(pool);

    // Verify order and payment remain pending
    const { rows: orderRows } = await pool.query(
      `SELECT status, payment_status FROM product_orders WHERE id = $1`,
      [order.id]
    );
    assert.equal(orderRows[0].status, 'PAYMENT_PENDING');
    assert.equal(orderRows[0].payment_status, 'pending');

    const { rows: paymentRows } = await pool.query(
      `SELECT status FROM payments WHERE id = $1`,
      [payment.id]
    );
    assert.equal(paymentRows[0].status, 'pending');
  });
});
