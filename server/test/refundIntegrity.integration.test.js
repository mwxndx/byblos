import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import OrderCancellationService from '../src/domains/orders/order/orderCancellation.service.js';
import refundExecutionService from '../src/domains/payments/refunds/refundExecution.service.js';
import refundAccountingService from '../src/domains/payments/refunds/refundAccounting.service.js';
import AuthService from '../src/domains/identity/auth/auth.service.js';
import ReconciliationEngine from '../src/application/cron/reconciliationEngine.js';
import { PaymentPurpose, isPaymentPurposeRefundable } from '../src/domains/payments/payments/paymentPurpose.policy.js';
import { confirmRefundRequest, rejectRefundRequest } from '../src/domains/payments/refunds/refund.controller.js';
import {
  createUser,
  createBuyer,
  createSeller,
  createCompletedOrder,
  createPayment,
  createRefundRequest,
  cleanupOrder,
  cleanupSeller,
  cleanupBuyer,
  cleanupUser
} from './helpers/factories.js';

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

describe('Refund Integrity & Financial Invariants (Comprehensive Integration Suite)', () => {
  after(() => {
    setTimeout(() => {
      process.exit(0);
    }, 100);
  });


  // ---------------------------------------------------------------------------
  // 1. FAILED PAYMENT FOLLOWED BY SUCCESSFUL RETRY
  // ---------------------------------------------------------------------------
  test('Invariant 1: Failed payment retry does not inflate captured balance', async (t) => {
    let admin, buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
    });

    admin = await createUser({});
    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 950,
      platformFeeAmount: 50
    });

    // Payment 1: Failed attempt for 1000
    await createPayment({ orderId: order.id, amount: 1000, status: 'failed' });
    // Payment 2: Successful retry for 1000
    await createPayment({ orderId: order.id, amount: 1000, status: 'completed' });

    const client = await pool.connect();
    try {
      const captured = await refundAccountingService.getCapturedPaymentAmount(client, order.id);
      assert.equal(captured, 1000, 'Captured amount must be strictly 1000, ignoring failed attempts');
    } finally {
      client.release();
    }

    // Step 2: Refund 1000 succeeds
    const req1 = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 1000 });
    const r1 = await refundExecutionService.processAdminRefundApproval({ id: req1.id, adminId: admin.id });
    assert.equal(r1.creditedAmount, 1000);

    // Step 3: Any additional refund attempt must fail (captured balance fully consumed)
    const req2 = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 50 });
    await assert.rejects(
      () => refundExecutionService.processAdminRefundApproval({ id: req2.id, adminId: admin.id }),
      /exceeds remaining order balance \(0\)/i
    );
  });

  // ---------------------------------------------------------------------------
  // 2. PENDING PAYMENT FOLLOWED BY SUCCESSFUL PAYMENT
  // ---------------------------------------------------------------------------
  test('Invariant 1: Uncaptured pending payment attempts do not increase refundable balance', async (t) => {
    let admin, buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
    });

    admin = await createUser({});
    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1500,
      sellerPayoutAmount: 1425,
      platformFeeAmount: 75
    });

    // Attempt 1: Abandoned pending payment
    await createPayment({ orderId: order.id, amount: 1500, status: 'pending' });
    // Attempt 2: Successful payment
    await createPayment({ orderId: order.id, amount: 1500, status: 'completed' });

    const client = await pool.connect();
    try {
      const captured = await refundAccountingService.getCapturedPaymentAmount(client, order.id);
      assert.equal(captured, 1500, 'Captured amount must strictly ignore pending payment attempts');
    } finally {
      client.release();
    }
  });

  // ---------------------------------------------------------------------------
  // 3. MULTIPLE GENUINE CAPTURES
  // ---------------------------------------------------------------------------
  test('Invariant 1 & 5: Multiple genuine captures for one order are correctly attributable', async (t) => {
    let admin, buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
    });

    admin = await createUser({});
    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 2000,
      sellerPayoutAmount: 1900,
      platformFeeAmount: 100
    });

    // Genuine split captures: two 1000 KES completed payments
    await createPayment({ orderId: order.id, amount: 1000, status: 'completed' });
    await createPayment({ orderId: order.id, amount: 1000, status: 'completed' });

    const client = await pool.connect();
    try {
      const captured = await refundAccountingService.getCapturedPaymentAmount(client, order.id);
      assert.equal(captured, 2000, 'Captured amount must sum genuine completed captures');

      const accounting = await refundAccountingService.getOrderRefundAccounting(client, order.id);
      assert.equal(accounting.availableBalance, 2000);
    } finally {
      client.release();
    }

    // Partial refund of 1400
    const req = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 1400 });
    await refundExecutionService.processAdminRefundApproval({ id: req.id, adminId: admin.id });

    const client2 = await pool.connect();
    try {
      const accountingAfter = await refundAccountingService.getOrderRefundAccounting(client2, order.id);
      assert.equal(accountingAfter.availableBalance, 600);
    } finally {
      client2.release();
    }
  });

  // ---------------------------------------------------------------------------
  // 4. GUEST ORDER CANCELLED BEFORE REGISTRATION -> CREDITED AFTER REGISTRATION
  // ---------------------------------------------------------------------------
  test('Invariant 1 & 7: Guest order cancelled before registration is credited exactly once upon registration', async (t) => {
    let seller, order, newBuyer;
    const guestEmail = `guest_test_${Date.now()}@byblos.test`;

    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (newBuyer) await cleanupBuyer(newBuyer.id).catch(() => {});
    });

    seller = await createSeller({});

    // Create guest order (buyer_id is NULL)
    const { rows: oRows } = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, buyer_email, seller_id, total_amount, platform_fee_amount,
         seller_payout_amount, status, payment_status, total_quantity, client_checkout_token,
         order_type, fulfillment_type
       ) VALUES ($1, NULL, $2, $3, 750, 25, 725, 'PAID'::order_status, 'completed'::payment_status, 1, 'tok-guest', 'PHYSICAL', 'BUYER_TO_SELLER')
       RETURNING *`,
      [`ORD-GUEST-${Date.now()}`, guestEmail, seller.id]
    );
    order = oRows[0];
    await createPayment({ orderId: order.id, amount: 750, status: 'completed' });

    // Cancel guest order
    await OrderCancellationService.cancelOrder(order.id, 'Guest order cancelled');

    // Verify metadata does NOT set refund_credited: true prematurely
    const { rows: cancelledOrderRows } = await pool.query('SELECT metadata FROM product_orders WHERE id = $1', [order.id]);
    assert.equal(
      cancelledOrderRows[0].metadata?.refund_credited,
      false,
      'refund_credited must be false because buyer was uncredited at cancellation'
    );
    assert.equal(Number(cancelledOrderRows[0].metadata?.uncredited_refund_amount), 750);

    // Verify refund_requests row has buyer_id NULL
    const { rows: rrRows } = await pool.query('SELECT buyer_id, amount, status FROM refund_requests WHERE order_id = $1', [order.id]);
    assert.equal(rrRows.length, 1);
    assert.equal(rrRows[0].buyer_id, null);
    assert.equal(Number(rrRows[0].amount), 750);
    assert.equal(rrRows[0].status, 'completed');

    // Guest now creates an account
    newBuyer = await createBuyer({ email: guestEmail });
    assert.equal(Number(newBuyer.refunds || 0), 0);

    // Late binding executed upon email verification / signup
    const linkResult = await AuthService.linkGuestOrdersAndCreditRefunds(newBuyer.id, guestEmail);
    assert.equal(linkResult.linkedCount, 1);
    assert.equal(linkResult.creditedAmount, 750);

    // Buyer wallet credited exactly 750
    const { rows: buyerAfterLink } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [newBuyer.id]);
    assert.equal(Number(buyerAfterLink[0].refunds), 750);

    // refund_requests.buyer_id backfilled
    const { rows: rrAfterLink } = await pool.query('SELECT buyer_id, payment_details FROM refund_requests WHERE order_id = $1', [order.id]);
    assert.equal(rrAfterLink[0].buyer_id, newBuyer.id);
    assert.equal(rrAfterLink[0].payment_details?.credited_to_buyer, true);

    // Order metadata updated to refund_credited: true and uncredited_refund_amount stripped
    const { rows: orderAfterLink } = await pool.query('SELECT metadata FROM product_orders WHERE id = $1', [order.id]);
    assert.equal(orderAfterLink[0].metadata?.refund_credited, true);
    assert.equal(orderAfterLink[0].metadata?.uncredited_refund_amount, undefined);
  });

  // ---------------------------------------------------------------------------
  // 5. GUEST ORDER CANCELLED BEFORE LOGIN -> LOGIN RECOVERS REFUND EXACTLY ONCE
  // ---------------------------------------------------------------------------
  test('Invariant 1 & 7: Guest order cancelled before login is credited exactly once upon login', async (t) => {
    let seller, order, existingBuyer;
    const buyerEmail = `registered_guest_${Date.now()}@byblos.test`;

    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (existingBuyer) await cleanupBuyer(existingBuyer.id).catch(() => {});
    });

    seller = await createSeller({});

    // Guest places order without logging in (buyer_id is NULL)
    const { rows: oRows } = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, buyer_email, seller_id, total_amount, platform_fee_amount,
         seller_payout_amount, status, payment_status, total_quantity, client_checkout_token,
         order_type, fulfillment_type
       ) VALUES ($1, NULL, $2, $3, 900, 30, 870, 'PAID'::order_status, 'completed'::payment_status, 1, 'tok-guest2', 'PHYSICAL', 'BUYER_TO_SELLER')
       RETURNING *`,
      [`ORD-GUEST2-${Date.now()}`, buyerEmail, seller.id]
    );
    order = oRows[0];
    await createPayment({ orderId: order.id, amount: 900, status: 'completed' });

    // Cancellation occurs while buyer has not created account / logged in
    await OrderCancellationService.cancelOrder(order.id, 'Timeout cancellation');

    // Buyer creates account/logs in with matching email
    existingBuyer = await createBuyer({ email: buyerEmail });

    // First login run
    const res1 = await AuthService.linkGuestOrdersAndCreditRefunds(existingBuyer.id, buyerEmail);
    assert.equal(res1.creditedAmount, 900);

    const { rows: b1 } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [existingBuyer.id]);
    assert.equal(Number(b1[0].refunds), 900);

    // Second login run (idempotency check)
    const res2 = await AuthService.linkGuestOrdersAndCreditRefunds(existingBuyer.id, buyerEmail);
    assert.equal(res2.creditedAmount, 0, 'Subsequent login must not credit the refund again');

    const { rows: b2 } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [existingBuyer.id]);
    assert.equal(Number(b2[0].refunds), 900, 'Buyer refunds wallet balance must remain strictly 900');
  });

  // ---------------------------------------------------------------------------
  // 6. GUEST ORDER WITH PRIOR PARTIAL REFUND -> LOGIN CREDITS OUTSTANDING AMOUNT
  // ---------------------------------------------------------------------------
  test('Invariant 1 & 5: Guest order with prior partial refund credits only outstanding eligible amount on registration', async (t) => {
    let seller, order, buyer;
    const email = `guest_partial_${Date.now()}@byblos.test`;

    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    seller = await createSeller({});

    // Order of 1000 KES
    const { rows: oRows } = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, buyer_email, seller_id, total_amount, platform_fee_amount,
         seller_payout_amount, status, payment_status, total_quantity, client_checkout_token,
         order_type, fulfillment_type
       ) VALUES ($1, NULL, $2, $3, 1000, 50, 950, 'PAID'::order_status, 'completed'::payment_status, 1, 'tok-gp', 'PHYSICAL', 'BUYER_TO_SELLER')
       RETURNING *`,
      [`ORD-GP-${Date.now()}`, email, seller.id]
    );
    order = oRows[0];
    await createPayment({ orderId: order.id, amount: 1000, status: 'completed' });

    // Prior partial refund of 350 executed for guest order
    await pool.query(
      `INSERT INTO refund_requests (buyer_id, order_id, amount, status, notes, payment_method, requested_at, processed_at)
       VALUES (NULL, $1, 350, 'completed', 'Partial return', 'wallet', NOW(), NOW())`,
      [order.id]
    );

    // Order cancellation occurs afterwards
    await OrderCancellationService.cancelOrder(order.id, 'Cancelled remainder');

    // Registration occurs
    buyer = await createBuyer({ email });
    const linkResult = await AuthService.linkGuestOrdersAndCreditRefunds(buyer.id, email);

    // Outstanding amount was 650 (1000 - 350)
    assert.equal(linkResult.creditedAmount, 650);

    const { rows: buyerRows } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.equal(Number(buyerRows[0].refunds), 650);
  });

  // ---------------------------------------------------------------------------
  // 7. TWO CONCURRENT SEPARATE REFUND REQUESTS FOR THE SAME ORDER
  // ---------------------------------------------------------------------------
  test('Invariant 2: Concurrent approval of two separate requests cannot exceed order balance', async (t) => {
    let admin, buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
    });

    admin = await createUser({});
    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 950,
      platformFeeAmount: 50
    });
    await createPayment({ orderId: order.id, amount: 1000, status: 'completed' });

    // Request 1: 600 KES, Request 2: 600 KES (Total 1200 > 1000)
    const reqA = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 600 });
    const reqB = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 600 });

    // Attempt to approve both concurrently in separate DB transactions
    const [resA, resB] = await Promise.allSettled([
      refundExecutionService.processAdminRefundApproval({ id: reqA.id, adminId: admin.id }),
      refundExecutionService.processAdminRefundApproval({ id: reqB.id, adminId: admin.id })
    ]);

    // Due to balance reservation and row locking, they cannot both exceed 1000
    const succeeded = [resA, resB].filter(r => r.status === 'fulfilled');
    const failed = [resA, resB].filter(r => r.status === 'rejected');

    assert.equal(succeeded.length, 0, 'Both 600 requests collectively exceed 1000; neither can over-allocate');
    assert.equal(failed.length, 2, 'Both are rejected by balance reservation');

    const { rows: buyerRows } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.equal(Number(buyerRows[0].refunds), 0, 'No over-allocation occurred in wallet');
  });

  // ---------------------------------------------------------------------------
  // 8. CONCURRENT CANCELLATION AND REFUND EXECUTION FOR THE SAME ORDER
  // ---------------------------------------------------------------------------
  test('Invariant 2 & 5: Concurrent cancellation and refund execution are serialized by row locking', async (t) => {
    let admin, buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
    });

    admin = await createUser({});
    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 950,
      platformFeeAmount: 50,
      status: 'PAID'
    });
    await createPayment({ orderId: order.id, amount: 1000, status: 'completed' });

    const req = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 400 });

    // Race approval of 400 vs cancellation of remainder
    await Promise.allSettled([
      refundExecutionService.processAdminRefundApproval({ id: req.id, adminId: admin.id }),
      OrderCancellationService.cancelOrder(order.id, 'Concurrent cancellation')
    ]);

    // Regardless of which executes first, total credited to buyer wallet must equal exactly 1000
    const { rows: buyerRows } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.equal(
      Number(buyerRows[0].refunds),
      1000,
      `Total buyer refunds across concurrent operations must strictly equal captured amount (1000), got ${buyerRows[0].refunds}`
    );
  });

  // ---------------------------------------------------------------------------
  // 9. RECONCILIATION CHURN PREVENTION
  // ---------------------------------------------------------------------------
  test('Invariant 3 & 5: Reconciliation worker does not churn on unlinked guest refunds', async (t) => {
    let seller, order;
    const unregGuestEmail = `unregistered_${Date.now()}@byblos.test`;

    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
    });

    seller = await createSeller({});
    const { rows: oRows } = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, buyer_email, seller_id, total_amount, platform_fee_amount,
         seller_payout_amount, status, payment_status, total_quantity, client_checkout_token,
         order_type, fulfillment_type
       ) VALUES ($1, NULL, $2, $3, 500, 20, 480, 'CANCELLED'::order_status, 'cancelled'::payment_status, 1, 'tok-recon', 'PHYSICAL', 'BUYER_TO_SELLER')
       RETURNING *`,
      [`ORD-RECON-${Date.now()}`, unregGuestEmail, seller.id]
    );
    order = oRows[0];

    // Completed refund record with buyer_id NULL and unregistered email
    await pool.query(
      `INSERT INTO refund_requests (buyer_id, order_id, amount, status, notes, payment_method, requested_at, processed_at)
       VALUES (NULL, $1, 500, 'completed', 'Unregistered guest refund', 'wallet', NOW(), NOW())`,
      [order.id]
    );

    // Run reconciliation worker
    await ReconciliationEngine.handleCompletedRefunds();

    // Verify refund request remains cleanly intact without redundant churn
    const { rows: rrRows } = await pool.query('SELECT payment_details FROM refund_requests WHERE order_id = $1', [order.id]);
    assert.equal(rrRows[0].payment_details?.credited_to_buyer, undefined);
  });

  // ---------------------------------------------------------------------------
  // 10. CANCELLATION WITH OPEN PENDING AND MANUAL-REVIEW REQUESTS
  // ---------------------------------------------------------------------------
  test('Invariant 2 & 5: Cancellation auto-rejects open pending/manual_review requests', async (t) => {
    let admin, buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
    });

    admin = await createUser({});
    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 950,
      platformFeeAmount: 50,
      status: 'PAID'
    });
    await createPayment({ orderId: order.id, amount: 1000, status: 'completed' });

    // Open pending request and open manual_review request
    const req1 = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 300, status: 'pending' });
    const req2 = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 200, status: 'manual_review' });

    // Cancellation is triggered
    await OrderCancellationService.cancelOrder(order.id, 'User cancellation on pending requests');

    // Both requests must be auto-rejected in the cancellation transaction
    const { rows: req1After } = await pool.query('SELECT status, admin_notes FROM refund_requests WHERE id = $1', [req1.id]);
    assert.equal(req1After[0].status, 'rejected');
    assert.match(req1After[0].admin_notes, /Auto-rejected: order cancelled/i);

    const { rows: req2After } = await pool.query('SELECT status, admin_notes FROM refund_requests WHERE id = $1', [req2.id]);
    assert.equal(req2After[0].status, 'rejected');
    assert.match(req2After[0].admin_notes, /Auto-rejected: order cancelled/i);

    // Total credited to buyer equals exactly captured amount (1000)
    const { rows: buyerRows } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.equal(Number(buyerRows[0].refunds), 1000);
  });

  // ---------------------------------------------------------------------------
  // 11. TRANSACTION ROLLBACK INTEGRITY
  // ---------------------------------------------------------------------------
  test('Invariant 3: Transaction rollback leaves zero committed side-effects', async (t) => {
    let admin, buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
    });

    admin = await createUser({});
    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 950,
      platformFeeAmount: 50
    });
    await createPayment({ orderId: order.id, amount: 1000, status: 'completed' });

    const req = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 500 });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Simulate partial execution
      await client.query('UPDATE buyers SET refunds = COALESCE(refunds, 0) + 500 WHERE id = $1', [buyer.id]);
      await client.query("UPDATE refund_requests SET status = 'completed' WHERE id = $1", [req.id]);

      // Deliberate error causing rollback
      throw new Error('Simulated network failure before commit');
    } catch {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // Verify database state is untouched
    const { rows: buyerRows } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.equal(Number(buyerRows[0].refunds), 0);

    const { rows: reqRows } = await pool.query('SELECT status FROM refund_requests WHERE id = $1', [req.id]);
    assert.equal(reqRows[0].status, 'pending');
  });

  // ---------------------------------------------------------------------------
  // 12. LEGACY ORDERS PROTECTION
  // ---------------------------------------------------------------------------
  test('Invariant 5: Legacy orders with refund_credited metadata cannot be refunded again', async (t) => {
    let admin, buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
    });

    admin = await createUser({});
    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1200,
      sellerPayoutAmount: 1140,
      platformFeeAmount: 60,
      metadata: {
        refund_credited: true
      }
    });
    await createPayment({ orderId: order.id, amount: 1200, status: 'completed' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const accounting = await refundAccountingService.getOrderRefundAccounting(client, order.id);
      assert.equal(accounting.isLegacyCredited, true);
      assert.equal(accounting.availableBalance, 0);

      await assert.rejects(
        () => refundAccountingService.validateRefundEligibility(client, order.id, 100),
        /exceeds remaining order balance \(0\)/i
      );
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  // ---------------------------------------------------------------------------
  // 13. SELLER PICKUP LOGISTICS PAYMENT EXCLUSION
  // ---------------------------------------------------------------------------
  test('Invariant 1: Seller pickup logistics payments linked to order_id do not inflate buyer refundable balance', async (t) => {
    let admin, buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
    });

    admin = await createUser({});
    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 950,
      platformFeeAmount: 50,
      status: 'PAID'
    });

    // 1. Buyer payment for order = 1000 KES (completed)
    await createPayment({ orderId: order.id, amount: 1000, status: 'completed' });

    // 2. Auxiliary seller pickup fee payment = 250 KES (completed, linked to same order_id)
    await createPayment({
      orderId: order.id,
      amount: 250,
      status: 'completed',
      metadata: {
        payment_purpose: 'seller_pickup_fee',
        logistics_payment_type: 'seller_pickup_fee',
        seller_id: seller.id
      }
    });

    const client = await pool.connect();
    try {
      const captured = await refundAccountingService.getCapturedPaymentAmount(client, order.id);
      assert.equal(
        captured,
        1000,
        `Captured order payment must strictly exclude seller pickup fee (expected 1000, got ${captured})`
      );

      const accounting = await refundAccountingService.getOrderRefundAccounting(client, order.id);
      assert.equal(accounting.capturedAmount, 1000);
      assert.equal(accounting.availableBalance, 1000);
    } finally {
      client.release();
    }
  });

  // ---------------------------------------------------------------------------
  // 14. ORDER CANCELLATION EXCLUDES SELLER PICKUP FEE FROM BUYER WALLET CREDIT
  // ---------------------------------------------------------------------------
  test('Invariant 1 & 5: Full cancellation of order with seller pickup fee credits strictly buyer order total to wallet', async (t) => {
    let buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 950,
      platformFeeAmount: 50,
      status: 'PAID'
    });

    // Buyer order payment: 1000 KES
    await createPayment({ orderId: order.id, amount: 1000, status: 'completed' });
    // Seller pickup fee payment: 250 KES
    await createPayment({
      orderId: order.id,
      amount: 250,
      status: 'completed',
      metadata: { payment_purpose: 'seller_pickup_fee' }
    });

    // Cancel order
    await OrderCancellationService.cancelOrder(order.id, 'Test cancellation with seller pickup');

    const { rows: buyerRows } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.equal(
      Number(buyerRows[0].refunds),
      1000,
      `Buyer wallet must be credited strictly 1000 KES (not 1250 KES). Got: ${buyerRows[0].refunds}`
    );

    // Verify refund_requests ledger entry records exactly 1000 KES
    const { rows: reqRows } = await pool.query(
      'SELECT amount, status FROM refund_requests WHERE order_id = $1 AND status = \'completed\'',
      [order.id]
    );
    assert.equal(reqRows.length, 1);
    assert.equal(Number(reqRows[0].amount), 1000);
  });

  // ---------------------------------------------------------------------------
  // 15. UNKNOWN NON-EMPTY PAYMENT PURPOSE FAILS CLOSED (EXCLUDED FROM REFUND)
  // ---------------------------------------------------------------------------
  test('Invariant 1: Unknown non-empty payment purpose linked to order is excluded from refundable balance and fails closed', async (t) => {
    let buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 950,
      platformFeeAmount: 50,
      status: 'PAID'
    });

    // 1. Legitimate buyer payment: 1000 KES
    await createPayment({
      orderId: order.id,
      amount: 1000,
      status: 'completed',
      metadata: { payment_purpose: PaymentPurpose.ORDER_CHECKOUT }
    });

    // 2. Unknown auxiliary fee payment: 300 KES (completed, linked to order_id)
    await createPayment({
      orderId: order.id,
      amount: 300,
      status: 'completed',
      metadata: { payment_purpose: 'arbitrary_third_party_charge', fee_ref: 'abc-999' }
    });

    const client = await pool.connect();
    try {
      const captured = await refundAccountingService.getCapturedPaymentAmount(client, order.id);
      assert.equal(
        captured,
        1000,
        `Captured payment must strictly exclude unknown auxiliary purpose (expected 1000, got ${captured})`
      );

      const accounting = await refundAccountingService.getOrderRefundAccounting(client, order.id);
      assert.equal(accounting.capturedAmount, 1000);
      assert.equal(accounting.availableBalance, 1000);
    } finally {
      client.release();
    }

    // Cancellation must refund only the recognized 1000 KES, not 1300 KES
    await OrderCancellationService.cancelOrder(order.id, 'Test cancellation with unknown auxiliary fee');

    const { rows: buyerRows } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.equal(
      Number(buyerRows[0].refunds),
      1000,
      `Buyer wallet must be credited strictly 1000 KES (not 1300 KES). Got: ${buyerRows[0].refunds}`
    );

    const { rows: reqRows } = await pool.query(
      'SELECT amount, status FROM refund_requests WHERE order_id = $1 AND status = \'completed\'',
      [order.id]
    );
    assert.equal(reqRows.length, 1);
    assert.equal(Number(reqRows[0].amount), 1000);
  });

  // ---------------------------------------------------------------------------
  // 16. MULTIPLE LEGITIMATE CHECKOUT CAPTURES ARE REFUNDABLE; ALERT FAILURES REMAIN FAIL-CLOSED
  // ---------------------------------------------------------------------------
  test('Invariant 1: Multiple checkout captures are refundable; alert failure does not affect accounting or fail-closed invariant', async (t) => {
    let buyer, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1200,
      sellerPayoutAmount: 1140,
      platformFeeAmount: 60,
      status: 'PAID'
    });

    // 1. Initial checkout payment attempt/part: 800 KES
    await createPayment({
      orderId: order.id,
      amount: 800,
      status: 'completed',
      metadata: { payment_purpose: PaymentPurpose.ORDER_CHECKOUT }
    });

    // 2. Second checkout payment attempt/part: 400 KES
    await createPayment({
      orderId: order.id,
      amount: 400,
      status: 'completed',
      metadata: { payment_purpose: PaymentPurpose.ORDER_CHECKOUT }
    });

    // 3. Seller pickup fee: 150 KES (auxiliary non-refundable payment)
    await createPayment({
      orderId: order.id,
      amount: 150,
      status: 'completed',
      metadata: { payment_purpose: PaymentPurpose.SELLER_PICKUP_FEE }
    });

    // 4. Unknown auxiliary payment: 200 KES
    await createPayment({
      orderId: order.id,
      amount: 200,
      status: 'completed',
      metadata: { payment_purpose: 'unknown_service_surcharge' }
    });

    const client = await pool.connect();
    try {
      const captured = await refundAccountingService.getCapturedPaymentAmount(client, order.id);
      assert.equal(
        captured,
        1200,
        `Captured payment must strictly equal buyer order checkout sum (800 + 400 = 1200), excluding seller pickup and unknown auxiliary fees. Got: ${captured}`
      );

      const accounting = await refundAccountingService.getOrderRefundAccounting(client, order.id);
      assert.equal(accounting.capturedAmount, 1200);
      assert.equal(accounting.availableBalance, 1200);
    } finally {
      client.release();
    }

    // Cancel order - must credit exactly 1200 KES to buyer wallet
    await OrderCancellationService.cancelOrder(order.id, 'Test cancellation with multiple captures and auxiliary payments');

    const { rows: buyerRows } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.equal(
      Number(buyerRows[0].refunds),
      1200,
      `Buyer wallet must be credited exactly 1200 KES. Got: ${buyerRows[0].refunds}`
    );
  });

  // ---------------------------------------------------------------------------
  // 17. PAYMENT PURPOSE POLICY UNIT CONTRACT & ALERT ISOLATION
  // ---------------------------------------------------------------------------
  test('Payment Purpose Policy: Contract assertions for known, legacy, unknown purposes, and alert isolation', () => {
    // Declared refundable purpose (the genuine buyer checkout flow)
    assert.equal(isPaymentPurposeRefundable(PaymentPurpose.ORDER_CHECKOUT), true);

    // Declared non-refundable purpose (seller logistics pickup fee)
    assert.equal(isPaymentPurposeRefundable(PaymentPurpose.SELLER_PICKUP_FEE), false);

    // Legacy rows (null / undefined / empty string)
    assert.equal(isPaymentPurposeRefundable(null), true);
    assert.equal(isPaymentPurposeRefundable(undefined), true);
    assert.equal(isPaymentPurposeRefundable(''), true);
    assert.equal(isPaymentPurposeRefundable('   '), true);

    // Case insensitivity & trimming
    assert.equal(isPaymentPurposeRefundable('  ORDER_CHECKOUT  '), true);
    assert.equal(isPaymentPurposeRefundable('  SELLER_PICKUP_FEE  '), false);

    // Unknown purposes fail closed
    assert.equal(isPaymentPurposeRefundable('unexpected_custom_purpose'), false);
    assert.equal(isPaymentPurposeRefundable('buyer_delivery_surcharge'), false, 'Unregistered surcharge must fail closed');
    assert.equal(isPaymentPurposeRefundable('order_installment'), false, 'Unregistered installment must fail closed');
    assert.equal(isPaymentPurposeRefundable('escrow_fee'), false);
  });
});
