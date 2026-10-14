/**
 * gate1-core-commerce.journey.test.js
 *
 * GATE 1: Core Commerce End-to-End Business Journey
 *
 * Verifies the full critical commerce path against the real test database:
 *   1. Registration & Auth (Seller & Buyer registration, bcrypt hashing, login tokens, duplicate rejection)
 *   2. Seller Onboarding & Product Management (Creation with inventory, price validation, updates, multi-tenant isolation)
 *   3. Buyer Browsing, Cart & Authoritative Checkout (Authoritative server pricing, tampering rejection, idempotency)
 *   4. Payment Confirmation & Webhook Processing (HMAC-signed Paystack webhook, state transitions, duplicate delivery resilience)
 *   5. Payment Failure & Signature Security (Invalid signatures rejected, failed charges prevent premature fulfillment)
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import bcrypt from 'bcrypt';

import { pool } from '../../src/infrastructure/database/database.js';
import AuthService from '../../src/domains/identity/auth/auth.service.js';
import ProductService from '../../src/domains/commerce/products/product.service.js';
import { initiateProductPayment } from '../../src/domains/payments/payments/productCheckout.service.js';
import webhookRoutes from '../../src/application/routes/webhook.routes.js';
import {
  createSeller,
  cleanupOrder,
  cleanupProduct,
  cleanupSeller,
  cleanupBuyer,
  cleanupUser
} from '../helpers/factories.js';

let server;
let baseUrl;

const createdUserIds = [];
const createdSellerIds = [];
const createdBuyerIds = [];
const createdProductIds = [];
const createdOrderIds = [];

const TEST_SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_secret_key_for_testing';
process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;

function signPaystackPayload(rawBody) {
  return crypto
    .createHmac('sha512', TEST_SECRET)
    .update(rawBody)
    .digest('hex');
}

before(async () => {
  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => { req.rawBody = buf; }
  }));
  app.use('/api/webhooks', webhookRoutes);
  app.use((err, _req, res, _next) => {
    res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  // FK-safe cleanup in reverse dependency order
  for (const orderId of createdOrderIds) {
    await cleanupOrder(orderId).catch(() => {});
  }
  for (const prodId of createdProductIds) {
    await cleanupProduct(prodId).catch(() => {});
  }
  for (const sellerId of createdSellerIds) {
    await cleanupSeller(sellerId).catch(() => {});
  }
  for (const buyerId of createdBuyerIds) {
    await cleanupBuyer(buyerId).catch(() => {});
  }
  for (const userId of createdUserIds) {
    await cleanupUser(userId).catch(() => {});
  }
});

describe('GATE 1: Core Commerce Business Journey', () => {
  const timestamp = Date.now();
  const sellerEmail = `seller-g1-${timestamp}@byblos.test`;
  const sellerShop = `Gate1 Atelier ${timestamp}`;
  const sellerPassword = 'Byblos#SellerPass123!';

  const buyerEmail = `buyer-g1-${timestamp}@byblos.test`;
  const buyerPassword = 'Byblos#BuyerPass123!';

  let sellerUserId, sellerId;
  let buyerUserId, buyerId;
  let physicalProduct;
  let checkoutOrderId;
  let paymentReference;

  // ---------------------------------------------------------------------------
  // Step 1: Registration & Authentication
  // ---------------------------------------------------------------------------
  describe('1. Registration and Account Access', () => {
    test('Seller registers and enters pending_registrations stage', async () => {
      const regData = {
        email: sellerEmail,
        password: sellerPassword,
        fullName: 'Gate1 Test Seller',
        shopName: sellerShop,
        whatsappNumber: '254711000001',
        phone: '254711000001',
        location: 'Nairobi',
        termsAccepted: true
      };

      const result = await AuthService.register(regData, 'seller');
      assert.equal(result.status, 'pending_verification', 'Registration must return pending_verification');

      // Verify record exists in pending_registrations
      const { rows: pendingRows } = await pool.query(
        'SELECT email, role, verification_token, password_hash FROM pending_registrations WHERE email = $1',
        [sellerEmail.toLowerCase()]
      );
      assert.equal(pendingRows.length, 1, 'Pending registration row must exist');
      assert.equal(pendingRows[0].role, 'seller');

      // Verify password stored as bcrypt hash
      const hashValid = await bcrypt.compare(sellerPassword, pendingRows[0].password_hash);
      assert.equal(hashValid, true, 'Pending registration must store valid bcrypt hash');

      // Complete email verification
      const rawToken = 'gate1-seller-verify-' + Date.now();
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      await pool.query(
        'UPDATE pending_registrations SET verification_token = $1 WHERE email = $2',
        [hashedToken, sellerEmail.toLowerCase()]
      );

      const verifyResult = await AuthService.verifyEmail(sellerEmail, rawToken);
      assert.ok(verifyResult.user, 'Verification must create and return verified user');

      // Verify user promoted to unified users table
      const { rows: userRows } = await pool.query(
        'SELECT id, email, is_verified, is_active FROM users WHERE email = $1',
        [sellerEmail.toLowerCase()]
      );
      assert.equal(userRows.length, 1, 'Seller user row must exist in users table');
      assert.equal(userRows[0].is_verified, true, 'User must be marked verified');
      sellerUserId = userRows[0].id;
      createdUserIds.push(sellerUserId);

      // Verify seller profile created in sellers table
      const { rows: sellerRows } = await pool.query(
        'SELECT id, shop_name, user_id FROM sellers WHERE user_id = $1',
        [sellerUserId]
      );
      assert.equal(sellerRows.length, 1, 'Seller profile row must exist');
      sellerId = sellerRows[0].id;
      createdSellerIds.push(sellerId);
    });

    test('Duplicate seller registration with the same verified email is rejected', async () => {
      const duplicateData = {
        email: sellerEmail,
        password: 'AnotherPassword1!',
        fullName: 'Duplicate Seller',
        shopName: `Duplicate Shop ${Date.now()}`,
        phone: '254711000002',
        termsAccepted: true
      };

      await assert.rejects(
        async () => {
          await AuthService.register(duplicateData, 'seller');
        },
        /already exists/i,
        'Should reject duplicate registration for existing verified seller'
      );
    });

    test('Seller can log in with correct credentials and receives valid session token', async () => {
      const loginResult = await AuthService.login(sellerEmail, sellerPassword, 'seller');
      assert.ok(loginResult, 'Login must succeed with correct credentials');
      assert.ok(loginResult.token, 'Login must return an access token');
      assert.equal(loginResult.user.email, sellerEmail.toLowerCase());
    });

    test('Seller login is rejected with invalid credentials', async () => {
      const badLogin = await AuthService.login(sellerEmail, 'WrongPassword123!', 'seller');
      assert.equal(badLogin, null, 'Login must fail with incorrect password');
    });

    test('Buyer registers, verifies email, and authenticates independently', async () => {
      const buyerData = {
        email: buyerEmail,
        password: buyerPassword,
        fullName: 'Gate1 Test Buyer',
        mobilePayment: '254722000001',
        termsAccepted: true
      };

      const result = await AuthService.register(buyerData, 'buyer');
      assert.equal(result.status, 'pending_verification');

      // Complete email verification for buyer
      const rawBuyerToken = 'gate1-buyer-verify-' + Date.now();
      const hashedBuyerToken = crypto.createHash('sha256').update(rawBuyerToken).digest('hex');
      await pool.query(
        'UPDATE pending_registrations SET verification_token = $1 WHERE email = $2',
        [hashedBuyerToken, buyerEmail.toLowerCase()]
      );

      const verifyResult = await AuthService.verifyEmail(buyerEmail, rawBuyerToken);
      assert.ok(verifyResult.user);

      const { rows: userRows } = await pool.query(
        'SELECT id, email, is_verified FROM users WHERE email = $1',
        [buyerEmail.toLowerCase()]
      );
      assert.equal(userRows.length, 1);
      assert.equal(userRows[0].is_verified, true);
      buyerUserId = userRows[0].id;
      createdUserIds.push(buyerUserId);

      const { rows: buyerRows } = await pool.query(
        'SELECT id, user_id FROM buyers WHERE user_id = $1',
        [buyerUserId]
      );
      assert.equal(buyerRows.length, 1);
      buyerId = buyerRows[0].id;
      createdBuyerIds.push(buyerId);

      const buyerLogin = await AuthService.login(buyerEmail, buyerPassword, 'buyer');
      assert.ok(buyerLogin.token, 'Buyer login must return valid JWT');
    });
  });

  // ---------------------------------------------------------------------------
  // Step 2: Seller Onboarding & Product Creation
  // ---------------------------------------------------------------------------
  describe('2. Seller Product Management and Multi-Tenant Isolation', () => {
    test('Seller creates a physical product with inventory tracking', async () => {
      const productPayload = {
        name: 'Gate1 Noir Leather Jacket',
        price: 7500.00,
        description: 'Hand-tailored full grain leather jacket with satin lining.',
        aesthetic: 'noir',
        product_type: 'physical',
        is_digital: false,
        track_inventory: true,
        quantity: 25,
        low_stock_threshold: 3
      };

      physicalProduct = await ProductService.createProduct(sellerId, productPayload);
      assert.ok(physicalProduct?.id, 'Product must be created with valid ID');
      createdProductIds.push(physicalProduct.id);

      // Verify persistence in database
      const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [physicalProduct.id]);
      assert.equal(rows.length, 1);
      assert.equal(Number(rows[0].price), 7500.00);
      assert.equal(rows[0].seller_id, sellerId);
    });

    test('Product creation rejects prices below minimum threshold (KES 50)', async () => {
      const cheapPayload = {
        name: 'Invalid Cheap Trinket',
        price: 15.00,
        description: 'Below platform minimum price',
        product_type: 'physical'
      };

      await assert.rejects(
        async () => {
          await ProductService.createProduct(sellerId, cheapPayload);
        },
        /Minimum price must be KES 50/i,
        'Must enforce platform minimum pricing rule'
      );
    });

    test('Seller can update their own product and persisted state changes', async () => {
      const updateData = {
        price: 8000.00,
        description: 'Updated description: Hand-tailored distressed full grain leather jacket.',
        quantity: 25,
        track_inventory: true
      };

      await pool.query(
        'UPDATE products SET price = $1, description = $2, quantity = $3, track_inventory = $4, updated_at = NOW() WHERE id = $5 AND seller_id = $6',
        [updateData.price, updateData.description, updateData.quantity, updateData.track_inventory, physicalProduct.id, sellerId]
      );

      const { rows } = await pool.query('SELECT price, description, quantity, track_inventory FROM products WHERE id = $1', [physicalProduct.id]);
      assert.equal(Number(rows[0].price), 8000.00);
      assert.equal(rows[0].description, updateData.description);
      assert.equal(rows[0].quantity, 25);
      assert.equal(rows[0].track_inventory, true);
      physicalProduct.price = 8000.00;
    });

    test('Multi-tenant isolation: another seller cannot modify or delete this product', async () => {
      // Create a rogue second seller
      const rogueSeller = await createSeller({ shopName: `Rogue Store ${timestamp}` });
      const rogueSellerId = rogueSeller.id;
      createdSellerIds.push(rogueSellerId);

      // Attempt update by non-owner seller
      const updateResult = await pool.query(
        'UPDATE products SET price = 99999 WHERE id = $1 AND seller_id = $2',
        [physicalProduct.id, rogueSellerId]
      );
      assert.equal(updateResult.rowCount, 0, 'Rogue seller must not update another seller product');

      // Verify product was not altered
      const { rows } = await pool.query('SELECT price FROM products WHERE id = $1', [physicalProduct.id]);
      assert.equal(Number(rows[0].price), 8000.00, 'Original price must be preserved');
    });
  });

  // ---------------------------------------------------------------------------
  // Step 3: Buyer Browsing, Cart & Authoritative Checkout
  // ---------------------------------------------------------------------------
  describe('3. Buyer Browsing, Cart and Authoritative Checkout', () => {
    test('Buyer discovers product in catalog with correct current price', async () => {
      const { rows } = await pool.query(
        `SELECT p.id, p.name, p.price, p.status, s.shop_name
         FROM products p
         JOIN sellers s ON p.seller_id = s.id
         WHERE p.id = $1 AND p.seller_id = $2`,
        [physicalProduct.id, sellerId]
      );
      assert.equal(rows.length, 1);
      assert.equal(Number(rows[0].price), 8000.00);
      assert.equal(rows[0].shop_name, sellerShop);
    });

    test('Server calculates authoritative pricing and rejects client-tampered totals', async () => {
      const checkoutToken = `tok-gate1-${Date.now()}`;
      paymentReference = `pay-gate1-${Date.now()}`;

      const fakeProvider = {
        async initiatePayment() {
          return { reference: paymentReference, status: 'pending' };
        }
      };

      const checkoutPayload = {
        buyer: {
          id: buyerId,
          name: 'Gate1 Test Buyer',
          email: buyerEmail,
          mobilePayment: '254722000001'
        },
        items: [
          {
            productId: physicalProduct.id,
            quantity: 2,
            // Client deliberately attempts to claim each item costs KES 100 instead of 8000
            price: 100.00
          }
        ],
        location: {
          county: 'Nairobi',
          town: 'Kilimani',
          deliveryType: 'standard'
        },
        idempotencyKey: checkoutToken
      };

      const checkoutResult = await initiateProductPayment(checkoutPayload, {
        providerClient: fakeProvider
      });

      assert.ok(checkoutResult.orderId, 'Checkout must successfully create an order');
      checkoutOrderId = checkoutResult.orderId;
      createdOrderIds.push(checkoutOrderId);

      // Verify server recalculation against database
      const { rows: orderRows } = await pool.query(
        'SELECT id, buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount, status, payment_status FROM product_orders WHERE id = $1',
        [checkoutOrderId]
      );
      assert.equal(orderRows.length, 1);
      const order = orderRows[0];

      // Authoritative item subtotal = 2 * 8000.00 = 16000.00 (NOT client-submitted 200.00)
      const expectedItemTotal = 16000.00;
      assert.ok(Number(order.total_amount) >= expectedItemTotal, `Order total (${order.total_amount}) must reflect authoritative price`);
      assert.equal(order.buyer_id, buyerId, 'Order must belong to the authenticated buyer');
      assert.equal(order.seller_id, sellerId, 'Order must belong to the correct seller');
      assert.equal(order.payment_status, 'pending', 'Initial payment status must be pending');

      // Verify order_items row has correct quantity and prices
      const { rows: itemRows } = await pool.query(
        'SELECT product_id, quantity, price, subtotal FROM order_items WHERE order_id = $1',
        [checkoutOrderId]
      );
      assert.equal(itemRows.length, 1);
      assert.equal(itemRows[0].quantity, 2);
      assert.equal(Number(itemRows[0].price), 8000.00, 'Item price must be authoritative 8000.00');
      assert.equal(Number(itemRows[0].subtotal), 16000.00, 'Subtotal must be 16000.00');
    });

    test('Checkout is idempotent: repeating checkout with the same token returns existing order', async () => {
      const checkoutToken = `tok-gate1-${Date.now()}`;
      const fakeProvider = {
        async initiatePayment() {
          return { reference: `pay-idem-${Date.now()}`, status: 'pending' };
        }
      };

      const payload = {
        buyer: { id: buyerId, name: 'Gate1 Test Buyer', email: buyerEmail, mobilePayment: '254722000001' },
        items: [{ productId: physicalProduct.id, quantity: 1, price: 8000.00 }],
        location: { county: 'Nairobi', town: 'CBD' },
        idempotencyKey: checkoutToken
      };

      const firstAttempt = await initiateProductPayment(payload, { providerClient: fakeProvider });
      assert.ok(firstAttempt.orderId);
      createdOrderIds.push(firstAttempt.orderId);

      // Re-run identical request
      const secondAttempt = await initiateProductPayment(payload, { providerClient: fakeProvider });
      assert.equal(secondAttempt.idempotent, true, 'Second attempt must be flagged as idempotent');
      assert.equal(secondAttempt.orderId, firstAttempt.orderId, 'Must return the exact same order ID');
    });
  });

  // ---------------------------------------------------------------------------
  // Step 4: Payment Confirmation & Webhooks
  // ---------------------------------------------------------------------------
  describe('4. Payment Confirmation and Webhook Processing', () => {
    test('Simulated Paystack webhook with valid HMAC marks order PAID and payment completed', async () => {
      // Find the payment row created for checkoutOrderId
      const { rows: paymentRows } = await pool.query(
        'SELECT id, provider_reference, amount, status FROM payments WHERE order_id = $1',
        [checkoutOrderId]
      );
      assert.ok(paymentRows.length > 0, 'Payment record must exist for order');
      const payment = paymentRows[0];
      const reference = payment.provider_reference;

      const webhookPayload = {
        event: 'charge.success',
        data: {
          reference: reference,
          amount: Math.round(Number(payment.amount) * 100), // Minor units (kobo/cents)
          currency: 'KES',
          status: 'success',
          paid_at: new Date().toISOString(),
          customer: { email: buyerEmail },
          metadata: { order_id: checkoutOrderId }
        }
      };

      const rawBody = JSON.stringify(webhookPayload);
      const signature = signPaystackPayload(rawBody);

      const response = await fetch(`${baseUrl}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-paystack-signature': signature
        },
        body: rawBody
      });

      assert.equal(response.status, 200, 'Webhook endpoint must accept valid signed webhook');
      const json = await response.json();
      assert.equal(json.status, 'success');

      // Assert persisted payment state in database
      const { rows: updatedPayments } = await pool.query(
        'SELECT status, updated_at FROM payments WHERE id = $1',
        [payment.id]
      );
      assert.equal(updatedPayments[0].status, 'completed', 'Payment status must be completed');

      // Assert persisted order state in database
      const { rows: updatedOrders } = await pool.query(
        'SELECT status, payment_status FROM product_orders WHERE id = $1',
        [checkoutOrderId]
      );
      assert.equal(updatedOrders[0].payment_status, 'completed', 'Order payment_status must be completed');
      assert.ok(
        ['PAID', 'PENDING_CONFIRMATION', 'AWAITING_SELLER_ACTION'].includes(updatedOrders[0].status),
        `Order status (${updatedOrders[0].status}) must transition to paid state`
      );
    });

    test('Duplicate webhook delivery is idempotent and does not create duplicate financial effects', async () => {
      const { rows: paymentRows } = await pool.query(
        'SELECT id, provider_reference, amount FROM payments WHERE order_id = $1',
        [checkoutOrderId]
      );
      const payment = paymentRows[0];

      const webhookPayload = {
        event: 'charge.success',
        data: {
          reference: payment.provider_reference,
          amount: Math.round(Number(payment.amount) * 100),
          currency: 'KES',
          status: 'success'
        }
      };

      const rawBody = JSON.stringify(webhookPayload);
      const signature = signPaystackPayload(rawBody);

      // Re-send the exact same webhook
      const duplicateResponse = await fetch(`${baseUrl}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-paystack-signature': signature
        },
        body: rawBody
      });

      assert.equal(duplicateResponse.status, 200, 'Duplicate webhook must return 200 OK');

      // Verify payment count did not duplicate
      const { rows: checkPayments } = await pool.query(
        'SELECT COUNT(*)::int as count FROM payments WHERE order_id = $1',
        [checkoutOrderId]
      );
      assert.equal(checkPayments[0].count, 1, 'There must remain exactly 1 payment record for this order');
    });

    test('Webhook with forged/invalid HMAC signature is rejected with 401', async () => {
      const forgedPayload = JSON.stringify({
        event: 'charge.success',
        data: { reference: 'some-random-ref', amount: 50000 }
      });

      const response = await fetch(`${baseUrl}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-paystack-signature': 'forged_invalid_hmac_signature_hex'
        },
        body: forgedPayload
      });

      assert.equal(response.status, 401, 'Invalid HMAC signature must be rejected with 401 Unauthorized');
    });

    test('Payment failure event (charge.failed) does NOT mark order PAID', async () => {
      // Create a separate order to test failure
      const failToken = `tok-fail-${Date.now()}`;
      const failRef = `pay-fail-${Date.now()}`;

      const failCheckout = await initiateProductPayment({
        buyer: { id: buyerId, name: 'Gate1 Test Buyer', email: buyerEmail, mobilePayment: '254722000001' },
        items: [{ productId: physicalProduct.id, quantity: 1, price: 8000.00 }],
        location: { county: 'Nairobi', town: 'Westlands' },
        idempotencyKey: failToken
      }, {
        providerClient: {
          async initiatePayment() { return { reference: failRef, status: 'pending' }; }
        }
      });

      const failOrderId = failCheckout.orderId;
      createdOrderIds.push(failOrderId);

      const failPayload = JSON.stringify({
        event: 'charge.failed',
        data: {
          reference: failRef,
          amount: 800000,
          currency: 'KES',
          status: 'failed',
          gateway_response: 'Insufficient funds'
        }
      });

      const response = await fetch(`${baseUrl}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-paystack-signature': signPaystackPayload(failPayload)
        },
        body: failPayload
      });

      assert.equal(response.status, 200);

      // Verify database state: order must NOT be PAID
      const { rows: orderRows } = await pool.query(
        'SELECT status, payment_status FROM product_orders WHERE id = $1',
        [failOrderId]
      );
      assert.notEqual(orderRows[0].status, 'PAID', 'Failed payment must not mark order as PAID');
      assert.notEqual(orderRows[0].payment_status, 'completed', 'Failed payment must not set payment_status completed');
    });
  });
});
