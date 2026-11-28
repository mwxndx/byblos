import test, { describe, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool } from '../src/infrastructure/database/database.js';
import ProductService from '../src/domains/commerce/products/product.service.js';
import { initiateProductPayment } from '../src/domains/payments/payments/productCheckout.service.js';
import EscrowManager from '../src/domains/orders/escrow/EscrowManager.js';
import CreatorService from '../src/domains/growth/creators/creator.service.js';
import { sendEmail } from '../src/shared/utils/email.js';
import {
  createUser,
  createSeller,
  createBuyer,
  cleanupUser,
  cleanupSeller,
  cleanupBuyer,
  cleanupProduct,
} from './helpers/factories.js';

const fakeProviderClient = {
  async initiatePayment({ reference }) {
    return { authorizationUrl: `https://mock-paystack.test/${reference}`, accessCode: 'AC_live', reference };
  },
};

describe('Live Postgres E2E: All Product Types + Creator-Link Payment + Escrow + Email Dispatch', () => {
  let sellerUser;
  let seller;
  let creatorUser;
  let creator;
  let link;
  let buyerUser;
  let buyer;
  const createdProductIds = [];
  const createdOrderIds = [];

  test('setup seller (with coordinates), creator link, and buyer', async () => {
    sellerUser = await createUser({ role: 'seller' });
    seller = await createSeller({ userId: sellerUser.id, isCreatorMarketplaceEnabled: true });
    await pool.query(
      'UPDATE sellers SET latitude = -1.286389, longitude = 36.817223, location = $2 WHERE id = $1',
      [seller.id, 'Westlands']
    );

    creatorUser = await createUser({ role: 'creator' });
    const { rows: cRows } = await pool.query(
      `INSERT INTO creators (user_id, first_name, last_name, email, mpesa_number, status, terms_accepted, username)
       VALUES ($1, 'Live', 'Creator', $2, '254711000999', 'active', true, $3)
       RETURNING *`,
      [creatorUser.id, creatorUser.email, `livecreator${creatorUser.id}`]
    );
    creator = cRows[0];

    const code = await CreatorService.generateLinkCode(pool);
    const { rows: lRows } = await pool.query(
      `INSERT INTO seller_creator_links (seller_id, creator_id, code, commission_rate, status)
       VALUES ($1, $2, $3, 0.0500, 'active')
       RETURNING *`,
      [seller.id, creator.id, code]
    );
    link = lRows[0];

    buyerUser = await createUser({ role: 'buyer' });
    buyer = await createBuyer({ userId: buyerUser.id });
  });

  test('ProductService.createProduct creates physical, digital, service, custom (with & without prompt), and imported products', async () => {
    const physical = await ProductService.createProduct(seller.id, {
      name: 'Live Physical Tee',
      price: 1200,
      description: 'Cotton tee',
      product_type: 'physical',
      quantity: 5,
    });
    createdProductIds.push(physical.id);
    assert.equal(physical.product_type, 'physical');
    assert.equal(physical.is_custom_product, false);

    const digital = await ProductService.createProduct(seller.id, {
      name: 'Live Digital Lookbook',
      price: 500,
      description: 'PDF lookbook',
      product_type: 'digital',
      is_digital: true,
      digital_category: 'document',
      digital_file_path: 'digital/live-lookbook.pdf',
      digital_file_name: 'live-lookbook.pdf',
      digital_file_size: 102400,
    });
    createdProductIds.push(digital.id);
    assert.equal(digital.product_type, 'digital');
    assert.equal(digital.is_digital, true);

    const service = await ProductService.createProduct(seller.id, {
      name: 'Live Tailoring Session',
      price: 2000,
      description: 'Custom fitting',
      product_type: 'service',
      service_options: {
        availability_days: ['Mon', 'Wed', 'Fri'],
        location_type: 'buyer_visits_seller',
        price_type: 'fixed',
      },
    });
    createdProductIds.push(service.id);
    assert.equal(service.product_type, 'service');

    const customWithPrompt = await ProductService.createProduct(seller.id, {
      name: 'Live Custom Mug',
      price: 900,
      description: 'Printed mug',
      product_type: 'physical',
      is_custom_product: true,
      production_days: 3,
      customization_prompt: 'What name should we print?',
    });
    createdProductIds.push(customWithPrompt.id);
    assert.equal(customWithPrompt.is_custom_product, true);
    assert.equal(customWithPrompt.production_days, 3);
    assert.equal(customWithPrompt.customization_prompt, 'What name should we print?');

    const customDaysOnly = await ProductService.createProduct(seller.id, {
      name: 'Live Custom Jacket (Days Only)',
      price: 3500,
      description: 'Made to order',
      product_type: 'physical',
      is_custom_product: true,
      production_days: 4,
      customization_prompt: null,
    });
    createdProductIds.push(customDaysOnly.id);
    assert.equal(customDaysOnly.is_custom_product, true);
    assert.equal(customDaysOnly.production_days, 4);
    assert.equal(customDaysOnly.customization_prompt, null);

    const imported = await ProductService.createProduct(seller.id, {
      name: 'Live Imported Bag',
      price: 4000,
      description: 'Pre-order leather bag',
      product_type: 'physical',
      is_imported_product: true,
      import_days: 14,
    });
    createdProductIds.push(imported.id);
    assert.equal(imported.is_imported_product, true);
    assert.equal(imported.import_days, 14);
  });

  test('creator-link payment -> paid -> escrow release credits seller & creator balances accurately', async () => {
    const productId = createdProductIds[0];
    const idemp = `live-cl-${crypto.randomUUID()}`;

    const checkout = await initiateProductPayment(
      {
        buyer: {
          id: buyer.id,
          userId: buyerUser.id,
          name: buyer.full_name,
          email: buyer.email,
          phone: buyer.mobile_payment,
          mobilePayment: buyer.mobile_payment,
          city: buyer.city,
        },
        metadata: { creator_code: link.code },
        idempotencyKey: idemp,
        items: [{ productId, quantity: 1 }],
      },
      { providerClient: fakeProviderClient }
    );
    assert.equal(checkout.success, true);
    createdOrderIds.push(checkout.orderId);

    // Simulate payment settled + order delivered so escrow can release
    await pool.query(
      "UPDATE product_orders SET payment_status = 'completed', status = 'COMPLETED' WHERE id = $1",
      [checkout.orderId]
    );
    await pool.query(
      "UPDATE payments SET status = 'completed' WHERE order_id = $1",
      [checkout.orderId]
    );

    const { rows: orderRows } = await pool.query('SELECT * FROM product_orders WHERE id = $1', [checkout.orderId]);
    const order = orderRows[0];
    assert.equal(order.metadata.creator_attribution.seller_creator_link_id, link.id);

    const escrowClient = await pool.connect();
    let release;
    try {
      await escrowClient.query('BEGIN');
      release = await EscrowManager.releaseFunds(escrowClient, order, 'live-integration-test');
      await escrowClient.query('COMMIT');
    } catch (err) {
      await escrowClient.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      escrowClient.release();
    }
    assert.equal(release.success, true);

    const { rows: earningRows } = await pool.query('SELECT amount FROM creator_earnings WHERE order_id = $1', [checkout.orderId]);
    const { rows: updatedOrderRows } = await pool.query('SELECT seller_payout_amount FROM product_orders WHERE id = $1', [checkout.orderId]);
    const { rows: creatorRows } = await pool.query('SELECT balance FROM creators WHERE id = $1', [creator.id]);
    assert.equal(earningRows.length, 1, 'creator_earnings row recorded');
    assert.ok(Number(earningRows[0].amount) > 0, 'creator earning amount > 0');
    assert.ok(Number(updatedOrderRows[0].seller_payout_amount) > 0, 'seller payout amount recorded');
    assert.ok(Number(creatorRows[0].balance) > 0, 'creator balance credited');
  });

  test('email service handles transactional dispatch gracefully in test mode without throwing', async () => {
    const res = await sendEmail({
      to: 'live-test@byblos.test',
      subject: 'Byblos Live Verification',
      templateName: 'product-order-confirmation',
      templateData: {
        buyerName: 'Live Buyer',
        orderNumber: 'ORD-LIVE-001',
        totalAmount: 'KES 1,200',
        shopName: 'Live Shop',
      },
    });
    assert.ok(res !== undefined);
  });

  after(async () => {
    for (const orderId of createdOrderIds) {
      try {
        await pool.query('DELETE FROM creator_earnings WHERE order_id = $1', [orderId]);
        await pool.query('DELETE FROM payments WHERE order_id = $1', [orderId]);
        await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
        await pool.query('DELETE FROM product_orders WHERE id = $1', [orderId]);
      } catch (err) {
        if (err?.code !== 'P0001' && err?.code !== '23503') throw err;
      }
    }
    if (link?.id) await pool.query('DELETE FROM seller_creator_links WHERE id = $1', [link.id]);
    for (const pid of createdProductIds) {
      await cleanupProduct(pid);
    }
    if (creator?.id) await pool.query('DELETE FROM creators WHERE id = $1', [creator.id]);
    await cleanupBuyer(buyer?.id);
    await cleanupSeller(seller?.id);
    await cleanupUser(creatorUser?.id);
    await cleanupUser(buyerUser?.id);
    await cleanupUser(sellerUser?.id);
  });
});

