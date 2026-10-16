import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { pool } from '../src/infrastructure/database/database.js';
import { createUser, createBuyer, createSeller, createProduct, cleanupProduct, cleanupSeller, cleanupBuyer, cleanupUser } from './helpers/factories.js';
import * as digitalDownloadRepository from '../src/domains/commerce/repositories/digitalDownload.repository.js';
import PaymentReceiptService from '../src/domains/payments/payments/paymentReceipt.service.js';
import AuthService from '../src/domains/identity/auth/auth.service.js';
import { getOrderStatus } from '../src/application/controllers/public.controller.js';

describe('Buyer & Guest Payment Remediations Integration Tests', () => {
  let sellerUser, seller, buyerUser, buyer, digitalProd;
  const createdOrderIds = [];
  const testPassword = 'Password123!';

  test('setup test fixtures', async () => {
    sellerUser = await createUser({ role: 'seller' });
    seller = await createSeller({ userId: sellerUser.id });

    const passwordHash = await bcrypt.hash(testPassword, 10);
    const buyerEmail = `guest-test-${Date.now()}@byblos.test`;
    const { rows: userRows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_verified, is_active, created_at, updated_at)
       VALUES ($1, $2, 'buyer', true, true, NOW(), NOW())
       RETURNING *`,
      [buyerEmail, passwordHash]
    );
    buyerUser = userRows[0];
    buyer = await createBuyer({ userId: buyerUser.id, email: buyerEmail, termsAccepted: true });

    digitalProd = await createProduct({
      sellerId: seller.id,
      name: 'Test E-Book',
      price: 250,
      productType: 'digital',
      isDigital: true,
      digitalFilePath: 'digital_products/sample_ebook.pdf',
      digitalFileName: 'sample_ebook.pdf'
    });
  });

  after(async () => {
    for (const orderId of createdOrderIds) {
      await pool.query('DELETE FROM digital_access WHERE order_id = $1', [orderId]).catch(() => {});
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]).catch(() => {});
      await pool.query('DELETE FROM payments WHERE order_id = $1', [orderId]).catch(() => {});
      await pool.query('DELETE FROM product_orders WHERE id = $1', [orderId]).catch(() => {});
    }
    if (digitalProd) await cleanupProduct(digitalProd.id);
    if (buyer) await cleanupBuyer(buyer.id);
    if (buyerUser) await cleanupUser(buyerUser.id);
    if (seller) await cleanupSeller(seller.id);
    if (sellerUser) await cleanupUser(sellerUser.id);
  });

  test('1. Guest with client_checkout_token can access completed digital item even when buyer_id is NULL', async () => {
    const token = `tok-guest-${Date.now()}`;
    const orderNumber = `BYB-TEST-${Date.now()}`;

    const { rows: orderRows } = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, seller_id, total_amount, platform_fee_amount,
         seller_payout_amount, payment_method, buyer_name, buyer_email,
         buyer_mobile_payment, status, payment_status, order_type, client_checkout_token
       ) VALUES (
         $1, NULL, $2, 250, 25, 225, 'paystack', 'Guest Buyer', 'guest@test.local',
         '0712345678', 'COMPLETED'::order_status, 'completed'::payment_status, 'DIGITAL'::order_type, $3
       ) RETURNING *`,
      [orderNumber, seller.id, token]
    );
    const order = orderRows[0];
    createdOrderIds.push(order.id);

    await pool.query(
      `INSERT INTO order_items (order_id, product_id, name, product_name, price, product_price, quantity, subtotal)
       VALUES ($1, $2, 'Test E-Book', 'Test E-Book', 250, 250, 1, 250)`,
      [order.id, digitalProd.id]
    );

    // Verify retrieval by clientCheckoutToken
    const item = await digitalDownloadRepository.findVerifiedDigitalItem({
      orderId: order.id,
      clientCheckoutToken: token,
      productId: digitalProd.id
    });

    assert.ok(item, 'Digital item should be retrieved using clientCheckoutToken');
    assert.equal(item.order_id, order.id);
    assert.equal(item.product_id, digitalProd.id);
    assert.equal(item.digital_file_name, 'sample_ebook.pdf');

    // Wrong token must be rejected
    const wrongItem = await digitalDownloadRepository.findVerifiedDigitalItem({
      orderId: order.id,
      clientCheckoutToken: 'wrong-token',
      productId: digitalProd.id
    });
    assert.equal(wrongItem, undefined, 'Invalid token should return undefined');
  });

  test('2. AuthService.login late-binds unlinked guest orders matching the buyer email', async () => {
    const orderNumber = `BYB-LOGIN-LATE-${Date.now()}`;
    const token = `tok-login-late-${Date.now()}`;
    const { rows: orderRows } = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, seller_id, total_amount, platform_fee_amount,
         seller_payout_amount, payment_method, buyer_name, buyer_email,
         buyer_mobile_payment, status, payment_status, order_type, client_checkout_token
       ) VALUES (
         $1, NULL, $2, 250, 25, 225, 'paystack', 'Guest Late', $3,
         '0712345678', 'PAID'::order_status, 'completed'::payment_status, 'PHYSICAL'::order_type, $4
       ) RETURNING *`,
      [orderNumber, seller.id, buyerUser.email, token]
    );
    const order = orderRows[0];
    createdOrderIds.push(order.id);

    assert.equal(order.buyer_id, null, 'Initially order buyer_id is null');

    // Perform buyer login
    const loginResult = await AuthService.login(buyerUser.email, testPassword, 'buyer', true);
    assert.ok(loginResult, 'Login should succeed');

    // Check DB that order was updated
    const { rows: updatedRows } = await pool.query(
      'SELECT buyer_id FROM product_orders WHERE id = $1',
      [order.id]
    );
    assert.equal(updatedRows[0].buyer_id, buyer.id, 'Order buyer_id should be linked to buyer.id upon login');
  });

  test('3. getOrderStatus mints autoLoginToken for guest order matching verified buyer and late-binds buyer_id', async () => {
    const token = `tok-autologin-${Date.now()}`;
    const orderNumber = `BYB-AUTOLOGIN-${Date.now()}`;

    const { rows: orderRows } = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, seller_id, total_amount, platform_fee_amount,
         seller_payout_amount, payment_method, buyer_name, buyer_email,
         buyer_mobile_payment, status, payment_status, order_type, client_checkout_token
       ) VALUES (
         $1, NULL, $2, 250, 25, 225, 'paystack', 'Guest Auto', $3,
         '0712345678', 'PAID'::order_status, 'completed'::payment_status, 'PHYSICAL'::order_type, $4
       ) RETURNING *`,
      [orderNumber, seller.id, buyerUser.email, token]
    );
    const order = orderRows[0];
    createdOrderIds.push(order.id);

    // Create a mock payment row so getOrderStatus sync passes
    await pool.query(
      `INSERT INTO payments (order_id, invoice_id, amount, status, payment_method, provider_reference, email)
       VALUES ($1, $2, 250, 'completed', 'paystack', $3, $4)
       RETURNING *`,
      [order.id, `inv-${Date.now()}`, `ref-${Date.now()}`, buyerUser.email]
    );

    let capturedResponse = null;
    const req = {
      params: { id: orderNumber },
      query: { client_checkout_token: token }
    };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        capturedResponse = data;
        return this;
      }
    };

    await getOrderStatus(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(capturedResponse?.data?.autoLoginToken, 'autoLoginToken should be minted for verified buyer matching email + token');

    // Confirm DB late-binding
    const { rows: updatedRows } = await pool.query(
      'SELECT buyer_id FROM product_orders WHERE id = $1',
      [order.id]
    );
    assert.equal(updatedRows[0].buyer_id, buyer.id, 'Order buyer_id should be late-bound to buyer.id');
  });

  test('4. PaymentReceiptService includes download_url and download_urls for digital orders', async () => {
    const token = `tok-receipt-${Date.now()}`;
    const orderNumber = `BYB-RECEIPT-${Date.now()}`;

    const { rows: orderRows } = await pool.query(
      `INSERT INTO product_orders (
         order_number, buyer_id, seller_id, total_amount, platform_fee_amount,
         seller_payout_amount, payment_method, buyer_name, buyer_email,
         buyer_mobile_payment, status, payment_status, order_type, client_checkout_token
       ) VALUES (
         $1, $2, $3, 250, 25, 225, 'paystack', 'Digital Buyer', $4,
         '0712345678', 'COMPLETED'::order_status, 'completed'::payment_status, 'DIGITAL'::order_type, $5
       ) RETURNING *`,
      [orderNumber, buyer.id, seller.id, buyerUser.email, token]
    );
    const order = orderRows[0];
    createdOrderIds.push(order.id);

    await pool.query(
      `INSERT INTO order_items (order_id, product_id, name, product_name, price, product_price, quantity, subtotal)
       VALUES ($1, $2, 'Test E-Book', 'Test E-Book', 250, 250, 1, 250)`,
      [order.id, digitalProd.id]
    );

    const payment = {
      id: 999999,
      amount: 250,
      payment_method: 'paystack',
      metadata: '{}'
    };

    const payload = await PaymentReceiptService.buildBuyerPaymentEmailPayload({
      payment,
      order
    });

    assert.ok(payload.download_url, 'Receipt payload should have download_url');
    assert.ok(payload.download_url.includes(`/api/orders/${order.id}/download/${digitalProd.id}`), 'download_url should point to digital download endpoint');
    assert.ok(payload.download_url.includes(token), 'download_url should include client_checkout_token');
    assert.equal(payload.download_urls.length, 1);
  });
});
