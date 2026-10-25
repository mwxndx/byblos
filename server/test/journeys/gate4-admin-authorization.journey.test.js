/**
 * gate4-admin-authorization.journey.test.js
 *
 * GATE 4: Administration & Authorization End-to-End Business Journey
 *
 * Verifies:
 *   1. Unauthenticated Endpoint Protection (401 Unauthorized on missing/invalid JWT tokens)
 *   2. Role-Based Access Control (403 Forbidden on non-admin users: sellers, buyers, creators)
 *   3. Privileged Admin Operations (200 OK on admin routes: stats, sellers, buyers, audit review)
 *   4. Seller Moderation & Status Lifecycle (Admin suspension and reactivation)
 *   5. Admin Withdrawal Override Security & Validation (Status validation, reserve release)
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { pool } from '../../src/infrastructure/database/database.js';
import adminRoutes from '../../src/application/routes/admin.routes.js';
import AdminService from '../../src/domains/identity/admin/admin.service.js';
import withdrawalService from '../../src/domains/payments/withdrawals/withdrawal.service.js';
import Fees from '../../src/shared/config/fees.js';
import { signToken } from '../../src/shared/utils/jwt.js';
import {
  createUser,
  createBuyer,
  createSeller,
  createCreator,
  cleanupSeller,
  cleanupBuyer,
  cleanupUser,
  cleanupCreator
} from '../helpers/factories.js';

let appServer;
let baseUrl;

const createdUserIds = [];
const createdSellerIds = [];
const createdBuyerIds = [];
const createdCreatorIds = [];
const createdWithdrawalIds = [];

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);

  // Central error responder matching server standard
  app.use((err, _req, res, _next) => {
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
      status: 'error',
      statusCode,
      message: err.message
    });
  });

  appServer = http.createServer(app);
  await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve));
  const address = appServer.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (appServer) {
    await new Promise((resolve) => appServer.close(resolve));
  }

  // Allow in-flight async payout provider tasks to settle before cleanup
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Cleanup withdrawal and payout provider attempts for all created sellers and withdrawals
  if (createdSellerIds.length > 0) {
    await pool.query('DELETE FROM payout_provider_attempts WHERE seller_id = ANY($1)', [createdSellerIds]).catch(() => {});
    await pool.query('DELETE FROM payouts WHERE seller_id = ANY($1)', [createdSellerIds]).catch(() => {});
    await pool.query('DELETE FROM withdrawal_requests WHERE seller_id = ANY($1)', [createdSellerIds]).catch(() => {});
  }

  // Cleanup withdrawal records
  if (createdWithdrawalIds.length > 0) {
    await pool.query('DELETE FROM payout_provider_attempts WHERE withdrawal_request_id = ANY($1)', [createdWithdrawalIds]).catch(() => {});
    await pool.query('DELETE FROM withdrawal_requests WHERE id = ANY($1)', [createdWithdrawalIds]).catch(() => {});
  }

  // Cleanup sellers
  for (const sellerId of createdSellerIds) {
    await cleanupSeller(sellerId).catch(() => {});
  }

  // Cleanup buyers
  for (const buyerId of createdBuyerIds) {
    await cleanupBuyer(buyerId).catch(() => {});
  }

  // Cleanup creators
  for (const creatorId of createdCreatorIds) {
    await cleanupCreator(creatorId).catch(() => {});
  }

  // Cleanup users
  for (const userId of createdUserIds) {
    await cleanupUser(userId).catch(() => {});
  }
});

describe('GATE 4: Administration & Authorization Business Journey', () => {
  let adminUser;
  let adminToken;
  let sellerUser;
  let sellerToken;
  let buyerUser;
  let buyerToken;
  let creatorUser;
  let creatorToken;
  let testSeller;

  test('Setup: seed admin, seller, buyer, and creator users', async () => {
    // 1. Admin user
    adminUser = await createUser({
      email: `admin_${Date.now()}@test.byblos.local`,
      role: 'admin'
    });
    createdUserIds.push(adminUser.id);
    adminToken = signToken(adminUser.id, 'admin');

    // 2. Seller user + profile
    sellerUser = await createUser({
      email: `seller_${Date.now()}@test.byblos.local`,
      role: 'seller'
    });
    createdUserIds.push(sellerUser.id);
    testSeller = await createSeller({ userId: sellerUser.id, shopName: `Mod Shop ${Date.now()}` });
    createdSellerIds.push(testSeller.id);
    sellerToken = signToken(sellerUser.id, 'seller');

    // 3. Buyer user + profile
    buyerUser = await createUser({
      email: `buyer_${Date.now()}@test.byblos.local`,
      role: 'buyer'
    });
    createdUserIds.push(buyerUser.id);
    const buyerProfile = await createBuyer({ userId: buyerUser.id });
    createdBuyerIds.push(buyerProfile.id);
    buyerToken = signToken(buyerUser.id, 'buyer');

    // 4. Creator user + profile
    creatorUser = await createUser({
      email: `creator_${Date.now()}@test.byblos.local`,
      role: 'creator'
    });
    createdUserIds.push(creatorUser.id);
    const creatorProfile = await createCreator({ userId: creatorUser.id });
    createdCreatorIds.push(creatorProfile.id);
    creatorToken = signToken(creatorUser.id, 'creator');

    assert.ok(adminToken);
    assert.ok(sellerToken);
    assert.ok(buyerToken);
    assert.ok(creatorToken);
  });

  // ---------------------------------------------------------------------------
  // 1. Unauthenticated Endpoint Protection
  // ---------------------------------------------------------------------------
  describe('1. Unauthenticated Endpoint Protection', () => {
    test('Rejects request without Authorization header with 401 Unauthorized', async () => {
      const endpoints = ['/api/admin/me', '/api/admin/sellers', '/api/admin/stats', '/api/admin/buyers'];
      for (const endpoint of endpoints) {
        const res = await fetch(`${baseUrl}${endpoint}`);
        assert.equal(res.status, 401, `Endpoint ${endpoint} must reject unauthenticated requests with 401`);
        const body = await res.json();
        assert.match(body.message, /not logged in/i);
      }
    });

    test('Rejects request with malformed token with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/admin/me`, {
        headers: { Authorization: 'Bearer this.is.invalid.jwt.token' }
      });
      assert.equal(res.status, 401, 'Malformed token must return 401');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Role-Based Access Control (RBAC 403 Forbidden)
  // ---------------------------------------------------------------------------
  describe('2. Role-Based Access Control (RBAC Boundaries)', () => {
    test('Authenticated seller is rejected from admin routes with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/admin/sellers`, {
        headers: { Authorization: `Bearer ${sellerToken}` }
      });
      assert.equal(res.status, 403, 'Seller role must be denied access to admin routes');
      const body = await res.json();
      assert.match(body.message, /permission/i);
    });

    test('Authenticated buyer is rejected from admin routes with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${buyerToken}` }
      });
      assert.equal(res.status, 403, 'Buyer role must be denied access to admin routes');
      const body = await res.json();
      assert.match(body.message, /permission/i);
    });

    test('Authenticated creator is rejected from admin routes with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/admin/me`, {
        headers: { Authorization: `Bearer ${creatorToken}` }
      });
      assert.equal(res.status, 403, 'Creator role must be denied access to admin routes');
      const body = await res.json();
      assert.match(body.message, /permission/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Privileged Admin Operations
  // ---------------------------------------------------------------------------
  describe('3. Privileged Admin Operations', () => {
    test('Admin token successfully accesses /api/admin/me', async () => {
      const res = await fetch(`${baseUrl}/api/admin/me`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.status, 'success');
      assert.ok(body.data.user);
      assert.equal(body.data.user.role, 'admin');
    });

    test('Admin token successfully lists sellers, buyers, and dashboard metrics', async () => {
      const sellersRes = await fetch(`${baseUrl}/api/admin/sellers`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(sellersRes.status, 200);
      const sellersBody = await sellersRes.json();
      assert.equal(sellersBody.status, 'success');
      assert.ok(Array.isArray(sellersBody.data));

      const buyersRes = await fetch(`${baseUrl}/api/admin/buyers`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(buyersRes.status, 200);
      const buyersBody = await buyersRes.json();
      assert.equal(buyersBody.status, 'success');
      assert.ok(Array.isArray(buyersBody.data));

      const statsRes = await fetch(`${baseUrl}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(statsRes.status, 200);
      const statsBody = await statsRes.json();
      assert.equal(statsBody.status, 'success');
    });

    test('Admin token accesses flagged creator earnings review queue', async () => {
      const flaggedRes = await fetch(`${baseUrl}/api/admin/creators/flagged-earnings`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(flaggedRes.status, 200);
      const flaggedBody = await flaggedRes.json();
      assert.equal(flaggedBody.status, 'success');
      assert.ok(Array.isArray(flaggedBody.data));
    });

    test('Admin token successfully broadcasts app update via /broadcast-update and /broadcast-app-update', async () => {
      for (const endpoint of ['/api/admin/broadcast-update', '/api/admin/broadcast-app-update']) {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            minVersionCode: 70,
            title: 'Test App Update',
            body: 'Testing broadcast'
          })
        });
        assert.equal(res.status, 200, `Endpoint ${endpoint} must succeed with 200 for admin`);
        const body = await res.json();
        assert.equal(body.status, 'success');
        assert.equal(body.data.success, true);
        assert.equal(body.data.minVersionCode, 70);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Seller Moderation & Status Lifecycle
  // ---------------------------------------------------------------------------
  describe('4. Seller Moderation & Status Lifecycle', () => {
    test('Admin suspends and subsequently reactivates a seller account', async () => {
      // 1. Suspend seller
      const suspendRes = await fetch(`${baseUrl}/api/admin/sellers/${testSeller.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'suspended', reason: 'Audit moderation test' })
      });
      assert.equal(suspendRes.status, 200);
      const suspendBody = await suspendRes.json();
      assert.equal(suspendBody.status, 'success');

      // Verify DB persistence
      const { rows: suspRows } = await pool.query('SELECT status FROM sellers WHERE id = $1', [testSeller.id]);
      assert.equal(suspRows[0].status, 'suspended', 'Seller status in database must be suspended');

      // 2. Reactivate seller
      const reactivateRes = await fetch(`${baseUrl}/api/admin/sellers/${testSeller.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'active', reason: 'Reactivation test' })
      });
      assert.equal(reactivateRes.status, 200);
      const reactivateBody = await reactivateRes.json();
      assert.equal(reactivateBody.status, 'success');

      // Verify DB persistence
      const { rows: actRows } = await pool.query('SELECT status FROM sellers WHERE id = $1', [testSeller.id]);
      assert.equal(actRows[0].status, 'active', 'Seller status in database must be active');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Admin Withdrawal Override Security & Validation
  // ---------------------------------------------------------------------------
  describe('5. Admin Withdrawal Override Security & Validation', () => {
    test('Rejects invalid status overrides with 400 Bad Request', async () => {
      const invalidStatuses = ['approved', 'rejected', 'pending', 'unknown'];
      for (const badStatus of invalidStatuses) {
        await assert.rejects(
          () => AdminService.overrideWithdrawalStatus({
            id: 999999,
            status: badStatus,
            reason: 'testing rejection',
            adminId: adminUser.id
          }),
          (err) => {
            assert.match(err.message, /must be "completed" or "failed"/i);
            assert.equal(err.statusCode, 400);
            return true;
          }
        );
      }
    });

    test('Valid admin override to completed finalizes request and clears reserve', async () => {
      // 1. Create seller with balance and withdrawal request
      const overrideSeller = await createSeller({ shopName: `Override Shop ${Date.now()}` });
      createdSellerIds.push(overrideSeller.id);
      await pool.query('UPDATE sellers SET balance = 5000, withdrawal_reserved_balance = 0 WHERE id = $1', [overrideSeller.id]);

      const req = await withdrawalService.createWithdrawalRequest({
        entityId: overrideSeller.id,
        entityType: 'seller',
        amount: 1000,
        mpesaNumber: '0712345678',
        mpesaName: 'Override Payee',
        idempotencyKey: `override-req-${Date.now()}`
      });
      createdWithdrawalIds.push(req.id);

      // Force to processing
      await pool.query("UPDATE withdrawal_requests SET status = 'processing' WHERE id = $1", [req.id]);

      // 2. Admin overrides status to completed
      const overrideResult = await AdminService.overrideWithdrawalStatus({
        id: req.id,
        status: 'completed',
        reason: 'Manual bank confirmation',
        adminId: adminUser.id
      });

      assert.equal(overrideResult.status, 'completed');

      // 3. Verify DB state: withdrawal request is completed, reserved balance is 0
      const { rows: reqRows } = await pool.query('SELECT status FROM withdrawal_requests WHERE id = $1', [req.id]);
      assert.equal(reqRows[0].status, 'completed');

      const { rows: sellerRows } = await pool.query('SELECT balance, withdrawal_reserved_balance FROM sellers WHERE id = $1', [overrideSeller.id]);
      assert.equal(Number(sellerRows[0].withdrawal_reserved_balance), 0, 'Withdrawal reserved balance must be cleared');
      assert.equal(Number(sellerRows[0].balance), 5000 - (1000 + Fees.calculateWithdrawalFee(1000)), 'Remaining balance preserved');
    });
  });
});
