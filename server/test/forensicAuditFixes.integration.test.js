import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

const { pool } = await import('../src/infrastructure/database/database.js');
const { normalizeOrderInput } = await import('../src/shared/utils/order.utils.js');
const { getByReference } = await import('../src/domains/orders/order/order.controller.js');
const {
  createUser,
  createBuyer,
  createSeller,
  createCompletedOrder,
  cleanupOrder,
  cleanupSeller,
  cleanupBuyer,
  cleanupUser
} = await import('./helpers/factories.js');

describe('Forensic audit P1 fixes: M-01 and M-02', () => {
  let user1, buyer1, user2, buyer2, seller, order;

  after(async () => {
    if (order) await cleanupOrder(order.id).catch(() => {});
    if (seller) await cleanupSeller(seller.id).catch(() => {});
    if (buyer1) await cleanupBuyer(buyer1.id).catch(() => {});
    if (user1) await cleanupUser(user1.id).catch(() => {});
    if (buyer2) await cleanupBuyer(buyer2.id).catch(() => {});
    if (user2) await cleanupUser(user2.id).catch(() => {});
  });

  test('M-02: authenticated buyer keeps their own buyerId even if third-party phone is used', async () => {
    user1 = await createUser({ role: 'buyer' });
    buyer1 = await createBuyer({ userId: user1.id, mobilePayment: '+254711111111' });

    user2 = await createUser({ role: 'buyer' });
    buyer2 = await createBuyer({ userId: user2.id, mobilePayment: '+254722222222' });

    // Request from user1, but entering user2's phone number for payment
    const req = {
      user: {
        id: user1.id,
        role: 'buyer',
        email: user1.email,
        name: 'User One',
        mobile_payment: buyer1.mobile_payment
      },
      body: {
        mobilePayment: '+254722222222', // user2's phone
        email: user1.email,
        items: [{ id: 1, quantity: 1 }]
      },
      headers: {}
    };

    const normalized = await normalizeOrderInput(req, 'token-123');
    assert.equal(normalized.buyer.id, buyer1.id, 'buyer.id must remain user1 buyer profile, not user2');
    assert.equal(normalized.buyer.mobilePayment, '+254722222222', 'payment phone is used for STK push');
  });

  test('M-02: guest checkout never adopts an existing buyer profile from a phone number', async () => {
    const guestReq = {
      user: null,
      body: {
        mobilePayment: '+254711111111', // matches buyer1's phone
        customerEmail: 'guest@example.com',
        customerName: 'Guest Buyer',
        items: [{ id: 1, quantity: 1 }]
      },
      headers: {}
    };

    const normalized = await normalizeOrderInput(guestReq, 'token-guest-456');
    assert.equal(normalized.buyer.id, null, 'guest checkout must not bind to registered buyer1.id');
    assert.equal(normalized.buyer.email, 'guest@example.com');
  });

  test('M-01: getByReference denies unauthenticated caller without checkout token and permits authorized caller', async () => {
    seller = await createSeller({});
    order = await createCompletedOrder({
      buyerId: buyer1.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 900,
      platformFeeAmount: 100
    });

    const token = 'secret-checkout-token-' + Date.now();
    await pool.query('UPDATE product_orders SET client_checkout_token = $1 WHERE id = $2', [token, order.id]);

    // 1. Unauthenticated request without token -> 403 Forbidden
    let statusSet = null;
    let jsonPayload = null;
    const resForbidden = {
      status(code) { statusSet = code; return this; },
      json(data) { jsonPayload = data; return this; }
    };
    await getByReference({
      params: { reference: order.order_number },
      headers: {},
      query: {},
      user: null
    }, resForbidden);

    assert.equal(statusSet, 403);
    assert.equal(jsonPayload.code, 'UNAUTHORIZED_ORDER_ACCESS');

    // 2. Unauthenticated request with matching checkout token -> 200 OK
    let statusSuccess = null;
    let jsonSuccess = null;
    const resAllowed = {
      status(code) { statusSuccess = code; return this; },
      json(data) { jsonSuccess = data; return this; }
    };
    await getByReference({
      params: { reference: order.order_number },
      headers: { 'x-checkout-token': token },
      query: {},
      user: null
    }, resAllowed);

    assert.equal(statusSuccess, 200);
    assert.equal(jsonSuccess.status, 'success');
    assert.equal(jsonSuccess.data.orderNumber, order.order_number);

    // 3. Authenticated request as the buyer -> 200 OK
    let statusAuth = null;
    let jsonAuth = null;
    const resAuth = {
      status(code) { statusAuth = code; return this; },
      json(data) { jsonAuth = data; return this; }
    };
    await getByReference({
      params: { reference: order.order_number },
      headers: {},
      query: {},
      user: { id: user1.id, buyerId: buyer1.id, role: 'buyer' }
    }, resAuth);

    assert.equal(statusAuth, 200);
    assert.equal(jsonAuth.status, 'success');
  });
});
