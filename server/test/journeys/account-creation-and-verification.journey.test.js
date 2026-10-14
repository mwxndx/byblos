/**
 * account-creation-and-verification.journey.test.js
 *
 * Verifies that Buyers, Sellers, and Creators can:
 *  1. Register their accounts successfully via HTTP endpoints
 *  2. Are blocked from logging in before email verification (403 EMAIL_NOT_VERIFIED / PENDING_VERIFICATION)
 *  3. Successfully verify their emails via GET /api/{role}/verify-email
 *  4. Successfully log in after email verification with valid session tokens and profiles
 *  5. Request verification email resend via POST /api/{role}/resend-verification
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';

import { pool } from '../../src/infrastructure/database/database.js';
import buyerRoutes from '../../src/application/routes/buyer.routes.js';
import sellerRoutes from '../../src/application/routes/seller.routes.js';
import creatorRoutes from '../../src/application/routes/creator.routes.js';
import {
  cleanupSeller,
  cleanupBuyer,
  cleanupCreator,
  cleanupUser
} from '../helpers/factories.js';

let appServer;
let baseUrl;

const createdUserIds = [];
const createdSellerIds = [];
const createdBuyerIds = [];
const createdCreatorIds = [];

before(async () => {
  const app = express();
  app.use(express.json());

  app.use('/api/buyers', buyerRoutes);
  app.use('/api/sellers', sellerRoutes);
  app.use('/api/creators', creatorRoutes);

  app.use((err, _req, res, _next) => {
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
      status: 'error',
      statusCode,
      message: err.message,
      error: err.code || err.errorCode
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

  // Cleanup created records in reverse dependency order
  for (const cid of createdCreatorIds) {
    await cleanupCreator(cid).catch(() => {});
  }
  for (const sid of createdSellerIds) {
    await cleanupSeller(sid).catch(() => {});
  }
  for (const bid of createdBuyerIds) {
    await cleanupBuyer(bid).catch(() => {});
  }
  for (const uid of createdUserIds) {
    await cleanupUser(uid).catch(() => {});
  }
});

describe('Account Creation & Email Verification Journey (Buyer, Seller, Creator)', () => {
  const timestamp = Date.now();

  // ---------------------------------------------------------------------------
  // 1. BUYER LIFECYCLE
  // ---------------------------------------------------------------------------
  describe('Buyer Account Registration & Verification', () => {
    const buyerEmail = `buyer-verify-${timestamp}@byblos.test`;
    const buyerPassword = 'Byblos#BuyerVerify123!';
    let rawBuyerToken;

    test('1. Buyer registers and receives pending_verification status', async () => {
      const payload = {
        fullName: 'Test Buyer Verify',
        email: buyerEmail,
        password: buyerPassword,
        confirmPassword: buyerPassword,
        mobilePayment: '254700000001',
        city: 'Nairobi',
        location: 'Westlands',
        termsAccepted: true
      };

      const res = await fetch(`${baseUrl}/api/buyers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.status, 'success');
      assert.ok(body.data?.emailVerificationRequired || body.message?.includes('verification'));

      // Verify pending_registrations entry exists
      const { rows } = await pool.query(
        'SELECT email, role, verification_token FROM pending_registrations WHERE email = $1',
        [buyerEmail.toLowerCase()]
      );
      assert.equal(rows.length, 1, 'Pending registration must exist in DB');
      assert.equal(rows[0].role, 'buyer');

      // Overwrite token with known deterministic token to verify
      rawBuyerToken = 'buyer-token-' + timestamp;
      const hashedToken = crypto.createHash('sha256').update(rawBuyerToken).digest('hex');
      await pool.query(
        'UPDATE pending_registrations SET verification_token = $1 WHERE email = $2',
        [hashedToken, buyerEmail.toLowerCase()]
      );
    });

    test('2. Unverified buyer cannot log in (blocked with 403 PENDING_VERIFICATION)', async () => {
      const res = await fetch(`${baseUrl}/api/buyers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: buyerEmail, password: buyerPassword })
      });

      const body = await res.json();
      assert.equal(res.status, 403, 'Unverified buyer login must return 403');
      assert.ok(
        body.message.includes('not yet verified') || body.error === 'PENDING_VERIFICATION' || body.error === 'EMAIL_NOT_VERIFIED',
        'Should report verification required'
      );
    });

    test('3. Buyer verifies email via GET /api/buyers/verify-email', async () => {
      // Overwrite token with known deterministic token to verify (login rotated it in test 2)
      rawBuyerToken = 'buyer-token-' + timestamp;
      const hashedToken = crypto.createHash('sha256').update(rawBuyerToken).digest('hex');
      await pool.query(
        'UPDATE pending_registrations SET verification_token = $1 WHERE email = $2',
        [hashedToken, buyerEmail.toLowerCase()]
      );

      const res = await fetch(
        `${baseUrl}/api/buyers/verify-email?token=${encodeURIComponent(rawBuyerToken)}&email=${encodeURIComponent(buyerEmail)}`
      );

      const body = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.status, 'success');

      // Verify promoted to users and buyers tables
      const { rows: userRows } = await pool.query(
        'SELECT id, email, is_verified FROM users WHERE email = $1',
        [buyerEmail.toLowerCase()]
      );
      assert.equal(userRows.length, 1, 'User must exist in users table');
      assert.equal(userRows[0].is_verified, true, 'User must be marked verified');
      createdUserIds.push(userRows[0].id);

      const { rows: buyerRows } = await pool.query(
        'SELECT id, user_id FROM buyers WHERE user_id = $1',
        [userRows[0].id]
      );
      assert.equal(buyerRows.length, 1, 'Buyer profile must exist');
      createdBuyerIds.push(buyerRows[0].id);
    });

    test('4. Verified buyer logs in successfully with 200 and session token', async () => {
      const res = await fetch(`${baseUrl}/api/buyers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: buyerEmail, password: buyerPassword })
      });

      const body = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.status, 'success');
      assert.ok(body.token || body.data?.token, 'Must return JWT session token');
      assert.ok(body.data?.user || body.data?.buyer || body.data?.profile, 'Must return user/profile payload');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. SELLER LIFECYCLE
  // ---------------------------------------------------------------------------
  describe('Seller Account Registration & Verification', () => {
    const sellerEmail = `seller-verify-${timestamp}@byblos.test`;
    const sellerPassword = 'Byblos#SellerVerify123!';
    const shopName = `VerifyAtelier${timestamp}`;
    let rawSellerToken;

    test('1. Seller registers and receives pending_verification status', async () => {
      const payload = {
        fullName: 'Test Seller Verify',
        shopName,
        email: sellerEmail,
        password: sellerPassword,
        confirmPassword: sellerPassword,
        phone: '254700000002',
        mobilePayment: '254700000002',
        city: 'Nairobi',
        location: 'Nairobi CBD',
        pickupLocation: 'Nairobi CBD',
        termsAccepted: true
      };

      const res = await fetch(`${baseUrl}/api/sellers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.status, 'success');
      assert.ok(body.data?.emailVerificationRequired || body.message?.includes('verification'));

      // Verify pending_registrations entry exists
      const { rows } = await pool.query(
        'SELECT email, role, verification_token FROM pending_registrations WHERE email = $1',
        [sellerEmail.toLowerCase()]
      );
      assert.equal(rows.length, 1, 'Pending seller registration must exist');
      assert.equal(rows[0].role, 'seller');

      // Overwrite token with known deterministic token to verify
      rawSellerToken = 'seller-token-' + timestamp;
      const hashedToken = crypto.createHash('sha256').update(rawSellerToken).digest('hex');
      await pool.query(
        'UPDATE pending_registrations SET verification_token = $1 WHERE email = $2',
        [hashedToken, sellerEmail.toLowerCase()]
      );
    });

    test('2. Unverified seller cannot log in (blocked with 403 PENDING_VERIFICATION)', async () => {
      const res = await fetch(`${baseUrl}/api/sellers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sellerEmail, password: sellerPassword })
      });

      const body = await res.json();
      assert.equal(res.status, 403, 'Unverified seller login must return 403');
      assert.ok(
        body.message.includes('not yet verified') || body.error === 'PENDING_VERIFICATION' || body.error === 'EMAIL_NOT_VERIFIED',
        'Should report verification required'
      );
    });

    test('3. Seller verifies email via GET /api/sellers/verify-email', async () => {
      // Overwrite token with known deterministic token to verify (login rotated it in test 2)
      rawSellerToken = 'seller-token-' + timestamp;
      const hashedToken = crypto.createHash('sha256').update(rawSellerToken).digest('hex');
      await pool.query(
        'UPDATE pending_registrations SET verification_token = $1 WHERE email = $2',
        [hashedToken, sellerEmail.toLowerCase()]
      );

      const res = await fetch(
        `${baseUrl}/api/sellers/verify-email?token=${encodeURIComponent(rawSellerToken)}&email=${encodeURIComponent(sellerEmail)}`
      );

      const body = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.status, 'success');

      // Verify promoted to users and sellers tables
      const { rows: userRows } = await pool.query(
        'SELECT id, email, is_verified FROM users WHERE email = $1',
        [sellerEmail.toLowerCase()]
      );
      assert.equal(userRows.length, 1, 'Seller user must exist in users table');
      assert.equal(userRows[0].is_verified, true, 'User must be marked verified');
      createdUserIds.push(userRows[0].id);

      const { rows: sellerRows } = await pool.query(
        'SELECT id, shop_name, user_id FROM sellers WHERE user_id = $1',
        [userRows[0].id]
      );
      assert.equal(sellerRows.length, 1, 'Seller profile must exist in sellers table');
      assert.equal(sellerRows[0].shop_name, shopName);
      createdSellerIds.push(sellerRows[0].id);
    });

    test('4. Verified seller logs in successfully with 200 and session token', async () => {
      const res = await fetch(`${baseUrl}/api/sellers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sellerEmail, password: sellerPassword })
      });

      const body = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.status, 'success');
      assert.ok(body.token || body.data?.token, 'Must return JWT session token');
      assert.ok(body.data?.user || body.data?.seller || body.data?.profile, 'Must return seller profile payload');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. CREATOR LIFECYCLE
  // ---------------------------------------------------------------------------
  describe('Creator Account Registration & Verification', () => {
    const creatorEmail = `creator-verify-${timestamp}@byblos.test`;
    const creatorPassword = 'Byblos#CreatorVerify123!';
    let rawCreatorToken;

    test('1. Creator registers and receives pending_verification status', async () => {
      const payload = {
        firstName: 'Test',
        lastName: 'CreatorVerify',
        email: creatorEmail,
        password: creatorPassword,
        confirmPassword: creatorPassword,
        mpesaNumber: '254700000003',
        whatsappNumber: '254700000003',
        termsAccepted: true
      };

      const res = await fetch(`${baseUrl}/api/creators/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await res.json();
      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.status, 'success');
      assert.equal(body.data?.status, 'pending_verification');

      // Verify created in users table with is_verified = false
      const { rows: userRows } = await pool.query(
        'SELECT id, email, is_verified FROM users WHERE email = $1',
        [creatorEmail.toLowerCase()]
      );
      assert.equal(userRows.length, 1, 'Creator user must exist in users table');
      assert.equal(userRows[0].is_verified, false, 'Creator must be unverified upon registration');
      createdUserIds.push(userRows[0].id);

      // Verify creator profile exists
      const { rows: creatorRows } = await pool.query(
        'SELECT id, user_id FROM creators WHERE user_id = $1',
        [userRows[0].id]
      );
      assert.equal(creatorRows.length, 1, 'Creator row must exist');
      createdCreatorIds.push(creatorRows[0].id);

      // Set deterministic verification token in users table
      rawCreatorToken = 'creator-token-' + timestamp;
      const hashedToken = crypto.createHash('sha256').update(rawCreatorToken).digest('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.query(
        'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE email = $3',
        [hashedToken, expires, creatorEmail.toLowerCase()]
      );
    });

    test('2. Unverified creator cannot log in (blocked with 403 EMAIL_NOT_VERIFIED)', async () => {
      const res = await fetch(`${baseUrl}/api/creators/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: creatorEmail, password: creatorPassword })
      });

      const body = await res.json();
      assert.equal(res.status, 403, 'Unverified creator login must return 403');
      assert.ok(
        body.message.includes('verify your email') || body.error === 'EMAIL_NOT_VERIFIED',
        'Should report EMAIL_NOT_VERIFIED'
      );
    });

    test('3. Creator verifies email via GET /api/creators/verify-email', async () => {
      const res = await fetch(
        `${baseUrl}/api/creators/verify-email?token=${encodeURIComponent(rawCreatorToken)}&email=${encodeURIComponent(creatorEmail)}`
      );

      const body = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.status, 'success');

      // Verify is_verified updated to true in users table
      const { rows } = await pool.query(
        'SELECT is_verified, email_verification_token FROM users WHERE email = $1',
        [creatorEmail.toLowerCase()]
      );
      assert.equal(rows[0].is_verified, true, 'User must be marked verified');
      assert.equal(rows[0].email_verification_token, null, 'Single-use token must be cleared');
    });

    test('4. Verified creator logs in successfully with 200 and session token', async () => {
      const res = await fetch(`${baseUrl}/api/creators/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: creatorEmail, password: creatorPassword })
      });

      const body = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.status, 'success');
      assert.ok(body.token || body.data?.token, 'Must return JWT session token');
      assert.ok(body.data?.creator || body.data?.user, 'Must return creator profile payload');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. RESEND VERIFICATION ENDPOINTS
  // ---------------------------------------------------------------------------
  describe('Verification Resend Security & Stability', () => {
    test('Resend verification endpoint returns success for buyer', async () => {
      const res = await fetch(`${baseUrl}/api/buyers/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `buyer-verify-${timestamp}@byblos.test` })
      });
      assert.equal(res.status, 200);
    });

    test('Resend verification endpoint returns success for seller', async () => {
      const res = await fetch(`${baseUrl}/api/sellers/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `seller-verify-${timestamp}@byblos.test` })
      });
      assert.equal(res.status, 200);
    });

    test('Resend verification endpoint returns success for creator', async () => {
      const res = await fetch(`${baseUrl}/api/creators/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `creator-verify-${timestamp}@byblos.test` })
      });
      assert.equal(res.status, 200);
    });
  });
});
