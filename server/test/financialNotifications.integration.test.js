import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import eventBus, { AppEvents } from '../src/application/events/eventBus.js';
import '../src/application/events/payment.events.js';
import '../src/application/events/order.events.js';

const { pool } = await import('../src/infrastructure/database/database.js');
const {
  createUser,
  createBuyer,
  createSeller,
  createCreator,
  createCompletedOrder,
  cleanupOrder
} = await import('./helpers/factories.js');

let seedCounter = 200000;
const nextId = () => { seedCounter += 1; return seedCounter; };
const nextEventId = (prefix) => `${prefix}:${Date.now()}:${Math.floor(Math.random() * 1000000)}`;

describe('Financial Push & Feed Notifications Integration', () => {
  let buyerUser;
  let buyer;
  let sellerUser;
  let seller;
  let creatorUser;
  let creator;

  before(async () => {
    buyerUser = await createUser({ role: 'buyer' });
    buyer = await createBuyer({ userId: buyerUser.id });

    sellerUser = await createUser({ role: 'seller' });
    seller = await createSeller({ userId: sellerUser.id });

    creatorUser = await createUser({ role: 'creator' });
    creator = await createCreator({ userId: creatorUser.id });
  });

  after(async () => {
    if (buyerUser?.id) {
      await pool.query('DELETE FROM app_notifications WHERE recipient_user_id = $1', [buyerUser.id]);
      await pool.query('DELETE FROM buyers WHERE id = $1', [buyer.id]);
      await pool.query('DELETE FROM users WHERE id = $1', [buyerUser.id]);
    }
    if (sellerUser?.id) {
      await pool.query('DELETE FROM app_notifications WHERE recipient_user_id = $1', [sellerUser.id]);
      await pool.query('DELETE FROM sellers WHERE id = $1', [seller.id]);
      await pool.query('DELETE FROM users WHERE id = $1', [sellerUser.id]);
    }
    if (creatorUser?.id) {
      await pool.query('DELETE FROM app_notifications WHERE recipient_user_id = $1', [creatorUser.id]);
      await pool.query('DELETE FROM creators WHERE id = $1', [creator.id]);
      await pool.query('DELETE FROM users WHERE id = $1', [creatorUser.id]);
    }
  });

  async function waitForNotification(userId, type, maxWaitMs = 1500) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const { rows } = await pool.query(
        `SELECT * FROM app_notifications 
         WHERE recipient_user_id = $1 AND type = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [userId, type]
      );
      if (rows.length > 0) return rows;
      await new Promise(r => setTimeout(r, 50));
    }
    return [];
  }

  test('PAYMENT.COMPLETED dispatches in-app feed and push to both buyer and seller', async () => {
    const id = nextId();
    const eventId = nextEventId('test:payment.completed');
    const payment = { id, amount: 2500, buyer_id: buyer.id, seller_id: seller.id };
    const order = { id, order_number: `TEST-ORD-${id}`, total_amount: 2500, buyer_id: buyer.id, seller_id: seller.id };

    await eventBus.emit(AppEvents.PAYMENT.COMPLETED, {
      eventId,
      payment,
      order
    });

    // 1. Verify Buyer Notification
    const buyerNotifs = await waitForNotification(buyerUser.id, 'payment_completed');
    assert.equal(buyerNotifs.length, 1, 'Buyer received payment_completed notification');
    assert.equal(buyerNotifs[0].title, 'Payment Confirmed');
    assert.ok(buyerNotifs[0].body.includes(`TEST-ORD-${id}`), 'Body references order number');
    assert.ok(buyerNotifs[0].body.includes('2,500'), 'Body references amount');
    assert.deepEqual(buyerNotifs[0].channels, ['in_app', 'push']);

    // 2. Verify Seller Notification
    const sellerNotifs = await waitForNotification(sellerUser.id, 'order_paid');
    assert.equal(sellerNotifs.length, 1, 'Seller received order_paid notification');
    assert.equal(sellerNotifs[0].title, 'New Order Paid!');
    assert.ok(sellerNotifs[0].body.includes(`TEST-ORD-${id}`), 'Body references order number');
    assert.deepEqual(sellerNotifs[0].channels, ['in_app', 'push']);
  });

  test('PAYMENT.FAILED dispatches failure push and feed notification to buyer', async () => {
    const id = nextId();
    const eventId = nextEventId('test:payment.failed');
    const payment = { id, amount: 1500, buyer_id: buyer.id };
    const order = { id, order_number: `TEST-ORD-${id}`, buyer_id: buyer.id };

    await eventBus.emit(AppEvents.PAYMENT.FAILED, {
      eventId,
      payment,
      order,
      reason: 'The M-Pesa prompt expired before PIN entry'
    });

    await new Promise(r => setTimeout(r, 200));

    const { rows: buyerNotifs } = await pool.query(
      `SELECT * FROM app_notifications 
       WHERE recipient_user_id = $1 AND type = 'payment_failed' 
       ORDER BY created_at DESC LIMIT 1`,
      [buyerUser.id]
    );
    assert.equal(buyerNotifs.length, 1, 'Buyer received payment_failed notification');
    assert.equal(buyerNotifs[0].title, 'Payment Failed');
    assert.ok(buyerNotifs[0].body.includes(`TEST-ORD-${id}`));
    assert.ok(buyerNotifs[0].body.includes('expired'));
  });

  test('REFUND.COMPLETED dispatches refund credited notification to buyer', async () => {
    const id = nextId();
    const eventId = nextEventId('test:refund.completed');
    const refund = {
      id,
      amount: 1200,
      buyer_id: buyer.id,
      adminNotes: 'Auto-approved by refund policy'
    };

    await eventBus.emit(AppEvents.REFUND.COMPLETED, {
      eventId,
      refund,
      buyer: { id: buyer.id }
    });

    await new Promise(r => setTimeout(r, 200));

    const { rows: refundNotifs } = await pool.query(
      `SELECT * FROM app_notifications 
       WHERE recipient_user_id = $1 AND type = 'refund_completed' 
       ORDER BY created_at DESC LIMIT 1`,
      [buyerUser.id]
    );
    assert.equal(refundNotifs.length, 1, 'Buyer received refund_completed notification');
    assert.equal(refundNotifs[0].title, 'Refund Credited');
    assert.ok(refundNotifs[0].body.includes('1,200'));
    assert.ok(refundNotifs[0].body.includes('Auto-approved by refund policy'));
  });

  test('WITHDRAWAL.CREATED & UPDATED delivers creator notifications', async () => {
    const id = nextId();
    const withdrawal = {
      id,
      amount: 4500,
      creator_id: creator.id,
      status: 'completed'
    };

    // 1. Withdrawal created
    await eventBus.emit(AppEvents.WITHDRAWAL.CREATED, {
      eventId: nextEventId('test:withdrawal.created'),
      withdrawal
    });

    await new Promise(r => setTimeout(r, 200));

    const { rows: createdNotifs } = await pool.query(
      `SELECT * FROM app_notifications 
       WHERE recipient_user_id = $1 AND type = 'withdrawal_created' 
       ORDER BY created_at DESC LIMIT 1`,
      [creatorUser.id]
    );
    assert.equal(createdNotifs.length, 1, 'Creator received withdrawal_created notification');
    assert.ok(createdNotifs[0].body.includes('4,500'));

    // 2. Withdrawal updated to completed
    await eventBus.emit(AppEvents.WITHDRAWAL.UPDATED, {
      eventId: nextEventId('test:withdrawal.updated'),
      withdrawal,
      newBalance: 500
    });

    await new Promise(r => setTimeout(r, 200));

    const { rows: completedNotifs } = await pool.query(
      `SELECT * FROM app_notifications 
       WHERE recipient_user_id = $1 AND type = 'withdrawal_updated' 
       ORDER BY created_at DESC LIMIT 1`,
      [creatorUser.id]
    );
    assert.equal(completedNotifs.length, 1, 'Creator received withdrawal_updated notification');
    assert.equal(completedNotifs[0].title, 'Payout sent');
    assert.ok(completedNotifs[0].body.includes('4,500'));
  });

  test('WITHDRAWAL.CREATED & UPDATED delivers buyer refund cashout notifications', async () => {
    const id = nextId();
    const withdrawal = {
      id,
      amount: 1800,
      buyer_id: buyer.id,
      status: 'completed'
    };

    // 1. Withdrawal created
    await eventBus.emit(AppEvents.WITHDRAWAL.CREATED, {
      eventId: nextEventId('test:withdrawal.created'),
      withdrawal
    });

    await new Promise(r => setTimeout(r, 200));

    const { rows: createdNotifs } = await pool.query(
      `SELECT * FROM app_notifications 
       WHERE recipient_user_id = $1 AND type = 'withdrawal_created' 
       ORDER BY created_at DESC LIMIT 1`,
      [buyerUser.id]
    );
    assert.equal(createdNotifs.length, 1, 'Buyer received withdrawal_created notification');
    assert.ok(createdNotifs[0].body.includes('1,800'));

    // 2. Withdrawal updated to completed
    await eventBus.emit(AppEvents.WITHDRAWAL.UPDATED, {
      eventId: nextEventId('test:withdrawal.updated'),
      withdrawal
    });

    await new Promise(r => setTimeout(r, 200));

    const { rows: completedNotifs } = await pool.query(
      `SELECT * FROM app_notifications 
       WHERE recipient_user_id = $1 AND type = 'withdrawal_updated' 
       ORDER BY created_at DESC LIMIT 1`,
      [buyerUser.id]
    );
    assert.equal(completedNotifs.length, 1, 'Buyer received withdrawal_updated notification');
    assert.equal(completedNotifs[0].title, 'Refund payout complete');
    assert.ok(completedNotifs[0].body.includes('1,800'));
  });

  test('ORDER.FULFILLED delivers order fulfilled notification (not duplicate payment confirmation)', async () => {
    const id = nextId();
    const order = {
      id,
      order_number: `TEST-ORD-${id}`,
      total_amount: 3200,
      buyer: { userId: buyerUser.id },
      seller: { userId: sellerUser.id }
    };

    await eventBus.emit(AppEvents.ORDER.FULFILLED, {
      eventId: nextEventId('test:order.fulfilled'),
      order,
      items: [{ product_id: 1, is_digital: false }]
    });

    await new Promise(r => setTimeout(r, 200));

    // Buyer received order_fulfilled, not duplicate order_payment_success
    const { rows: buyerNotifs } = await pool.query(
      `SELECT * FROM app_notifications 
       WHERE recipient_user_id = $1 AND type = 'order_fulfilled' 
       ORDER BY created_at DESC LIMIT 1`,
      [buyerUser.id]
    );
    assert.equal(buyerNotifs.length, 1, 'Buyer received order_fulfilled notification');
    assert.equal(buyerNotifs[0].title, 'Order fulfilled');
    assert.ok(buyerNotifs[0].body.includes(`TEST-ORD-${id}`));

    // Seller received order_fulfilled
    const { rows: sellerNotifs } = await pool.query(
      `SELECT * FROM app_notifications 
       WHERE recipient_user_id = $1 AND type = 'order_fulfilled' 
       ORDER BY created_at DESC LIMIT 1`,
      [sellerUser.id]
    );
    assert.equal(sellerNotifs.length, 1, 'Seller received order_fulfilled notification');
    assert.equal(sellerNotifs[0].title, 'Order fulfilled');
  });

  test('ORDER.CANCELLED delivers cancellation notification to both buyer and seller', async () => {
    const id = nextId();
    const order = {
      id,
      order_number: `TEST-ORD-${id}`,
      total_amount: 1500,
      buyer: { userId: buyerUser.id },
      seller: { userId: sellerUser.id }
    };

    await eventBus.emit(AppEvents.ORDER.CANCELLED, {
      eventId: nextEventId('test:order.cancelled'),
      order,
      items: [{ product_id: 1, quantity: 1 }]
    });

    await new Promise(r => setTimeout(r, 200));

    // Buyer received cancellation notice
    const { rows: buyerNotifs } = await pool.query(
      `SELECT * FROM app_notifications 
       WHERE recipient_user_id = $1 AND type = 'order_cancelled' 
       ORDER BY created_at DESC LIMIT 1`,
      [buyerUser.id]
    );
    assert.equal(buyerNotifs.length, 1, 'Buyer received order_cancelled notification');
    assert.ok(buyerNotifs[0].body.includes('cancelled'));

    // Seller received cancellation notice
    const { rows: sellerNotifs } = await pool.query(
      `SELECT * FROM app_notifications 
       WHERE recipient_user_id = $1 AND type = 'order_cancelled' 
       ORDER BY created_at DESC LIMIT 1`,
      [sellerUser.id]
    );
    assert.equal(sellerNotifs.length, 1, 'Seller received order_cancelled notification');
    assert.ok(sellerNotifs[0].body.includes(`TEST-ORD-${id}`));
  });

  test('REFUND.COMPLETED delivers refund notification to seller when order is linked', async () => {
    const id = nextId();
    const testOrder = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 2000,
      sellerPayoutAmount: 1990,
      status: 'PAID'
    });

    const refund = {
      id,
      amount: 2000,
      order_id: testOrder.id,
      buyer_id: buyer.id
    };

    await eventBus.emit(AppEvents.REFUND.COMPLETED, {
      eventId: nextEventId('test:refund.completed'),
      refund,
      buyer: { id: buyer.id }
    });

    await new Promise(r => setTimeout(r, 200));

    // Seller received refund notification
    const { rows: sellerNotifs } = await pool.query(
      `SELECT * FROM app_notifications 
       WHERE recipient_user_id = $1 AND type = 'order_refunded' 
       ORDER BY created_at DESC LIMIT 1`,
      [sellerUser.id]
    );
    assert.equal(sellerNotifs.length, 1, 'Seller received order_refunded notification');
    assert.equal(sellerNotifs[0].title, 'Order Refunded');
    assert.ok(sellerNotifs[0].body.includes(testOrder.order_number));
    assert.ok(sellerNotifs[0].body.includes('2,000'));

    // Clean up test order
    await cleanupOrder(testOrder.id);
  });
});
