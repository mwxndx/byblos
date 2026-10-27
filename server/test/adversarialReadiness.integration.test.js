import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';

const { pool } = await import('../src/infrastructure/database/database.js');
const apiRoutes = (await import('../src/application/routes/index.js')).default;
const tokenBlacklist = (await import('../src/domains/identity/tokens/tokenBlacklist.service.js')).default;
const FulfillmentQueueService = (await import('../src/domains/orders/fulfillment/fulfillmentQueue.service.js')).default;
const { generateRefreshToken, refreshAccessToken, verifyRefreshToken } = await import('../src/shared/utils/refreshToken.js');
const { signToken } = await import('../src/shared/utils/jwt.js');
const {
  createBuyer,
  createSeller,
  createProduct,
  createOrderItem,
  createCompletedOrder,
  createPayment,
  cleanupOrder,
  cleanupProduct,
  cleanupSeller,
  cleanupBuyer
} = await import('./helpers/factories.js');

const PASSWORD = 'AdversarialPass123!';
let passwordHash;
let server;
let baseUrl;

const createdUserIds = [];

// Helper to create users with different roles for testing
async function createTestUserWithRole(role = 'buyer', emailPrefix = 'user') {
  const email = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@byblos-adversarial-test.com`;
  const { rows: [user] } = await pool.query(
    `INSERT INTO users (email, password_hash, role, is_active, is_verified, created_at, updated_at)
     VALUES ($1, $2, $3, true, true, NOW(), NOW())
     RETURNING id, email`,
    [email, passwordHash, role]
  );
  createdUserIds.push(user.id);

  const { rows: roleRows } = await pool.query('SELECT id FROM roles WHERE slug = $1', [role]);
  if (roleRows[0]) {
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, roleRows[0].id]
    );
  }

  let profileId = null;
  if (role === 'buyer') {
    const { rows: [b] } = await pool.query(
      `INSERT INTO buyers (user_id, full_name, email, mobile_payment, terms_accepted, created_at, updated_at)
       VALUES ($1, 'Test Buyer', $2, $3, TRUE, NOW(), NOW())
       RETURNING id`,
      [user.id, email, `0722${String(user.id).padStart(6, '0')}`]
    );
    profileId = b.id;
  } else if (role === 'seller') {
    const { rows: [s] } = await pool.query(
      `INSERT INTO sellers (user_id, full_name, email, shop_name, whatsapp_number, terms_accepted, location, created_at, updated_at)
       VALUES ($1, 'Test Seller', $2, $3, $4, TRUE, 'Nairobi', NOW(), NOW())
       RETURNING id`,
      [user.id, email, `Shop-${user.id}`, `0722${String(user.id).padStart(6, '0')}`]
    );
    profileId = s.id;
  } else if (role === 'admin') {
    profileId = user.id;
  }

  // Issue access token
  const accessToken = signToken(user.id, role, {
    userId: user.id,
    user_table_id: user.id,
    profile_id: profileId,
    email: user.email,
    userType: role
  });

  return { user, profileId, accessToken, role, email };
}

before(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 12);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRoutes);
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({
      status: err.status || 'error',
      message: err.message,
      code: err.code
    });
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  if (createdUserIds.length) {
    await pool.query('DELETE FROM buyers WHERE user_id = ANY($1)', [createdUserIds]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE user_id = ANY($1)', [createdUserIds]).catch(() => {});
    await pool.query('DELETE FROM user_roles WHERE user_id = ANY($1)', [createdUserIds]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]).catch(() => {});
  }
  if (tokenBlacklist.redis) {
    tokenBlacklist.redis.disconnect();
  }
  await pool.end();
});

describe('ADVERSARIAL VERIFICATION SUITE — SEC-02 & DIST-03', () => {

  // ─────────────────────────────────────────────────────────────────────────────
  // SEC-02 ADVERSARIAL CHECKS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('SEC-02: Refresh Token Revocation & Multi-Session Isolation', () => {

    test('Adversarial Case 1: Negative assertion on cookie-clearing vs server revocation', async () => {
      const { user, accessToken } = await createTestUserWithRole('buyer', 'neg_assert');
      const refreshToken = generateRefreshToken(user.id, 'buyer');

      // Verify token is initially not blacklisted
      const initiallyBlacklisted = await tokenBlacklist.isBlacklisted(refreshToken);
      assert.strictEqual(initiallyBlacklisted, false, 'Fresh refresh token must not be blacklisted');

      // Execute logout via POST /api/buyers/logout with cookie
      const logoutRes = await fetch(`${baseUrl}/api/buyers/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Cookie': `refreshToken=${refreshToken}`
        }
      });
      assert.strictEqual(logoutRes.status, 200, 'Logout must succeed with 200');

      // Negative assertion: if logout only cleared cookies, the token wouldn't be blacklisted
      const isBlacklistedAfterLogout = await tokenBlacklist.isBlacklisted(refreshToken);
      assert.strictEqual(isBlacklistedAfterLogout, true, 'Server MUST record refresh token in blacklist, not just clear cookies');

      // Attempting to rotate the blacklisted token via HTTP body fails authoritatively
      const refreshAttempt = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      assert.strictEqual(refreshAttempt.status, 401, 'Replay of revoked refresh token must return 401');
      const body = await refreshAttempt.json();
      assert.match(body.message, /revoked/i, 'Error must indicate token revocation');
    });

    test('Adversarial Case 2: Multi-user isolation — User A logout leaves User B session valid', async () => {
      const userA = await createTestUserWithRole('buyer', 'user_a');
      const userB = await createTestUserWithRole('buyer', 'user_b');

      const tokenA = generateRefreshToken(userA.user.id, 'buyer');
      const tokenB = generateRefreshToken(userB.user.id, 'buyer');

      // User A logs out
      const logoutA = await fetch(`${baseUrl}/api/buyers/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userA.accessToken}`,
          'Cookie': `refreshToken=${tokenA}`
        }
      });
      assert.strictEqual(logoutA.status, 200);

      // User A's token cannot be refreshed
      const refreshA = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokenA })
      });
      assert.strictEqual(refreshA.status, 401, 'User A refresh must be rejected');

      // User B's token remains valid and rotates successfully
      const refreshB = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokenB })
      });
      assert.strictEqual(refreshB.status, 200, 'User B refresh must succeed');
      const dataB = await refreshB.json();
      assert.ok(dataB.data?.accessToken, 'User B must receive fresh access token');
      assert.ok(dataB.data?.refreshToken, 'User B must receive rotated refresh token');
    });

    test('Adversarial Case 3: Multi-device isolation — Device 1 logout leaves Device 2 valid', async () => {
      const user = await createTestUserWithRole('buyer', 'multidev');

      // Device 1 and Device 2 for same user
      const dev1Token = generateRefreshToken(user.user.id, 'buyer');
      const dev2Token = generateRefreshToken(user.user.id, 'buyer');

      const decoded1 = verifyRefreshToken(dev1Token);
      const decoded2 = verifyRefreshToken(dev2Token);
      assert.notStrictEqual(decoded1.jti, decoded2.jti, 'Each device must receive distinct JTI');

      // Device 1 logs out
      const logoutDev1 = await fetch(`${baseUrl}/api/buyers/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
          'Cookie': `refreshToken=${dev1Token}`
        }
      });
      assert.strictEqual(logoutDev1.status, 200);

      // Device 1 refresh rejected
      const refreshDev1 = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: dev1Token })
      });
      assert.strictEqual(refreshDev1.status, 401, 'Device 1 must be rejected');

      // Device 2 refresh succeeds
      const refreshDev2 = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: dev2Token })
      });
      assert.strictEqual(refreshDev2.status, 200, 'Device 2 must remain valid and rotate');
      const dev2Data = await refreshDev2.json();
      assert.ok(dev2Data.data?.refreshToken, 'Device 2 must receive new rotated token');
    });

    test('Adversarial Case 4: Grace-period replay defense blocks replaying blacklisted token', async () => {
      const user = await createTestUserWithRole('buyer', 'grace_def');
      const token1 = generateRefreshToken(user.user.id, 'buyer');
      const decoded1 = verifyRefreshToken(token1);

      // Normal rotation: token1 is rotated to token2 (cached in grace-period window)
      const rotated = await refreshAccessToken(token1);
      assert.ok(rotated.refreshToken, 'Initial rotation must succeed');

      // Explicitly blacklist token1 (simulating simultaneous logout or breach report)
      await tokenBlacklist.addToken(token1, decoded1.exp);

      // Adversarial attempt: Replay token1 within the 30s grace window
      // Must NOT return the cached rotated token because blacklist takes strict precedence
      await assert.rejects(
        async () => {
          await refreshAccessToken(token1);
        },
        (err) => {
          assert.match(err.message, /revoked/i, 'Grace window must not permit revoked/blacklisted token reuse');
          return true;
        }
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DIST-03 ADVERSARIAL CHECKS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('DIST-03: Fulfillment Recovery Concurrency, RBAC & Idempotency', () => {

    test('Adversarial Case 5: RBAC enforcement on admin dead-letter fulfillment endpoints', async () => {
      const buyer = await createTestUserWithRole('buyer', 'rbac_buyer');
      const seller = await createTestUserWithRole('seller', 'rbac_seller');
      const admin = await createTestUserWithRole('admin', 'rbac_admin');

      const deadLettersUrl = `${baseUrl}/api/admin/fulfillment/dead-letters`;
      const retryUrl = `${baseUrl}/api/admin/fulfillment/jobs/00000000-0000-0000-0000-000000000001/retry`;
      const cancelRefundUrl = `${baseUrl}/api/admin/fulfillment/orders/00000000-0000-0000-0000-000000000001/cancel-refund`;

      // 1. Unauthenticated requests must receive 401
      const unauthGet = await fetch(deadLettersUrl);
      assert.strictEqual(unauthGet.status, 401, 'Unauthenticated GET dead-letters must return 401');

      const unauthRetry = await fetch(retryUrl, { method: 'POST' });
      assert.strictEqual(unauthRetry.status, 401, 'Unauthenticated retry must return 401');

      const unauthCancel = await fetch(cancelRefundUrl, { method: 'POST' });
      assert.strictEqual(unauthCancel.status, 401, 'Unauthenticated cancel-refund must return 401');

      // 2. Buyer requests must receive 403 Forbidden
      const buyerGet = await fetch(deadLettersUrl, {
        headers: { 'Authorization': `Bearer ${buyer.accessToken}` }
      });
      assert.strictEqual(buyerGet.status, 403, 'Buyer access to dead-letters must be forbidden');

      const buyerRetry = await fetch(retryUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${buyer.accessToken}` }
      });
      assert.strictEqual(buyerRetry.status, 403, 'Buyer access to retry must be forbidden');

      const buyerCancel = await fetch(cancelRefundUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${buyer.accessToken}` }
      });
      assert.strictEqual(buyerCancel.status, 403, 'Buyer access to cancel-refund must be forbidden');

      // 3. Seller requests must receive 403 Forbidden
      const sellerGet = await fetch(deadLettersUrl, {
        headers: { 'Authorization': `Bearer ${seller.accessToken}` }
      });
      assert.strictEqual(sellerGet.status, 403, 'Seller access to dead-letters must be forbidden');

      // 4. Admin request must be authorized (200 OK)
      const adminGet = await fetch(deadLettersUrl, {
        headers: { 'Authorization': `Bearer ${admin.accessToken}` }
      });
      assert.strictEqual(adminGet.status, 200, 'Admin request must be authorized');
      const adminData = await adminGet.json();
      assert.strictEqual(adminData.status, 'success');
      assert.ok(Array.isArray(adminData.data.jobs), 'Admin should receive jobs array');
    });

    test('Adversarial Case 6: Concurrent operator retries trigger 409 conflict and exactly one succeeds', async () => {
      const buyer = await createBuyer({});
      const seller = await createSeller({});
      const product = await createProduct({ sellerId: seller.id, price: 1000 });
      const order = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 1000,
        sellerPayoutAmount: 900,
        status: 'MANUAL_REVIEW'
      });
      await createOrderItem({ orderId: order.id, productId: product.id, price: 1000 });

      // Create a dead-letter job in FAILED status
      const { rows: [job] } = await pool.query(
        `INSERT INTO fulfillment_jobs (order_id, status, attempts, max_attempts, error_message, created_at, updated_at)
         VALUES ($1, 'FAILED', 5, 5, 'Fatal error', NOW(), NOW())
         RETURNING *`,
        [order.id]
      );

      try {
        // Trigger two concurrent retry operations on the exact same job ID
        const [res1, res2] = await Promise.allSettled([
          FulfillmentQueueService.retryFailedJob(job.id, { operatorId: 'op1' }),
          FulfillmentQueueService.retryFailedJob(job.id, { operatorId: 'op2' })
        ]);

        const statuses = [res1.status, res2.status];
        assert.ok(statuses.includes('fulfilled'), 'Exactly one concurrent retry must succeed');
        assert.ok(statuses.includes('rejected'), 'Exactly one concurrent retry must be rejected');

        const rejectedResult = res1.status === 'rejected' ? res1 : res2;
        assert.strictEqual(rejectedResult.reason.statusCode, 409, 'Rejected call must return 409 Conflict');
        assert.strictEqual(rejectedResult.reason.code, 'JOB_ALREADY_PENDING', 'Error code must be JOB_ALREADY_PENDING');

        // Verify final state in database
        const { rows: [finalJob] } = await pool.query('SELECT * FROM fulfillment_jobs WHERE id = $1', [job.id]);
        assert.strictEqual(finalJob.status, 'PENDING');
        assert.strictEqual(finalJob.attempts, 0);

        const { rows: [finalOrder] } = await pool.query('SELECT status FROM product_orders WHERE id = $1', [order.id]);
        assert.strictEqual(finalOrder.status, 'PAID', 'Order must be back in PAID status');
      } finally {
        await pool.query('DELETE FROM fulfillment_jobs WHERE order_id = $1', [order.id]).catch(() => {});
        await cleanupOrder(order.id).catch(() => {});
        await cleanupProduct(product.id).catch(() => {});
        await cleanupSeller(seller.id).catch(() => {});
        await cleanupBuyer(buyer.id).catch(() => {});
      }
    });

    test('Adversarial Case 7: Active worker lease protection blocks retry during active processing', async () => {
      const buyer = await createBuyer({});
      const seller = await createSeller({});
      const product = await createProduct({ sellerId: seller.id, price: 1200 });
      const order = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 1200,
        sellerPayoutAmount: 1100,
        status: 'PAID'
      });

      // Job actively processing by a worker (updated 30 seconds ago, lease is active)
      const { rows: [job] } = await pool.query(
        `INSERT INTO fulfillment_jobs (order_id, status, attempts, max_attempts, created_at, updated_at)
         VALUES ($1, 'PROCESSING', 1, 5, NOW(), NOW() - INTERVAL '30 seconds')
         RETURNING *`,
        [order.id]
      );

      try {
        await assert.rejects(
          async () => {
            await FulfillmentQueueService.retryFailedJob(job.id, { operatorId: 'op_intruder' });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            assert.strictEqual(err.code, 'JOB_ACTIVELY_PROCESSING');
            return true;
          }
        );
      } finally {
        await pool.query('DELETE FROM fulfillment_jobs WHERE order_id = $1', [order.id]).catch(() => {});
        await cleanupOrder(order.id).catch(() => {});
        await cleanupProduct(product.id).catch(() => {});
        await cleanupSeller(seller.id).catch(() => {});
        await cleanupBuyer(buyer.id).catch(() => {});
      }
    });

    test('Adversarial Case 8: Idempotent cancellation prevents double-refund on duplicate operator request', async () => {
      const buyer = await createBuyer({});
      const seller = await createSeller({});
      const product = await createProduct({ sellerId: seller.id, price: 3000 });
      const order = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 3000,
        sellerPayoutAmount: 2800,
        status: 'MANUAL_REVIEW',
        paymentStatus: 'completed'
      });
      await createOrderItem({ orderId: order.id, productId: product.id, price: 3000 });
      await createPayment({ orderId: order.id, amount: 3000, status: 'completed' });

      const { rows: [job] } = await pool.query(
        `INSERT INTO fulfillment_jobs (order_id, status, attempts, max_attempts, created_at, updated_at)
         VALUES ($1, 'FAILED', 5, 5, NOW(), NOW())
         RETURNING *`,
        [order.id]
      );

      try {
        // First cancellation & refund
        const firstResult = await FulfillmentQueueService.cancelAndRefundDeadLetter(order.id, {
          reason: 'Irrecoverable dead-letter fulfillment',
          operatorId: 'admin_1'
        });
        assert.ok(firstResult, 'First cancellation must succeed');

        // Check buyer wallet: 0 original + 3000 refunded = 3000
        const { rows: [buyerAfterFirst] } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
        assert.strictEqual(Number(buyerAfterFirst.refunds), 3000, 'Buyer wallet must be credited 3000');

        // Second cancellation (simulating duplicate operator click or network retry)
        const secondResult = await FulfillmentQueueService.cancelAndRefundDeadLetter(order.id, {
          reason: 'Irrecoverable dead-letter fulfillment duplicate',
          operatorId: 'admin_2'
        });
        assert.strictEqual(secondResult.alreadyCancelled, true, 'Second call must return idempotent alreadyCancelled flag');

        // Check buyer wallet: MUST REMAIN EXACTLY 3000, not double credited to 6000!
        const { rows: [buyerAfterSecond] } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
        assert.strictEqual(Number(buyerAfterSecond.refunds), 3000, 'Buyer wallet MUST NOT be double-credited');

        // Verify only one refund request record was created
        const { rows: refundRecords } = await pool.query(
          'SELECT * FROM refund_requests WHERE order_id = $1',
          [order.id]
        );
        assert.strictEqual(refundRecords.length, 1, 'Exactly one refund request record must exist');
      } finally {
        await pool.query('DELETE FROM refund_requests WHERE order_id = $1', [order.id]).catch(() => {});
        await pool.query('DELETE FROM fulfillment_jobs WHERE order_id = $1', [order.id]).catch(() => {});
        await cleanupOrder(order.id).catch(() => {});
        await cleanupProduct(product.id).catch(() => {});
        await cleanupSeller(seller.id).catch(() => {});
        await cleanupBuyer(buyer.id).catch(() => {});
      }
    });

  });

});
