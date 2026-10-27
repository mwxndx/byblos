import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import refundExecutionService from '../src/domains/payments/refunds/refundExecution.service.js';
import ReconciliationEngine from '../src/application/cron/reconciliationEngine.js';
import { createUser, createBuyer, createSeller, cleanupOrder, cleanupSeller, cleanupBuyer } from './helpers/factories.js';

describe('Guest Refund Reconciliation State (FIN-02 / H-01)', () => {
  test('unregistered guest refund sets credited_to_buyer = false and is later reconciled upon registration', async (t) => {
    let admin, seller, order, refundRequestId, registeredBuyer;
    const guestEmail = `guest_recon_${Date.now()}@byblos.test`;

    t.after(async () => {
      if (refundRequestId) await pool.query('DELETE FROM refund_requests WHERE id = $1', [refundRequestId]).catch(() => {});
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (admin) await pool.query('DELETE FROM users WHERE id = $1', [admin.id]).catch(() => {});
      if (registeredBuyer) await cleanupBuyer(registeredBuyer.id).catch(() => {});
    });

    admin = await createUser({ role: 'admin' });
    seller = await createSeller({});

    // 1. Create a paid guest order (buyer_id is NULL)
    const { rows: oRows } = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, buyer_email, seller_id, total_amount, platform_fee_amount,
         seller_payout_amount, status, payment_status, total_quantity, client_checkout_token,
         order_type, fulfillment_type
       ) VALUES ($1, NULL, $2, $3, 1500, 75, 1425, 'PAID'::order_status, 'completed'::payment_status, 1, 'tok-recon-guest', 'PHYSICAL', 'BUYER_TO_SELLER')
       RETURNING *`,
      [`ORD-GUEST-RECON-${Date.now()}`, guestEmail, seller.id]
    );
    order = oRows[0];

    // Create a completed payment so captured balance is 1500
    await pool.query(
      `INSERT INTO payments (
         order_id, invoice_id, amount, currency, status, payment_method, metadata, created_at, updated_at
       ) VALUES ($1, $2, 1500, 'KES', 'completed', 'mpesa', '{"payment_purpose": "order_checkout"}', NOW(), NOW())`,
      [order.id, String(order.id)]
    );

    // 2. Create pending refund request for 1500 with buyer_id = NULL
    const { rows: rrRows } = await pool.query(
      `INSERT INTO refund_requests (
         buyer_id, order_id, amount, status, notes, payment_method, requested_at
       ) VALUES (NULL, $1, 1500, 'pending', 'Customer return', 'wallet', NOW())
       RETURNING *`,
      [order.id]
    );
    refundRequestId = rrRows[0].id;

    // 3. Process refund approval for the unregistered guest
    await refundExecutionService.processAdminRefundApproval({
      id: refundRequestId,
      adminId: admin.id,
      adminNotes: 'Admin approved guest refund'
    });

    // 4. Verify refund_requests state: credited_to_buyer MUST be false because buyer does not exist!
    const { rows: [completedRR] } = await pool.query(
      'SELECT status, payment_details FROM refund_requests WHERE id = $1',
      [refundRequestId]
    );
    assert.equal(completedRR.status, 'completed');
    assert.equal(
      completedRR.payment_details?.credited_to_buyer,
      false,
      'credited_to_buyer must be false when guest is unregistered'
    );

    // 5. Verify order metadata: uncredited_refund_amount must be tracked and refund_credited must be false
    const { rows: [updatedOrder] } = await pool.query(
      'SELECT status, metadata FROM product_orders WHERE id = $1',
      [order.id]
    );
    assert.equal(updatedOrder.status, 'REFUNDED');
    assert.equal(Number(updatedOrder.metadata?.uncredited_refund_amount), 1500);
    assert.equal(updatedOrder.metadata?.refund_credited, false);

    // 6. Reconciliation worker runs before buyer registers -> does nothing
    await ReconciliationEngine.handleCompletedRefunds();

    // 7. Guest now registers an account with that email
    registeredBuyer = await createBuyer({ email: guestEmail });
    assert.equal(Number(registeredBuyer.refunds || 0), 0);

    // 8. Reconciliation worker runs after registration -> successfully credits buyer!
    await ReconciliationEngine.handleCompletedRefunds();

    const { rows: [creditedBuyer] } = await pool.query(
      'SELECT refunds FROM buyers WHERE id = $1',
      [registeredBuyer.id]
    );
    assert.equal(Number(creditedBuyer.refunds), 1500, 'Buyer wallet must be credited 1500 KES');

    // Verify refund_requests is now marked credited_to_buyer = true
    const { rows: [reconciledRR] } = await pool.query(
      'SELECT payment_details, buyer_id FROM refund_requests WHERE id = $1',
      [refundRequestId]
    );
    assert.equal(reconciledRR.payment_details?.credited_to_buyer, true);
    assert.equal(reconciledRR.buyer_id, registeredBuyer.id);

    // 9. Run reconciliation worker again -> idempotent, no double credit
    await ReconciliationEngine.handleCompletedRefunds();
    const { rows: [idempotentBuyer] } = await pool.query(
      'SELECT refunds FROM buyers WHERE id = $1',
      [registeredBuyer.id]
    );
    assert.equal(Number(idempotentBuyer.refunds), 1500, 'Idempotent recon must not double-credit');
  });
});
