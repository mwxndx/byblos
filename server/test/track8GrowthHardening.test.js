import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import CreatorService from '../src/domains/growth/creators/creator.service.js';
import ReferralService from '../src/domains/growth/referrals/referral.service.js';
import EscrowManager from '../src/domains/orders/escrow/EscrowManager.js';
import Fees from '../src/shared/config/fees.js';
import {
  createUser,
  createCreator,
  createSeller,
  createBuyer,
  createSellerCreatorLink,
  createCompletedOrder,
  cleanupSeller,
  cleanupCreator,
  cleanupBuyer,
  cleanupOrder
} from './helpers/factories.js';

describe('Track 8 Growth Hardening: Creator Referrals & Creator Mode Lifecycle', () => {
  const sellerIds = [];
  const creatorIds = [];
  const buyerIds = [];
  const orderIds = [];

  after(async () => {
    for (const orderId of orderIds) {
      await cleanupOrder(orderId).catch(() => {});
    }
    for (const creatorId of creatorIds) {
      await cleanupCreator(creatorId).catch(() => {});
    }
    for (const sellerId of sellerIds) {
      await cleanupSeller(sellerId).catch(() => {});
    }
    for (const buyerId of buyerIds) {
      await cleanupBuyer(buyerId).catch(() => {});
    }
  });

  test('8.1: registration referral attribution accepts only creator codes (CR...) and rejects legacy seller codes (BY...)', async () => {
    const creator = await createCreator({});
    creatorIds.push(creator.id);
    const seller = await createSeller({});
    sellerIds.push(seller.id);

    // Set a known creator referral code
    const creatorRefCode = `CRTEST${Date.now()}`;
    await pool.query('UPDATE creators SET referral_code = $1 WHERE id = $2', [creatorRefCode, creator.id]);

    const newSeller1 = await createSeller({});
    sellerIds.push(newSeller1.id);
    const newSeller2 = await createSeller({});
    sellerIds.push(newSeller2.id);

    // 1. Creator code attributes successfully
    const crResult = await ReferralService.applyReferral(newSeller1.id, creatorRefCode);
    assert.ok(crResult, 'Creator referral code must attribute');
    assert.equal(crResult.referrerCreatorId, creator.id);

    const { rows: s1Rows } = await pool.query('SELECT referred_by_creator_id FROM sellers WHERE id = $1', [newSeller1.id]);
    assert.equal(s1Rows[0].referred_by_creator_id, creator.id);

    // 2. Legacy BY... seller referral code is rejected
    const byResult = await ReferralService.applyReferral(newSeller2.id, 'BY123456');
    assert.equal(byResult, null, 'Seller-to-seller code must return null');

    const { rows: s2Rows } = await pool.query('SELECT referred_by_seller_id, referred_by_creator_id FROM sellers WHERE id = $1', [newSeller2.id]);
    assert.equal(s2Rows[0].referred_by_seller_id, null);
    assert.equal(s2Rows[0].referred_by_creator_id, null);

    // 3. Generating seller referral code throws 410
    await assert.rejects(
      async () => ReferralService.generateReferralCode(newSeller2.id),
      (err) => {
        assert.equal(err.statusCode, 410);
        assert.match(err.message, /discontinued/i);
        return true;
      }
    );
  });

  test('8.2: invited seller earns creator flat KES 3 on sales without needing a creator link', async () => {
    const creatorUser = await createUser({});
    const creator = await createCreator({ userId: creatorUser.id });
    creatorIds.push(creator.id);

    const sellerUser = await createUser({});
    const seller = await createSeller({ userId: sellerUser.id, isCreatorMarketplaceEnabled: true });
    sellerIds.push(seller.id);

    // Mark seller as invited by this creator
    await pool.query('UPDATE sellers SET referred_by_creator_id = $1 WHERE id = $2', [creator.id, seller.id]);

    const buyerUser = await createUser({});
    const buyer = await createBuyer({ userId: buyerUser.id });
    buyerIds.push(buyer.id);

    // Completed order with NO creator attribution link
    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 940,
      platformFeeAmount: 10,
      totalQuantity: 2,
      metadata: {} // No creator link!
    });
    orderIds.push(order.id);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await EscrowManager.releaseFunds(client, order, 'test-suite');
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Verify creator referral earnings record
    const { rows: refEarnings } = await pool.query(
      'SELECT amount, referrer_creator_id, referred_seller_id FROM creator_referral_earnings WHERE order_id = $1',
      [order.id]
    );
    assert.equal(refEarnings.length, 1);
    assert.equal(Number(refEarnings[0].amount), 3.00, 'Flat KES 3 referral reward credited');
    assert.equal(refEarnings[0].referrer_creator_id, creator.id);
    assert.equal(refEarnings[0].referred_seller_id, seller.id);

    // Verify creator's balance incremented by 3.00
    const { rows: cRows } = await pool.query('SELECT balance, total_referral_earnings FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(cRows[0].balance), 3.00);
    assert.equal(Number(cRows[0].total_referral_earnings), 3.00);
  });

  test('8.3: order made WITH creator collaboration link on invited seller grants BOTH percentage commission AND flat KES 3 referral reward', async () => {
    const creatorUser = await createUser({});
    const creator = await createCreator({ userId: creatorUser.id });
    creatorIds.push(creator.id);

    const sellerUser = await createUser({});
    const seller = await createSeller({ userId: sellerUser.id, isCreatorMarketplaceEnabled: true });
    sellerIds.push(seller.id);

    // Creator invited the seller
    await pool.query('UPDATE sellers SET referred_by_creator_id = $1 WHERE id = $2', [creator.id, seller.id]);

    // Creator also collaborates with the seller via seller_creator_links
    const link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id, commissionRate: 0.10 });

    const buyerUser = await createUser({});
    const buyer = await createBuyer({ userId: buyerUser.id });
    buyerIds.push(buyer.id);

    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 890,
      platformFeeAmount: 10,
      totalQuantity: 1,
      metadata: {
        creator_attribution: {
          creator_id: creator.id,
          seller_creator_link_id: link.id,
          seller_id: seller.id,
          commission_rate: 0.10,
          commission_base_amount: 1000,
          commission_amount: 100
        }
      }
    });
    orderIds.push(order.id);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await EscrowManager.releaseFunds(client, order, 'test-suite');
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Collaboration commission (10% = 100)
    const { rows: salesEarnings } = await pool.query(
      'SELECT amount, status FROM creator_earnings WHERE order_id = $1',
      [order.id]
    );
    assert.equal(salesEarnings.length, 1);
    assert.equal(Number(salesEarnings[0].amount), 100);

    // Referral reward (flat 3)
    const { rows: refEarnings } = await pool.query(
      'SELECT amount FROM creator_referral_earnings WHERE order_id = $1',
      [order.id]
    );
    assert.equal(refEarnings.length, 1);
    assert.equal(Number(refEarnings[0].amount), 3.00);

    // Total balance = 100 + 3 = 103
    const { rows: cRows } = await pool.query('SELECT balance FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(cRows[0].balance), 103.00);
  });

  test('8.4: seller switches off creator mode -> links paused, code null in dashboard, clicks report sellerCreatorModeOff', async () => {
    const creatorUser = await createUser({});
    const creator = await createCreator({ userId: creatorUser.id });
    creatorIds.push(creator.id);

    const sellerUser = await createUser({});
    const seller = await createSeller({ userId: sellerUser.id, isCreatorMarketplaceEnabled: true });
    sellerIds.push(seller.id);

    const link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id, commissionRate: 0.05 });

    // Sanity check: link is active
    let clickResult = await CreatorService.recordLinkClick({ code: link.code, ipAddress: '127.0.0.1' });
    assert.equal(clickResult.active, true);
    assert.equal(clickResult.sellerCreatorModeOff, false);

    // Seller switches off creator mode
    const updated = await CreatorService.updateSellerCreatorListing(seller.id, { isCreatorMarketplaceEnabled: false });
    assert.equal(updated.isCreatorMarketplaceEnabled, false);

    // 1. Link status is now 'paused'
    const { rows: linkRows } = await pool.query('SELECT status FROM seller_creator_links WHERE id = $1', [link.id]);
    assert.equal(linkRows[0].status, 'paused');

    // 2. Creator dashboard nullifies code and shopUrl
    const dashboard = await CreatorService.getDashboard(creator.id);
    const shopInDashboard = dashboard.shops.find((s) => s.id === link.id);
    assert.ok(shopInDashboard);
    assert.equal(shopInDashboard.status, 'paused');
    assert.equal(shopInDashboard.code, null);
    assert.equal(shopInDashboard.shopUrl, null);
    assert.equal(shopInDashboard.sellerCreatorModeOff, true);

    // 3. Buyer clicks paused link -> sellerCreatorModeOff: true, click count NOT incremented
    const clickOffResult = await CreatorService.recordLinkClick({ code: link.code, ipAddress: '127.0.0.1' });
    assert.equal(clickOffResult.active, false);
    assert.equal(clickOffResult.sellerCreatorModeOff, true);
    assert.match(clickOffResult.message, /switched off creator mode/i);

    const { rows: clickCountRows } = await pool.query('SELECT click_count FROM seller_creator_links WHERE id = $1', [link.id]);
    assert.equal(clickCountRows[0].click_count, 1, 'Click count must not increment while paused');

    // 4. resolveAttribution returns null
    const attribution = await CreatorService.resolveAttribution({
      code: link.code,
      sellerId: seller.id,
      productSubtotal: 500,
      buyer: { email: 'buyer@test.byblos.local' }
    });
    assert.equal(attribution, null, 'Attribution must be rejected while creator mode is off');

    // 5. Seller switches creator mode back ON -> links restored
    const restored = await CreatorService.updateSellerCreatorListing(seller.id, { isCreatorMarketplaceEnabled: true });
    assert.equal(restored.isCreatorMarketplaceEnabled, true);

    const { rows: restoredLinkRows } = await pool.query('SELECT status FROM seller_creator_links WHERE id = $1', [link.id]);
    assert.equal(restoredLinkRows[0].status, 'active');

    const clickOnResult = await CreatorService.recordLinkClick({ code: link.code, ipAddress: '127.0.0.1' });
    assert.equal(clickOnResult.active, true);
    assert.equal(clickOnResult.sellerCreatorModeOff, false);
  });
});
