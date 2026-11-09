import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import OrderReadService from '../src/domains/orders/order/orderRead.service.js';
import Order from '../src/domains/orders/order/order.model.js';
import PaymentFulfillmentFacade from '../src/domains/payments/payments/PaymentFulfillmentFacade.js';
import eventBus, { AppEvents } from '../src/application/events/eventBus.js';

test('LIVE EVENT SIMULATION: Clean Architecture & Event-Driven Flows in Docker PostgreSQL', async (t) => {
  const client = await pool.connect();
  let testSellerId;
  let testBuyerId;
  let testProductId;
  let testOrderId;
  const testRef = `sim-pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    // Setup clean test entities in PostgreSQL
    await client.query('BEGIN');

    // 1. Seller User & Seller Profile
    const sellerUserRes = await client.query(`
      INSERT INTO users (email, role, is_verified, password_hash)
      VALUES ($1, 'seller', true, 'test-hash')
      RETURNING id
    `, [`seller-${Date.now()}@byblos.test`]);
    const sellerUserId = sellerUserRes.rows[0].id;

    const sellerRes = await client.query(`
      INSERT INTO sellers (user_id, full_name, shop_name, email, status, is_active, balance)
      VALUES ($1, 'Sim Seller', $2, $3, 'active', true, 0)
      RETURNING id
    `, [sellerUserId, `Sim-Shop-${Date.now()}`, `seller-${Date.now()}@byblos.test`]);
    testSellerId = sellerRes.rows[0].id;

    // 2. Buyer User & Buyer Profile
    const buyerUserRes = await client.query(`
      INSERT INTO users (email, role, is_verified, password_hash)
      VALUES ($1, 'buyer', true, 'test-hash')
      RETURNING id
    `, [`buyer-${Date.now()}@byblos.test`]);
    const buyerUserId = buyerUserRes.rows[0].id;

    const buyerRes = await client.query(`
      INSERT INTO buyers (user_id, full_name, email, mobile_payment, status)
      VALUES ($1, 'Sim Buyer', $2, '0712345678', 'active')
      RETURNING id
    `, [buyerUserId, `buyer-${Date.now()}@byblos.test`]);
    testBuyerId = buyerRes.rows[0].id;

    // 3. Product
    const prodRes = await client.query(`
      INSERT INTO products (seller_id, name, price, quantity, is_digital, product_type, status)
      VALUES ($1, 'Sim Sneaker', 2500, 10, false, 'physical', 'active')
      RETURNING id
    `, [testSellerId]);
    testProductId = prodRes.rows[0].id;

    // 4. Order
    const orderRes = await client.query(`
      INSERT INTO product_orders (
        order_number, buyer_id, seller_id, total_amount, platform_fee_amount,
        seller_payout_amount, status, payment_status, payment_method, buyer_name,
        client_checkout_token, order_type
      ) VALUES ($1, $2, $3, 5000, 250, 4750, 'PENDING', 'pending', 'paystack', 'Sim Buyer', $4, 'PHYSICAL')
      RETURNING id
    `, [`BYB-SIM-${Date.now()}`, testBuyerId, testSellerId, `token-${Date.now()}`]);
    testOrderId = orderRes.rows[0].id;

    // 5. Order item
    await client.query(`
      INSERT INTO order_items (order_id, product_id, name, product_name, price, product_price, quantity, subtotal)
      VALUES ($1, $2, 'Sim Sneaker', 'Sim Sneaker', 2500, 2500, 2, 5000)
    `, [testOrderId, testProductId]);

    // 6. Initial Pending Payment Record
    await client.query(`
      INSERT INTO payments (order_id, amount, status, payment_method, provider_reference, invoice_id)
      VALUES ($1, 5000, 'pending', 'paystack', $2, $2)
    `, [testOrderId, testRef]);

    await client.query('COMMIT');

    // =========================================================================
    // Simulation 1: Verify Order Entity & Clean Architecture Inward Decoupling
    // =========================================================================
    await t.test('1. Verify OrderReadService queries composite order via atomic JOIN', async () => {
      const result = await OrderReadService.getOrderWithItems(testOrderId);
      assert.ok(result, 'Expected order result');
      assert.equal(result.fullOrder.id, testOrderId);
      assert.equal(result.fullOrder.status, 'PENDING');
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].product_name, 'Sim Sneaker');
      assert.equal(Number(result.items[0].quantity), 2);
      assert.equal(result.payment.provider_reference, testRef);
      assert.equal(String(result.payment.status).toLowerCase(), 'pending');
    });

    // =========================================================================
    // Simulation 2: Payment Completion Event (M-Pesa STK / Webhook)
    // =========================================================================
    await t.test('2. Simulate Payment Completion Webhook Event via PaymentFulfillmentFacade', async () => {
      let paymentCompletedEmitted = false;
      let orderPaidEmitted = false;

      const onPaymentCompleted = (data) => {
        if (Number(data.orderId) === Number(testOrderId)) paymentCompletedEmitted = true;
      };
      const onOrderPaid = (data) => {
        if (Number(data.orderId) === Number(testOrderId)) orderPaidEmitted = true;
      };

      eventBus.on(AppEvents.PAYMENT.COMPLETED, onPaymentCompleted);
      eventBus.on(AppEvents.ORDER.PAID, onOrderPaid);

      const fulfillmentResult = await PaymentFulfillmentFacade.completePayment({
        providerReference: testRef,
        orderId: testOrderId,
        paidAmount: 5000,
        rawPayload: { event: 'charge.success', reference: testRef, amount: 500000 }
      });

      assert.equal(fulfillmentResult.success, true);
      assert.equal(fulfillmentResult.status, 'COMPLETED');
      assert.equal(fulfillmentResult.orderId, testOrderId);

      // Verify PostgreSQL state
      const checkRes = await pool.query(`
        SELECT p.status as payment_status, o.status as order_status, o.payment_status as order_pay_status
        FROM product_orders o
        JOIN payments p ON p.order_id = o.id
        WHERE o.id = $1
      `, [testOrderId]);

      assert.equal(String(checkRes.rows[0].payment_status).toLowerCase(), 'completed');
      assert.equal(checkRes.rows[0].order_status, 'PAID');
      assert.equal(String(checkRes.rows[0].order_pay_status).toLowerCase(), 'completed');

      // Allow event bus outbox & dispatch to complete
      for (let i = 0; i < 20; i++) {
        if (paymentCompletedEmitted && orderPaidEmitted) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      // Verify event notifications
      assert.equal(paymentCompletedEmitted, true, 'payment.completed event should be dispatched');
      assert.equal(orderPaidEmitted, true, 'order.paid event should be dispatched');

      eventBus.removeListener(AppEvents.PAYMENT.COMPLETED, onPaymentCompleted);
      eventBus.removeListener(AppEvents.ORDER.PAID, onOrderPaid);
    });

    // =========================================================================
    // Simulation 3: Idempotency (Duplicate Webhook Replay)
    // =========================================================================
    await t.test('3. Duplicate Webhook Replay is Idempotent & Does Not Corrupt State', async () => {
      const replayResult = await PaymentFulfillmentFacade.completePayment({
        providerReference: testRef,
        orderId: testOrderId,
        paidAmount: 5000,
        rawPayload: { event: 'charge.success', reference: testRef }
      });

      assert.equal(replayResult.success, true);
      assert.equal(replayResult.status, 'ALREADY_COMPLETED');
      assert.equal(replayResult.orderId, testOrderId);
    });

    // =========================================================================
    // Simulation 4: Fraud Detection (Amount Mismatch Simulation)
    // =========================================================================
    await t.test('4. Simulate Fraudulent Underpayment Webhook', async () => {
      const fraudRef = `fraud-pay-${Date.now()}`;
      const fraudOrderRes = await pool.query(`
        INSERT INTO product_orders (
          order_number, buyer_id, seller_id, total_amount, platform_fee_amount,
          seller_payout_amount, status, payment_status, client_checkout_token, order_type
        ) VALUES ($1, $2, $3, 10000, 500, 9500, 'PENDING', 'pending', $4, 'PHYSICAL')
        RETURNING id
      `, [`BYB-FRAUD-${Date.now()}`, testBuyerId, testSellerId, `fraud-tok-${Date.now()}`]);
      const fraudOrderId = fraudOrderRes.rows[0].id;

      await pool.query(`
        INSERT INTO payments (order_id, amount, status, payment_method, provider_reference, invoice_id)
        VALUES ($1, 10000, 'pending', 'paystack', $2, $2)
      `, [fraudOrderId, fraudRef]);

      const fraudResult = await PaymentFulfillmentFacade.completePayment({
        providerReference: fraudRef,
        orderId: fraudOrderId,
        paidAmount: 100 // Attacker paid 100 instead of 10000
      });

      assert.equal(fraudResult.success, false);
      assert.equal(fraudResult.status, 'MANUAL_REVIEW_AMOUNT_MISMATCH');

      // Verify order is NOT marked as PAID
      const verifyOrder = await pool.query('SELECT status FROM product_orders WHERE id = $1', [fraudOrderId]);
      assert.notEqual(verifyOrder.rows[0].status, 'PAID', 'Fraudulent order must not be marked PAID');
    });

    // =========================================================================
    // Simulation 5: Payment Failure Event Simulation
    // =========================================================================
    await t.test('5. Simulate Gateway Failure Callback (payment.failed)', async () => {
      const failRef = `fail-pay-${Date.now()}`;
      const failOrderRes = await pool.query(`
        INSERT INTO product_orders (
          order_number, buyer_id, seller_id, total_amount, platform_fee_amount,
          seller_payout_amount, status, payment_status, client_checkout_token, order_type
        ) VALUES ($1, $2, $3, 2000, 100, 1900, 'PENDING', 'pending', $4, 'PHYSICAL')
        RETURNING id
      `, [`BYB-FAIL-${Date.now()}`, testBuyerId, testSellerId, `fail-tok-${Date.now()}`]);
      const failOrderId = failOrderRes.rows[0].id;

      await pool.query(`
        INSERT INTO payments (order_id, amount, status, payment_method, provider_reference, invoice_id)
        VALUES ($1, 2000, 'pending', 'paystack', $2, $2)
      `, [failOrderId, failRef]);

      let failEventEmitted = false;
      const onPaymentFailed = (d) => {
        if (Number(d.orderId) === Number(failOrderId)) failEventEmitted = true;
      };
      eventBus.on(AppEvents.PAYMENT.FAILED, onPaymentFailed);

      const failResult = await PaymentFulfillmentFacade.handlePaymentFailure({
        providerReference: failRef,
        orderId: failOrderId,
        reason: 'Insufficient M-Pesa balance'
      });

      // Allow event bus outbox & dispatch to complete
      for (let i = 0; i < 20; i++) {
        if (failEventEmitted) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      assert.equal(failResult.success, true);
      assert.equal(failResult.status, 'FAILED');
      assert.equal(failEventEmitted, true, 'payment.failed event must be emitted');

      eventBus.removeListener(AppEvents.PAYMENT.FAILED, onPaymentFailed);
    });

  } finally {
    client.release();
  }
});
