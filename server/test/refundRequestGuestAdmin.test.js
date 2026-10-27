import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { pool } from '../src/infrastructure/database/database.js';
import * as refundRequestRepository from '../src/domains/orders/repositories/refundRequest.repository.js';
import refundRoutes from '../src/application/routes/refund.routes.js';
import { signToken } from '../src/shared/utils/jwt.js';
import { createUser, createBuyer, createSeller, createCompletedOrder, cleanupOrder, cleanupSeller, cleanupBuyer } from './helpers/factories.js';

describe('RefundRequest Repository & HTTP Admin Handling (FIN-04 / H-05)', () => {
  let appServer;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/refunds', refundRoutes);
    app.use((err, _req, res, _next) => {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: err.status || 'error',
        message: err.message
      });
    });

    await new Promise((resolve) => {
      appServer = http.createServer(app);
      appServer.listen(0, '127.0.0.1', () => {
        const addr = appServer.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (appServer) {
      await new Promise((resolve) => appServer.close(resolve));
    }
  });
  test('findHeaderById succeeds for guest refund requests with NULL buyer_id', async (t) => {
    let admin, seller, order, refundRequestId;

    t.after(async () => {
      if (refundRequestId) await pool.query('DELETE FROM refund_requests WHERE id = $1', [refundRequestId]).catch(() => {});
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (admin) await pool.query('DELETE FROM users WHERE id = $1', [admin.id]).catch(() => {});
    });

    admin = await createUser({ role: 'admin' });
    seller = await createSeller({});

    const { rows: oRows } = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, buyer_email, seller_id, total_amount, platform_fee_amount,
         seller_payout_amount, status, payment_status, total_quantity, client_checkout_token,
         order_type, fulfillment_type
       ) VALUES ($1, NULL, $2, $3, 1000, 50, 950, 'PAID'::order_status, 'completed'::payment_status, 1, 'tok-guest-rr', 'PHYSICAL', 'BUYER_TO_SELLER')
       RETURNING *`,
      [`ORD-GUEST-RR-${Date.now()}`, `guest_rr_${Date.now()}@test.local`, seller.id]
    );
    order = oRows[0];

    // Insert guest refund request with buyer_id = NULL
    const { rows: rrRows } = await pool.query(
      `INSERT INTO refund_requests (
         buyer_id, order_id, amount, status, notes, payment_method, requested_at
       ) VALUES (NULL, $1, 1000, 'pending', 'Guest cancellation request', 'wallet', NOW())
       RETURNING *`,
      [order.id]
    );
    refundRequestId = rrRows[0].id;

    // Call findHeaderById - returns header for guest refund request with NULL buyer_id
    const header = await refundRequestRepository.findHeaderById(refundRequestId);

    assert.ok(header, 'findHeaderById must return header for guest refund request with NULL buyer_id');
    assert.equal(header.status, 'pending');
    assert.equal(header.buyer_id, null);
    assert.equal(Number(header.amount), 1000);
    assert.equal(header.full_name, null);
    assert.equal(header.whatsapp_number, null);

    // Now test rejecting this guest refund request
    await refundRequestRepository.markRejected({
      id: refundRequestId,
      adminNotes: 'Rejected fraudulent guest request',
      processedBy: admin.id
    });

    const { rows: updatedRows } = await pool.query('SELECT status, admin_notes, processed_by FROM refund_requests WHERE id = $1', [refundRequestId]);
    assert.equal(updatedRows[0].status, 'rejected');
    assert.equal(updatedRows[0].admin_notes, 'Rejected fraudulent guest request');
    assert.equal(updatedRows[0].processed_by, admin.id);
  });

  test('findHeaderById returns undefined for non-existent refund request ID', async () => {
    const nonExistentId = 999999999;
    const header = await refundRequestRepository.findHeaderById(nonExistentId);
    assert.equal(header, undefined);
  });

  test('admin HTTP PATCH /api/refunds/:id/reject rejects guest refund request and enforces RBAC', async (t) => {
    let adminUser, buyerUser, buyerProfile, seller, order, refundRequestId;

    t.after(async () => {
      if (refundRequestId) await pool.query('DELETE FROM refund_requests WHERE id = $1', [refundRequestId]).catch(() => {});
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyerProfile) await cleanupBuyer(buyerProfile.id).catch(() => {});
      if (buyerUser) await pool.query('DELETE FROM users WHERE id = $1', [buyerUser.id]).catch(() => {});
      if (adminUser) await pool.query('DELETE FROM users WHERE id = $1', [adminUser.id]).catch(() => {});
    });

    adminUser = await createUser({ role: 'admin' });
    buyerUser = await createUser({ role: 'buyer' });
    buyerProfile = await createBuyer({ userId: buyerUser.id, email: buyerUser.email });
    seller = await createSeller({});

    const adminToken = signToken(adminUser.id, 'admin', adminUser.email);
    const buyerToken = signToken(buyerUser.id, 'buyer', buyerUser.email);

    // Create guest order and guest refund request
    const { rows: oRows } = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, buyer_email, seller_id, total_amount, platform_fee_amount,
         seller_payout_amount, status, payment_status, total_quantity, client_checkout_token,
         order_type, fulfillment_type
       ) VALUES ($1, NULL, $2, $3, 2500, 125, 2375, 'PAID'::order_status, 'completed'::payment_status, 1, 'tok-guest-http', 'PHYSICAL', 'BUYER_TO_SELLER')
       RETURNING *`,
      [`ORD-GUEST-HTTP-${Date.now()}`, `guest_http_${Date.now()}@test.local`, seller.id]
    );
    order = oRows[0];

    const { rows: rrRows } = await pool.query(
      `INSERT INTO refund_requests (
         buyer_id, order_id, amount, status, notes, payment_method, requested_at
       ) VALUES (NULL, $1, 2500, 'pending', 'Guest HTTP cancellation', 'wallet', NOW())
       RETURNING *`,
      [order.id]
    );
    refundRequestId = rrRows[0].id;

    // 1. Unauthenticated request rejected with 401
    const unauthRes = await fetch(`${baseUrl}/api/refunds/${refundRequestId}/reject`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNotes: 'Reject without auth' })
    });
    assert.equal(unauthRes.status, 401, 'Unauthenticated request must be 401');

    // 2. Non-admin (buyer) request rejected with 403
    const buyerRes = await fetch(`${baseUrl}/api/refunds/${refundRequestId}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ adminNotes: 'Buyer trying to reject' })
    });
    assert.equal(buyerRes.status, 403, 'Non-admin request must be 403');

    // 3. Authenticated Admin request succeeds with 200 (NOT 404!)
    const adminRes = await fetch(`${baseUrl}/api/refunds/${refundRequestId}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ adminNotes: 'Rejected by admin via HTTP endpoint' })
    });

    const adminBody = await adminRes.json();
    assert.equal(adminRes.status, 200, `Admin reject must return 200. Got: ${adminRes.status} with body: ${JSON.stringify(adminBody)}`);
    assert.equal(adminBody.status, 'success');

    // 4. Assert persisted DB state
    const { rows: [persistedRR] } = await pool.query(
      'SELECT status, admin_notes, processed_by FROM refund_requests WHERE id = $1',
      [refundRequestId]
    );
    assert.equal(persistedRR.status, 'rejected');
    assert.equal(persistedRR.admin_notes, 'Rejected by admin via HTTP endpoint');
    assert.equal(persistedRR.processed_by, adminUser.id);
  });
});
