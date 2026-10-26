import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { pool } from '../src/infrastructure/database/database.js';
import User from '../src/domains/identity/users/user.model.js';
import Buyer from '../src/domains/commerce/buyers/buyer.model.js';
import Order from '../src/domains/orders/order/order.model.js';
import BuyerService from '../src/domains/commerce/buyers/buyer.service.js';
import * as V from '../src/shared/validations/buyer.validation.js';

describe('Guest Checkout Order Claiming & Account Linking', () => {
  let testUserId = null;
  let testBuyerId = null;
  const testPassword = 'Password123!';
  const testEmail = `guest-claim-${Date.now()}@byblos.test`;
  const testCheckoutToken = `claim-token-${Date.now()}`;
  let testOrderId = null;

  before(async () => {
    // 1. Create an existing seller user who will also make a guest purchase with the same email
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active, is_verified)
       VALUES ($1, $2, 'seller', true, true)
       RETURNING id`,
      [testEmail, passwordHash]
    );
    testUserId = userRes.rows[0].id;

    // 2. Query an existing seller or create one
    let sellerId;
    const existingSeller = await pool.query('SELECT id FROM sellers LIMIT 1');
    if (existingSeller.rows.length > 0) {
      sellerId = existingSeller.rows[0].id;
    } else {
      const sRes = await pool.query(
        `INSERT INTO sellers (user_id, full_name, email, shop_name, terms_accepted, location, status)
         VALUES ($1, 'Test Seller', $2, $3, true, 'Nairobi', 'active') RETURNING id`,
        [testUserId, testEmail, `test-shop-${Date.now()}`]
      );
      sellerId = sRes.rows[0].id;
    }

    // 3. Create a dummy guest order with buyer_id = NULL and client_checkout_token set
    const orderNumber = `BYB-TEST-GUEST-${Date.now()}`;
    const orderRes = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,
         status, payment_status, client_checkout_token
       ) VALUES (
         $1, NULL, $2, 1000, 50, 950,
         'PAID', 'completed', $3
       ) RETURNING id`,
      [orderNumber, sellerId, testCheckoutToken]
    );
    testOrderId = orderRes.rows[0].id;
  });

  after(async () => {
    if (testOrderId) {
      await pool.query('DELETE FROM product_orders WHERE id = $1', [testOrderId]).catch(() => {});
    }
    if (testUserId) {
      await pool.query('DELETE FROM buyers WHERE user_id = $1', [testUserId]).catch(() => {});
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [testUserId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]).catch(() => {});
    }
  });

  test('Validation: claimGuestOrder requires email, password (min 8 chars), and checkoutToken', () => {
    const invalidEmpty = V.claimGuestOrder.safeParse({});
    assert.strictEqual(invalidEmpty.success, false);

    const invalidShortPwd = V.claimGuestOrder.safeParse({
      email: 'valid@example.com',
      password: 'short',
      checkoutToken: 'tok123'
    });
    assert.strictEqual(invalidShortPwd.success, false);

    const valid = V.claimGuestOrder.safeParse({
      email: 'valid@example.com',
      password: 'StrongPassword123!',
      checkoutToken: 'tok123'
    });
    assert.strictEqual(valid.success, true);
  });

  test('BuyerService.claimGuestOrder rejects incorrect password for existing account', async () => {
    await assert.rejects(
      async () => {
        await BuyerService.claimGuestOrder({
          email: testEmail,
          password: 'WrongPassword999!',
          checkoutToken: testCheckoutToken
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.match(err.message, /Incorrect password/i);
        return true;
      }
    );
  });

  test('BuyerService.claimGuestOrder links guest order and returns token when password is correct', async () => {
    const result = await BuyerService.claimGuestOrder({
      email: testEmail,
      password: testPassword,
      checkoutToken: testCheckoutToken
    });

    assert.ok(result.token, 'Should return a JWT token');
    assert.ok(result.buyer, 'Should return the buyer profile');

    // Verify order was linked to buyer in database
    const orderCheck = await pool.query(
      `SELECT buyer_id FROM product_orders WHERE id = $1`,
      [testOrderId]
    );
    assert.strictEqual(orderCheck.rows[0].buyer_id, result.buyer.id);
  });

  test('BuyerService.claimGuestOrder creates a new user and buyer when email does not exist', async () => {
    const brandNewEmail = `brand-new-guest-${Date.now()}@byblos.test`;
    const brandNewToken = `new-guest-token-${Date.now()}`;
    const orderNumber = `BYB-NEW-GUEST-${Date.now()}`;

    // Get an existing seller id
    const sellerRes = await pool.query('SELECT id FROM sellers LIMIT 1');
    const sellerId = sellerRes.rows[0].id;

    // Create an unlinked guest order
    const orderRes = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,
         status, payment_status, client_checkout_token
       ) VALUES (
         $1, NULL, $2, 500, 25, 475,
         'PAID', 'completed', $3
       ) RETURNING id`,
      [orderNumber, sellerId, brandNewToken]
    );
    const newOrderId = orderRes.rows[0].id;

    try {
      const result = await BuyerService.claimGuestOrder({
        email: brandNewEmail,
        password: 'BrandNewPassword123!',
        checkoutToken: brandNewToken
      });

      assert.ok(result.token, 'Should return a JWT token for brand new user');
      assert.ok(result.buyer, 'Should return the newly created buyer profile');

      // Verify order was linked
      const check = await pool.query('SELECT buyer_id FROM product_orders WHERE id = $1', [newOrderId]);
      assert.strictEqual(check.rows[0].buyer_id, result.buyer.id);

      // Verify user was created in users table
      const userCheck = await pool.query('SELECT id, email, role FROM users WHERE LOWER(email) = $1', [brandNewEmail.toLowerCase()]);
      assert.strictEqual(userCheck.rows.length, 1);
      assert.strictEqual(userCheck.rows[0].role, 'buyer');

      // Cleanup
      await pool.query('DELETE FROM product_orders WHERE id = $1', [newOrderId]).catch(() => {});
      await pool.query('DELETE FROM buyers WHERE id = $1', [result.buyer.id]).catch(() => {});
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userCheck.rows[0].id]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id = $1', [userCheck.rows[0].id]).catch(() => {});
    } catch (e) {
      await pool.query('DELETE FROM product_orders WHERE id = $1', [newOrderId]).catch(() => {});
      throw e;
    }
  });

  test('Security: BuyerService.claimGuestOrder rejects claiming an order with mismatched email', async () => {
    const aliceEmail = `alice-${Date.now()}@byblos.test`;
    const eveEmail = `eve-${Date.now()}@byblos.test`;
    const aliceToken = `alice-token-${Date.now()}`;
    const orderNumber = `BYB-ALICE-GUEST-${Date.now()}`;

    const sellerRes = await pool.query('SELECT id FROM sellers LIMIT 1');
    const sellerId = sellerRes.rows[0].id;

    // Create an unlinked guest order belonging to Alice
    const orderRes = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,
         status, payment_status, client_checkout_token, buyer_email
       ) VALUES (
         $1, NULL, $2, 600, 30, 570,
         'PAID', 'completed', $3, $4
       ) RETURNING id`,
      [orderNumber, sellerId, aliceToken, aliceEmail]
    );
    const orderId = orderRes.rows[0].id;

    try {
      // Eve attempts to claim Alice's order using Alice's token
      await assert.rejects(
        async () => {
          await BuyerService.claimGuestOrder({
            email: eveEmail,
            password: 'EvePassword123!',
            checkoutToken: aliceToken
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          assert.match(err.message, /order not found or does not match/i);
          return true;
        }
      );

      // Verify order is still not claimed by Eve
      const check = await pool.query('SELECT buyer_id FROM product_orders WHERE id = $1', [orderId]);
      assert.strictEqual(check.rows[0].buyer_id, null);
    } finally {
      await pool.query('DELETE FROM product_orders WHERE id = $1', [orderId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE LOWER(email) = $1', [eveEmail.toLowerCase()]).catch(() => {});
    }
  });
});
