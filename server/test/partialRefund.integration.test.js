import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import EscrowManager from '../src/domains/orders/escrow/EscrowManager.js';
import { confirmRefundRequest } from '../src/domains/payments/refunds/refund.controller.js';
import {
  createUser,
  createBuyer,
  createSeller,
  createCreator,
  createSellerCreatorLink,
  createCompletedOrder,
  createPayment,
  createRefundRequest,
  cleanupOrder,
  cleanupCreator,
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

describe('partialRefund (integration, ECC finance & returns)', () => {
  after(async () => {
    await pool.end().catch(() => {});
  });

  test('prorates seller escrow and creator commissions across partial refunds and guards state machine', async (t) => {
    let admin, buyer, seller, creator, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (creator) await cleanupCreator(creator.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
    });

    admin = await createUser({});
    buyer = await createBuyer({});
    seller = await createSeller({});
    creator = await createCreator({});
    const link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id, commissionRate: 0.05 });

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 940,
      platformFeeAmount: 10,
      metadata: {
        creator_attribution: {
          creator_id: creator.id,
          seller_creator_link_id: link.id,
          seller_id: seller.id,
          commission_rate: 0.05,
          commission_base_amount: 1000,
          commission_amount: 50
        }
      }
    });
    await createPayment({ orderId: order.id, amount: 1000 });

    // 1. Release escrow: Creator gets 50, Seller gets 940 in pending_settlement
    const escrowClient = await pool.connect();
    try {
      await escrowClient.query('BEGIN');
      await EscrowManager.releaseFunds(escrowClient, order, 'integration-test');
      await escrowClient.query('COMMIT');
    } finally {
      escrowClient.release();
    }

    const { rows: initialCreator } = await pool.query('SELECT balance FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(initialCreator[0].balance), 50);

    const { rows: initialSeller } = await pool.query('SELECT pending_settlement_balance FROM sellers WHERE id = $1', [seller.id]);
    assert.equal(Number(initialSeller[0].pending_settlement_balance), 940);

    // 2. Buyer requests full 1000 refund, but Admin authorizes a PARTIAL refund of 500
    const refundRequest1 = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 1000 });

    const req1 = {
      params: { id: refundRequest1.id },
      body: { adminNotes: 'Partial refund approved for damaged item', approvedAmount: 500 },
      user: { id: admin.id }
    };
    const res1 = fakeRes();
    let err1 = null;
    await confirmRefundRequest(req1, res1, (err) => { err1 = err; });

    assert.equal(err1, null, `confirmRefundRequest error: ${err1?.message}`);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.data.creditedAmount, 500);
    assert.equal(res1.body.data.isPartial, true);

    // Verify buyer received 500
    const { rows: buyerAfterPart1 } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.equal(Number(buyerAfterPart1[0].refunds), 500);

    // Verify creator was clawed back by exactly 50% (25) -> balance remaining: 25
    const { rows: creatorAfterPart1 } = await pool.query('SELECT balance, total_earnings FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(creatorAfterPart1[0].balance), 25);
    assert.equal(Number(creatorAfterPart1[0].total_earnings), 25);

    const { rows: earnRows1 } = await pool.query('SELECT status, metadata FROM creator_earnings WHERE order_id = $1', [order.id]);
    assert.equal(earnRows1[0].status, 'partially_reversed');
    assert.equal(Number(earnRows1[0].metadata.total_reversed), 25);

    // Verify seller pending settlement was deducted by 50% (470) -> remaining: 470
    const { rows: sellerAfterPart1 } = await pool.query(
      'SELECT pending_settlement_balance, refund_reserved_balance FROM sellers WHERE id = $1',
      [seller.id]
    );
    assert.equal(Number(sellerAfterPart1[0].pending_settlement_balance), 470);
    assert.equal(Number(sellerAfterPart1[0].refund_reserved_balance), 470);

    const { rows: payoutRows1 } = await pool.query(
      'SELECT status, settlement_status, settlement_metadata FROM payouts WHERE order_id = $1',
      [order.id]
    );
    assert.equal(payoutRows1[0].settlement_status, 'partially_refunded');
    assert.equal(Number(payoutRows1[0].settlement_metadata.total_reversed), 470);

    // CRITICAL: Order operational status must NOT be overwritten to REFUNDED!
    const { rows: orderRows1 } = await pool.query('SELECT status, payment_status, metadata FROM product_orders WHERE id = $1', [order.id]);
    assert.equal(orderRows1[0].status, 'COMPLETED', 'Order status must remain COMPLETED after partial refund');
    assert.equal(orderRows1[0].metadata.refund_summary.refund_status, 'PARTIALLY_REFUNDED');
    assert.equal(Number(orderRows1[0].metadata.refund_summary.total_refunded), 500);

    // 3. Second partial refund of remaining 500
    const refundRequest2 = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 500 });
    const req2 = {
      params: { id: refundRequest2.id },
      body: { adminNotes: 'Final partial refund', approvedAmount: 500 },
      user: { id: admin.id }
    };
    const res2 = fakeRes();
    let err2 = null;
    await confirmRefundRequest(req2, res2, (err) => { err2 = err; });

    assert.equal(err2, null, `confirmRefundRequest error: ${err2?.message}`);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.data.isPartial, false);

    // Buyer received remaining 500 -> total 1000
    const { rows: buyerAfterPart2 } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.equal(Number(buyerAfterPart2[0].refunds), 1000);

    // Creator fully clawed back (25 remaining -> balance 0)
    const { rows: creatorAfterPart2 } = await pool.query('SELECT balance, total_earnings FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(creatorAfterPart2[0].balance), 0);
    assert.equal(Number(creatorAfterPart2[0].total_earnings), 0);

    const { rows: earnRows2 } = await pool.query('SELECT status, metadata FROM creator_earnings WHERE order_id = $1', [order.id]);
    assert.equal(earnRows2[0].status, 'reversed');
    assert.equal(Number(earnRows2[0].metadata.total_reversed), 50);

    // Seller pending settlement deducted remaining 470 -> balance 0
    const { rows: sellerAfterPart2 } = await pool.query(
      'SELECT pending_settlement_balance, refund_reserved_balance FROM sellers WHERE id = $1',
      [seller.id]
    );
    assert.equal(Number(sellerAfterPart2[0].pending_settlement_balance), 0);
    assert.equal(Number(sellerAfterPart2[0].refund_reserved_balance), 940);

    const { rows: payoutRows2 } = await pool.query('SELECT status, settlement_status FROM payouts WHERE order_id = $1', [order.id]);
    assert.equal(payoutRows2[0].status, 'refunded');
    assert.equal(payoutRows2[0].settlement_status, 'refunded_before_settlement');

    // NOW order is fully refunded -> status transitions to REFUNDED
    const { rows: orderRows2 } = await pool.query('SELECT status, metadata FROM product_orders WHERE id = $1', [order.id]);
    assert.equal(orderRows2[0].status, 'REFUNDED');
    assert.equal(orderRows2[0].metadata.refund_summary.refund_status, 'FULLY_REFUNDED');
    assert.equal(Number(orderRows2[0].metadata.refund_summary.total_refunded), 1000);

    // 4. Over-refund Protection: attempting to refund any more on this order must fail
    const refundRequest3 = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 100 });
    const req3 = {
      params: { id: refundRequest3.id },
      body: { adminNotes: 'Attempting excess refund', approvedAmount: 100 },
      user: { id: admin.id }
    };
    const res3 = fakeRes();
    let err3 = null;
    await confirmRefundRequest(req3, res3, (err) => { err3 = err; });

    assert.notEqual(err3, null, 'Must reject over-refund exceeding order total');
    assert.match(err3.message, /exceeds remaining order balance/i);

    // 5. Approved Amount Validation: attempting to approve more than requested amount must fail
    const refundRequest4 = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 50 });
    const req4 = {
      params: { id: refundRequest4.id },
      body: { adminNotes: 'Excess approval', approvedAmount: 100 },
      user: { id: admin.id }
    };
    const res4 = fakeRes();
    let err4 = null;
    await confirmRefundRequest(req4, res4, (err) => { err4 = err; });

    assert.notEqual(err4, null, 'Must reject approval amount exceeding requested amount');
    assert.match(err4.message, /cannot exceed requested amount/i);
  });
});
