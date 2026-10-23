import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import Buyer from '../src/domains/commerce/buyers/buyer.model.js';
import { switchRole } from '../src/application/controllers/account.controller.js';
import ProfileProvisioningService from '../src/domains/identity/users/profileProvisioning.service.js';
import { pool } from '../src/infrastructure/database/database.js';

describe('switchRole & Profile Linking — Uniform Role Provisioning', () => {
  let testUserId = null;
  const testPassword = 'Password123!';
  const testEmail = `switch-role-${Date.now()}@byblos.test`;

  before(async () => {
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active, is_verified)
       VALUES ($1, $2, 'seller', true, true)
       RETURNING id`,
      [testEmail, passwordHash]
    );
    testUserId = userRes.rows[0].id;

    // Create seller for this user
    await pool.query(
      `INSERT INTO sellers (user_id, full_name, email, shop_name, terms_accepted, location, status)
       VALUES ($1, 'Seller Without Phone', $2, $3, true, 'Nairobi', 'active')`,
      [testUserId, testEmail, `shop-nophone-${Date.now()}`]
    );
  });

  after(async () => {
    if (testUserId) {
      await pool.query('DELETE FROM buyers WHERE user_id = $1', [testUserId]).catch(() => {});
      await pool.query('DELETE FROM sellers WHERE user_id = $1', [testUserId]).catch(() => {});
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [testUserId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]).catch(() => {});
    }
  });

  test('Buyer.create passes non-null mobilePayment fallback when mobilePayment is null or undefined', async () => {
    let capturedValues = null;
    const fakeClient = {
      async query(sql, values) {
        capturedValues = values;
        return {
          rows: [
            {
              id: 101,
              full_name: 'Test Seller',
              email: 'seller@example.com',
              mobile_payment: values[2],
              whatsapp_number: values[3],
              city: 'Nairobi',
              location: 'Nairobi',
              user_id: 55,
              terms_accepted: true,
            }
          ]
        };
      }
    };

    const result = await Buyer.create({
      fullName: 'Test Seller',
      email: 'seller@example.com',
      mobilePayment: null,
      whatsappNumber: null,
      city: 'Nairobi',
      location: 'Nairobi',
      userId: 55,
      termsAccepted: true
    }, fakeClient);

    assert.ok(result);
    // values[2] is mobile_payment in the INSERT statement
    assert.equal(capturedValues[2], '', 'mobile_payment must be an empty string fallback, never null or undefined');
  });

  test('switchRole rejects with 403 PROFILE_REQUIRED when buyer profile does not exist (no silent auto-provisioning)', async () => {
    let nextError = null;

    const fakeUser = {
      id: testUserId,
      email: testEmail,
      userType: 'seller',
      role: 'seller',
      hasBuyerProfile: false,
      hasSellerProfile: true,
      hasCreatorProfile: false,
    };

    const req = {
      body: { role: 'buyer' },
      user: fakeUser,
    };

    const res = {
      status() { return this; },
      json() { return this; },
      cookie() { return this; },
      clearCookie() { return this; }
    };

    const next = (err) => {
      nextError = err;
    };

    await switchRole(req, res, next);

    assert.ok(nextError, 'switchRole must pass an error to next() when profile does not exist');
    assert.equal(nextError.statusCode, 403);
    assert.equal(nextError.code, 'PROFILE_REQUIRED');
  });

  test('createBuyerProfileForExistingUser rejects with EXISTING_ACCOUNT when password does not match', async () => {
    await assert.rejects(
      async () => {
        await ProfileProvisioningService.createBuyerProfileForExistingUser({
          fullName: 'Test User',
          email: testEmail,
          password: 'WrongPassword!',
          city: 'Nairobi',
          location: 'Westlands',
          termsAccepted: true
        });
      },
      (err) => {
        assert.equal(err.code, 'EXISTING_ACCOUNT');
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('Enter that account password'));
        return true;
      }
    );
  });

  test('createBuyerProfileForExistingUser succeeds when password matches and links profile to existing user', async () => {
    const buyer = await ProfileProvisioningService.createBuyerProfileForExistingUser({
      fullName: 'Test User',
      email: testEmail,
      password: testPassword,
      mobilePayment: '0712345678',
      whatsappNumber: '0712345678',
      city: 'Nairobi',
      location: 'Westlands',
      termsAccepted: true
    });

    assert.ok(buyer);
    assert.equal(buyer.email, testEmail);

    const buyerRes = await pool.query('SELECT * FROM buyers WHERE user_id = $1', [testUserId]);
    assert.equal(buyerRes.rows.length, 1, 'Buyer profile must be linked to user_id');
  });

  test('switchRole succeeds after buyer profile is provisioned', async () => {
    let statusCode = null;
    let jsonResult = null;
    let nextError = null;

    const fakeUser = {
      id: testUserId,
      email: testEmail,
      userType: 'seller',
      role: 'seller',
      hasBuyerProfile: true,
      hasSellerProfile: true,
      hasCreatorProfile: false,
    };

    const req = {
      body: { role: 'buyer' },
      user: fakeUser,
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResult = data;
        return this;
      },
      cookie() {
        return this;
      },
      clearCookie() {
        return this;
      }
    };

    const next = (err) => {
      nextError = err;
    };

    await switchRole(req, res, next);

    assert.equal(nextError, null);
    assert.equal(statusCode, 200);
    assert.equal(jsonResult.status, 'success');
    assert.equal(jsonResult.data.role, 'buyer');
  });
});
