import test, { describe, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool } from '../src/infrastructure/database/database.js';
import { initiateProductPayment } from '../src/domains/payments/payments/productCheckout.service.js';
import { resolveCustomProductionPatch } from '../src/domains/payments/payments/paymentOrderCompletionHelper.js';
import { AppError } from '../src/shared/utils/errorHandler.js';
import {
  createUser,
  createSeller,
  createBuyer,
  createProduct,
  cleanupUser,
  cleanupSeller,
  cleanupBuyer,
  cleanupProduct,
} from './helpers/factories.js';

const fakeProviderClient = {
  async initiatePayment({ reference }) {
    return { authorizationUrl: `https://mock-paystack.test/${reference}`, accessCode: 'AC_test', reference };
  },
};

const token = (prefix) => `${prefix}-${crypto.randomUUID()}`;

describe('Live Postgres integration: custom orders (with & without prompt) and imported products', () => {
  let sellerUser;
  let seller;
  let creatorUser;
  let creator;
  let link;
  let buyerUser;
  let buyer;
  let customWithPrompt;
  let customDaysOnly;
  let importedProduct;
  let regularProduct;
  const createdOrderIds = [];

  const makeBuyer = () => ({
    id: buyer.id,
    userId: buyerUser.id,
    name: buyer.full_name,
    email: buyer.email,
    phone: buyer.mobile_payment,
    mobilePayment: buyer.mobile_payment,
    city: buyer.city,
  });

  test('setup seller, creator link, buyer, custom (with & without prompt), imported, and physical products', async () => {
    sellerUser = await createUser({ role: 'seller' });
    seller = await createSeller({ userId: sellerUser.id, isCreatorMarketplaceEnabled: true });
    buyerUser = await createUser({ role: 'buyer' });
    buyer = await createBuyer({ userId: buyerUser.id });

    creatorUser = await createUser({ role: 'creator' });
    const { rows: cRows } = await pool.query(
      `INSERT INTO creators (user_id, first_name, last_name, email, mpesa_number, status, terms_accepted, username)
       VALUES ($1, 'Custom', 'Creator', $2, '254700333444', 'active', true, $3)
       RETURNING *`,
      [creatorUser.id, creatorUser.email, `customcreator${creatorUser.id}`]
    );
    creator = cRows[0];

    const { rows: lRows } = await pool.query(
      `INSERT INTO seller_creator_links (seller_id, creator_id, code, commission_rate, status)
       VALUES ($1, $2, $3, 0.0500, 'active')
       RETURNING *`,
      [seller.id, creator.id, `CTEST${creator.id}`]
    );
    link = lRows[0];

    regularProduct = await createProduct({ sellerId: seller.id, name: 'Regular Item', price: 500, productType: 'physical' });

    const { rows: p1 } = await pool.query(
      `INSERT INTO products (seller_id, name, price, product_type, is_digital, track_inventory, is_custom_product, production_days, customization_prompt)
       VALUES ($1, 'Custom Engraved Ring', 1500, 'physical', false, false, true, 4, 'What initials should we engrave?')
       RETURNING *`,
      [seller.id]
    );
    customWithPrompt = p1[0];

    const { rows: p2 } = await pool.query(
      `INSERT INTO products (seller_id, name, price, product_type, is_digital, track_inventory, is_custom_product, production_days, customization_prompt)
       VALUES ($1, 'Made-to-Order Jacket', 2500, 'physical', false, false, true, 3, NULL)
       RETURNING *`,
      [seller.id]
    );
    customDaysOnly = p2[0];

    const { rows: p3 } = await pool.query(
      `INSERT INTO products (seller_id, name, price, product_type, is_digital, track_inventory, is_custom_product, is_imported_product, import_days, import_note)
       VALUES ($1, 'Imported Leather Bag', 3000, 'physical', false, false, false, true, 14, 'Imported item. Delivery starts after seller handoff.')
       RETURNING *`,
      [seller.id]
    );
    importedProduct = p3[0];
  });

  test('custom product WITH prompt: rejects missing instructions, succeeds with instructions + hub collection + deadline', async () => {
    const failTok = token('custom-prompt-miss');
    await assert.rejects(
      initiateProductPayment(
        { buyer: makeBuyer(), metadata: {}, idempotencyKey: failTok, items: [{ productId: customWithPrompt.id, quantity: 1 }] },
        { providerClient: fakeProviderClient }
      ),
      (err) => err instanceof AppError && err.statusCode === 400
    );

    const okTok = token('custom-prompt-ok');
    const res = await initiateProductPayment(
      {
        buyer: makeBuyer(),
        metadata: { customization_instructions: 'Initials: A.B.', creator_code: link.code },
        idempotencyKey: okTok,
        items: [{ productId: customWithPrompt.id, quantity: 1 }],
      },
      { providerClient: fakeProviderClient }
    );
    assert.equal(res.success, true);
    createdOrderIds.push(res.orderId);

    const { rows } = await pool.query('SELECT metadata, total_amount FROM product_orders WHERE id = $1', [res.orderId]);
    const meta = rows[0].metadata;
    assert.equal(meta.pre_handoff_sla.type, 'custom_production');
    assert.equal(meta.pre_handoff_sla.production_days, 4);
    assert.equal(meta.pre_handoff_sla.customization_prompt, 'What initials should we engrave?');
    assert.equal(meta.pre_handoff_sla.buyer_instructions, 'Initials: A.B.');
    assert.equal(meta.creator_attribution.seller_creator_link_id, link.id);
    assert.equal(meta.pricing.buyer_collection_fee, 100);

    const paidAt = new Date('2026-11-27T12:00:00.000Z');
    const patch = resolveCustomProductionPatch({ metadata: meta }, paidAt);
    assert.equal(patch.productionDeadline.toISOString(), '2026-12-01T12:00:00.000Z');
    assert.equal(patch.graceDeadline.toISOString(), '2026-12-02T12:00:00.000Z');
  });

  test('custom product WITHOUT prompt (production_days only): succeeds without instructions and computes SLA deadline', async () => {
    const okTok = token('custom-days-only');
    const res = await initiateProductPayment(
      {
        buyer: makeBuyer(),
        location: { lat: -1.267, lng: 36.811, address: 'Westlands, Nairobi' },
        metadata: {
          delivery: {
            doorDelivery: true,
            address: 'Westlands, Nairobi',
            lat: -1.267,
            lng: 36.811,
            quote: { feeAmount: 250, distanceKm: 4, chargeableDistanceKm: 4, rateKesPerKm: 50, totalAmount: 250 },
          },
        },
        idempotencyKey: okTok,
        items: [{ productId: customDaysOnly.id, quantity: 1 }],
      },
      { providerClient: fakeProviderClient }
    );
    assert.equal(res.success, true);
    createdOrderIds.push(res.orderId);

    const { rows } = await pool.query('SELECT metadata FROM product_orders WHERE id = $1', [res.orderId]);
    const meta = rows[0].metadata;
    assert.equal(meta.pre_handoff_sla.type, 'custom_production');
    assert.equal(meta.pre_handoff_sla.production_days, 3);
    assert.equal(meta.pre_handoff_sla.customization_prompt, null);
    assert.equal(meta.pre_handoff_sla.buyer_instructions, null);
    assert.equal(meta.pricing.buyer_collection_fee, 0);
    assert.ok(meta.pricing.buyer_delivery_fee > 0);

    const paidAt = new Date('2026-11-27T12:00:00.000Z');
    const patch = resolveCustomProductionPatch({ metadata: meta }, paidAt);
    assert.equal(patch.productionDeadline.toISOString(), '2026-11-30T12:00:00.000Z');
  });

  test('imported product: succeeds solo, sets import_waiting SLA, computes 14-day deadline, and blocks multi-item bag', async () => {
    const mixTok = token('import-mix');
    await assert.rejects(
      initiateProductPayment(
        {
          buyer: makeBuyer(),
          metadata: {},
          idempotencyKey: mixTok,
          items: [
            { productId: regularProduct.id, quantity: 1 },
            { productId: importedProduct.id, quantity: 1 },
          ],
        },
        { providerClient: fakeProviderClient }
      ),
      (err) => err instanceof AppError && err.statusCode === 400 && /Custom and imported products must be bought on their own/.test(err.message)
    );

    const okTok = token('import-solo');
    const res = await initiateProductPayment(
      {
        buyer: makeBuyer(),
        metadata: {},
        idempotencyKey: okTok,
        items: [{ productId: importedProduct.id, quantity: 1 }],
      },
      { providerClient: fakeProviderClient }
    );
    assert.equal(res.success, true);
    createdOrderIds.push(res.orderId);

    const { rows } = await pool.query('SELECT metadata FROM product_orders WHERE id = $1', [res.orderId]);
    const meta = rows[0].metadata;
    assert.equal(meta.pre_handoff_sla.type, 'import_waiting');
    assert.equal(meta.pre_handoff_sla.import_days, 14);
    assert.equal(meta.custom_product, null);

    const paidAt = new Date('2026-11-27T12:00:00.000Z');
    const patch = resolveCustomProductionPatch({ metadata: meta }, paidAt);
    assert.equal(patch.productionDeadline.toISOString(), '2026-12-11T12:00:00.000Z');
  });

  after(async () => {
    for (const orderId of createdOrderIds) {
      try {
        await pool.query('DELETE FROM logistics_tracking_events WHERE logistics_request_id IN (SELECT id FROM logistics_requests WHERE order_id = $1)', [orderId]);
        await pool.query('DELETE FROM logistics_legs WHERE logistics_request_id IN (SELECT id FROM logistics_requests WHERE order_id = $1)', [orderId]);
        await pool.query('DELETE FROM logistics_requests WHERE order_id = $1', [orderId]);
        await pool.query('DELETE FROM payments WHERE order_id = $1', [orderId]);
        await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
        await pool.query('DELETE FROM product_orders WHERE id = $1', [orderId]);
      } catch (err) {
        if (err?.code !== 'P0001' && err?.code !== '23503') throw err;
      }
    }
    if (link?.id) await pool.query('DELETE FROM seller_creator_links WHERE id = $1', [link.id]);
    await cleanupProduct(customWithPrompt?.id);
    await cleanupProduct(customDaysOnly?.id);
    await cleanupProduct(importedProduct?.id);
    await cleanupProduct(regularProduct?.id);
    if (creator?.id) await pool.query('DELETE FROM creators WHERE id = $1', [creator.id]);
    await cleanupBuyer(buyer?.id);
    await cleanupSeller(seller?.id);
    await cleanupUser(creatorUser?.id);
    await cleanupUser(buyerUser?.id);
    await cleanupUser(sellerUser?.id);
  });
});
