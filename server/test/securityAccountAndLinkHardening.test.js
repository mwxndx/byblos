import test, { describe, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool } from '../src/infrastructure/database/database.js';
import { initiateProductPayment } from '../src/domains/payments/payments/productCheckout.service.js';
import CreatorService from '../src/domains/growth/creators/creator.service.js';
import { bootstrapPrivilegedAccountIfConfigured } from '../src/domains/identity/auth/bootstrapPrivilegedAccounts.js';
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

describe('Security hardening: creator links & singleton/privileged accounts', () => {
  let sellerUser;
  let seller;
  let creatorUser;
  let creator;
  let buyerUser;
  let buyer;
  let product;
  const createdOrderIds = [];
  const createdUserIds = [];

  test('setup fixtures', async () => {
    sellerUser = await createUser({ role: 'seller' });
    seller = await createSeller({ userId: sellerUser.id, isCreatorMarketplaceEnabled: true });
    creatorUser = await createUser({ role: 'creator' });
    const { rows: cRows } = await pool.query(
      `INSERT INTO creators (user_id, first_name, last_name, email, mpesa_number, status, terms_accepted, username)
       VALUES ($1, 'Sec', 'Creator', $2, '254700111222', 'active', true, $3)
       RETURNING *`,
      [creatorUser.id, creatorUser.email, `seccreator${creatorUser.id}`]
    );
    creator = cRows[0];
    buyerUser = await createUser({ role: 'buyer' });
    buyer = await createBuyer({ userId: buyerUser.id });
    product = await createProduct({ sellerId: seller.id, name: 'Sec Product', price: 1000, productType: 'physical' });
  });

  test('strips client-supplied metadata.creator_attribution during checkout', async () => {
    const idemp = token('spoof-attr');
    const result = await initiateProductPayment(
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
        metadata: {
          creator_attribution: {
            creator_id: creator.id,
            seller_creator_link_id: 999999,
            commission_amount: 500,
            commission_rate: 0.5,
            commission_base_amount: 1000,
          },
        },
        idempotencyKey: idemp,
        items: [{ productId: product.id, quantity: 1 }],
      },
      { providerClient: fakeProviderClient }
    );
    assert.equal(result.success, true);
    createdOrderIds.push(result.orderId);

    const { rows } = await pool.query('SELECT metadata FROM product_orders WHERE id = $1', [result.orderId]);
    const meta = rows[0].metadata;
    assert.equal(meta.creator_attribution ?? null, null);
    assert.equal(meta.pricing.creator_commission, 0);
  });

  test('creditCreatorForOrder rejects forged creator_attribution with non-existent seller_creator_links row', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const credited = await CreatorService.creditCreatorForOrder(client, {
        order: {
          id: createdOrderIds[0],
          seller_id: seller.id,
          buyer_id: buyer.id,
          total_amount: 1000,
          metadata: {
            creator_attribution: {
              creator_id: creator.id,
              seller_creator_link_id: 999999,
              commission_amount: 50,
              commission_rate: 0.05,
              commission_base_amount: 1000,
            },
          },
        },
        paymentId: null,
      });
      assert.equal(credited, null);
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  });

  test('DB enforces singleton marketing and logistics (mzigo) accounts', async () => {
    const mktEmail1 = `mkt1-${crypto.randomUUID()}@byblos.test`;
    const mktEmail2 = `mkt2-${crypto.randomUUID()}@byblos.test`;
    const logEmail1 = `log1-${crypto.randomUUID()}@byblos.test`;
    const logEmail2 = `log2-${crypto.randomUUID()}@byblos.test`;

    await pool.query(
      "INSERT INTO roles (name, slug) VALUES ('Marketing', 'marketing'), ('Logistics', 'logistics') ON CONFLICT (slug) DO NOTHING"
    );

    // Clean any pre-existing singleton rows in test DB first, then restore nothing (test DB)
    const existingMkt = await pool.query("SELECT id FROM users WHERE role = 'marketing'");
    const existingLog = await pool.query("SELECT id FROM users WHERE role = 'logistics'");

    if (existingMkt.rows.length === 0) {
      const r1 = await pool.query(
        "INSERT INTO users (email, password_hash, role, is_verified, is_active) VALUES ($1, 'hash', 'marketing', true, true) RETURNING id",
        [mktEmail1]
      );
      createdUserIds.push(r1.rows[0].id);
    }

    await assert.rejects(
      pool.query(
        "INSERT INTO users (email, password_hash, role, is_verified, is_active) VALUES ($1, 'hash', 'marketing', true, true)",
        [mktEmail2]
      ),
      (err) => err.code === '23505'
    );

    if (existingLog.rows.length === 0) {
      const l1 = await pool.query(
        "INSERT INTO users (email, password_hash, role, is_verified, is_active) VALUES ($1, 'hash', 'logistics', true, true) RETURNING id",
        [logEmail1]
      );
      createdUserIds.push(l1.rows[0].id);
    }

    await assert.rejects(
      pool.query(
        "INSERT INTO users (email, password_hash, role, is_verified, is_active) VALUES ($1, 'hash', 'logistics', true, true)",
        [logEmail2]
      ),
      (err) => err.code === '23505'
    );
  });

  test('bootstrapPrivilegedAccountIfConfigured refuses to overwrite an existing buyer role', async () => {
    const prevEmail = process.env.ADMIN_EMAIL;
    const prevPass = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_EMAIL = buyerUser.email;
    process.env.ADMIN_PASSWORD = 'StrongTestPassword#123';
    try {
      await assert.rejects(
        bootstrapPrivilegedAccountIfConfigured(buyerUser.email.toLowerCase(), 'StrongTestPassword#123'),
        /already used by another account/i
      );
      const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [buyerUser.id]);
      assert.equal(rows[0].role, 'buyer');
    } finally {
      if (prevEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = prevEmail;
      if (prevPass === undefined) delete process.env.ADMIN_PASSWORD;
      else process.env.ADMIN_PASSWORD = prevPass;
    }
  });

  after(async () => {
    for (const orderId of createdOrderIds) {
      await pool.query('DELETE FROM payments WHERE order_id = $1', [orderId]);
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      await pool.query('DELETE FROM product_orders WHERE id = $1', [orderId]);
    }
    for (const uid of createdUserIds) {
      await cleanupUser(uid);
    }
    await cleanupProduct(product?.id);
    if (creator?.id) await pool.query('DELETE FROM creators WHERE id = $1', [creator.id]);
    await cleanupBuyer(buyer?.id);
    await cleanupSeller(seller?.id);
    await cleanupUser(creatorUser?.id);
    await cleanupUser(buyerUser?.id);
    await cleanupUser(sellerUser?.id);
  });
});
