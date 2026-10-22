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

    const buyerNotifs = await waitForNotification(buyerUser.id, 'payment_failed');
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

    const refundNotifs = await waitForNotification(buyerUser.id, 'refund_completed');
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

    const createdNotifs = await waitForNotification(creatorUser.id, 'withdrawal_created');
    assert.equal(createdNotifs.length, 1, 'Creator received withdrawal_created notification');
    assert.ok(createdNotifs[0].body.includes('4,500'));

    // 2. Withdrawal updated to completed
    await eventBus.emit(AppEvents.WITHDRAWAL.UPDATED, {
      eventId: nextEventId('test:withdrawal.updated'),
      withdrawal,
      newBalance: 500
    });

    const completedNotifs = await waitForNotification(creatorUser.id, 'withdrawal_updated');
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

    const createdNotifs = await waitForNotification(buyerUser.id, 'withdrawal_created');
    assert.equal(createdNotifs.length, 1, 'Buyer received withdrawal_created notification');
    assert.ok(createdNotifs[0].body.includes('1,800'));

    // 2. Withdrawal updated to completed
    await eventBus.emit(AppEvents.WITHDRAWAL.UPDATED, {
      eventId: nextEventId('test:withdrawal.updated'),
      withdrawal
    });

    const completedNotifs = await waitForNotification(buyerUser.id, 'withdrawal_updated');
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

    // Buyer received order_fulfilled, not duplicate order_payment_success
    const buyerNotifs = await waitForNotification(buyerUser.id, 'order_fulfilled');
    assert.equal(buyerNotifs.length, 1, 'Buyer received order_fulfilled notification');
    assert.equal(buyerNotifs[0].title, 'Order fulfilled');
    assert.ok(buyerNotifs[0].body.includes(`TEST-ORD-${id}`));

    // Seller received order_fulfilled
    const sellerNotifs = await waitForNotification(sellerUser.id, 'order_fulfilled');
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

    // Buyer received cancellation notice
    const buyerNotifs = await waitForNotification(buyerUser.id, 'order_cancelled');
    assert.equal(buyerNotifs.length, 1, 'Buyer received order_cancelled notification');
    assert.ok(buyerNotifs[0].body.includes('cancelled'));

    // Seller received cancellation notice
    const sellerNotifs = await waitForNotification(sellerUser.id, 'order_cancelled');
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

    // Seller received refund notification
    const sellerNotifs = await waitForNotification(sellerUser.id, 'order_refunded');
    assert.equal(sellerNotifs.length, 1, 'Seller received order_refunded notification');
    assert.equal(sellerNotifs[0].title, 'Order Refunded');
    assert.ok(sellerNotifs[0].body.includes(testOrder.order_number));
    assert.ok(sellerNotifs[0].body.includes('2,000'));

    // Clean up test order
    await cleanupOrder(testOrder.id);
  });

  test('broadcastMembershipInvite batches recipient processing and handles dryRun', async () => {
    const NotificationService = (await import('../src/domains/communication/notifications/notification.service.js')).default;
    
    // Dry run test
    const dryRunRes = await NotificationService.broadcastMembershipInvite({ dryRun: true });
    assert.equal(typeof dryRunRes.eligible, 'number');
    assert.equal(dryRunRes.dryRun, true);

    // Batching test with custom batchSize
    const batchRes = await NotificationService.broadcastMembershipInvite({ batchSize: 2 });
    assert.equal(typeof batchRes.eligible, 'number');
    assert.equal(typeof batchRes.sent, 'number');
    assert.equal(typeof batchRes.pushed, 'number');
    assert.equal(typeof batchRes.failed, 'number');
  });

  test('listForUser and markAllRead respect role scoping for multi-role users', async () => {
    const NotificationService = (await import('../src/domains/communication/notifications/notification.service.js')).default;
    const multiRoleUser = await createUser({ role: 'buyer' });

    try {
      // 1. Create a buyer notification and a seller notification for the same user
      await NotificationService.createInAppNotification({
        recipientUserId: multiRoleUser.id,
        recipientRole: 'buyer',
        type: 'buyer_order_placed',
        title: 'Order Confirmation',
        body: 'Your buyer order has been placed'
      });

      await NotificationService.createInAppNotification({
        recipientUserId: multiRoleUser.id,
        recipientRole: 'seller',
        type: 'seller_new_sale',
        title: 'New Sale Received',
        body: 'You received a new seller order'
      });

      // 2. Verify listForUser filtering by role
      const buyerList = await NotificationService.listForUser({ userId: multiRoleUser.id, role: 'buyer' });
      assert.equal(buyerList.length, 1);
      assert.equal(buyerList[0].recipient_role, 'buyer');
      assert.equal(buyerList[0].type, 'buyer_order_placed');

      const sellerList = await NotificationService.listForUser({ userId: multiRoleUser.id, role: 'seller' });
      assert.equal(sellerList.length, 1);
      assert.equal(sellerList[0].recipient_role, 'seller');
      assert.equal(sellerList[0].type, 'seller_new_sale');

      const allList = await NotificationService.listForUser({ userId: multiRoleUser.id, role: null });
      assert.equal(allList.length, 2);

      // 3. Verify unread counts
      const initialBuyerCount = await NotificationService.getUnreadCount({ userId: multiRoleUser.id, role: 'buyer' });
      const initialSellerCount = await NotificationService.getUnreadCount({ userId: multiRoleUser.id, role: 'seller' });
      const initialTotalCount = await NotificationService.getUnreadCount({ userId: multiRoleUser.id });
      assert.equal(initialBuyerCount, 1);
      assert.equal(initialSellerCount, 1);
      assert.equal(initialTotalCount, 2);

      // 4. Mark all read for 'buyer' role only
      const updatedBuyerCount = await NotificationService.markAllRead({ userId: multiRoleUser.id, role: 'buyer' });
      assert.equal(updatedBuyerCount, 1);

      // Buyer unread should now be 0, while seller unread remains 1
      const postBuyerCount = await NotificationService.getUnreadCount({ userId: multiRoleUser.id, role: 'buyer' });
      const postSellerCount = await NotificationService.getUnreadCount({ userId: multiRoleUser.id, role: 'seller' });
      assert.equal(postBuyerCount, 0);
      assert.equal(postSellerCount, 1);

      // 5. Mark all read for 'seller' role
      const updatedSellerCount = await NotificationService.markAllRead({ userId: multiRoleUser.id, role: 'seller' });
      assert.equal(updatedSellerCount, 1);
      assert.equal(await NotificationService.getUnreadCount({ userId: multiRoleUser.id }), 0);
    } finally {
      await pool.query('DELETE FROM app_notifications WHERE recipient_user_id = $1', [multiRoleUser.id]);
      await pool.query('DELETE FROM users WHERE id = $1', [multiRoleUser.id]);
    }
  });

  test('registerDeviceToken maps partner and mzigo roles to logistics', async () => {
    const NotificationService = (await import('../src/domains/communication/notifications/notification.service.js')).default;
    const testPartnerUser = await createUser({ role: 'logistics' });
    const token = `partner-test-token-${Date.now()}`;

    try {
      const device = await NotificationService.registerDeviceToken({
        userId: testPartnerUser.id,
        role: 'partner',
        platform: 'android',
        token,
        deviceId: 'partner-device-1'
      });

      assert.equal(device.role, 'logistics', 'partner role was mapped to logistics');
      assert.equal(device.platform, 'android');
      assert.equal(device.is_active, true);

      const { rows } = await pool.query('SELECT * FROM notification_device_tokens WHERE token = $1', [token]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].role, 'logistics');
      assert.equal(rows[0].token, token);
    } finally {
      await pool.query('DELETE FROM notification_device_tokens WHERE token = $1', [token]);
      await pool.query('DELETE FROM users WHERE id = $1', [testPartnerUser.id]);
    }
  });

  test('resolveSellerUserId resolves userId via sellerUserId, sellerId, or sellerPhone', async () => {
    const NotificationService = (await import('../src/domains/communication/notifications/notification.service.js')).default;

    // 1. Direct sellerUserId
    const directResult = await NotificationService.resolveSellerUserId({ sellerUserId: 9999 });
    assert.equal(directResult, 9999);

    // 2. Resolve via sellerId
    const byIdResult = await NotificationService.resolveSellerUserId({ sellerId: seller.id });
    assert.equal(byIdResult, sellerUser.id);

    // 3. Resolve via sellerPhone (whatsappNumber)
    const testPhone = '254711223344';
    await pool.query('UPDATE sellers SET whatsapp_number = $1 WHERE id = $2', [testPhone, seller.id]);
    const byPhoneResult = await NotificationService.resolveSellerUserId({ sellerPhone: testPhone });
    assert.equal(byPhoneResult, sellerUser.id);

    // 4. Returns null when not found
    const notFoundResult = await NotificationService.resolveSellerUserId({ sellerId: 9999999 });
    assert.equal(notFoundResult, null);
  });
});
