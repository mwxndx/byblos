import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import * as sellerRepository from '../src/domains/commerce/sellers/seller.repository.js';
import { softDeleteSeller } from '../src/domains/commerce/sellers/seller.model.js';
import BuyerModel from '../src/domains/commerce/buyers/buyer.model.js';
import * as buyerRepository from '../src/domains/commerce/buyers/buyer.repository.js';
import AdminService from '../src/domains/identity/admin/admin.service.js';
import { CreatorService } from '../src/domains/growth/creators/creator.service.js';

describe('Deleted Users Rendering Diagnostics — Feedback Loop', () => {
  let testSellerId;
  let testSellerUserId;
  let testBuyerId;
  let testBuyerUserId;
  let testCreatorId;
  let testCreatorUserId;

  let testSellerId2;
  let testSellerUserId2;
  let testCreatorId2;
  let testCreatorUserId2;

  before(async () => {
    // 1. Create test seller 1
    const sellerEmail = `repro-seller-${Date.now()}@test.byblos`;
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, 'hash', 'seller', true) RETURNING id`,
      [sellerEmail]
    );
    testSellerUserId = userRes.rows[0].id;
    const sellerRes = await pool.query(
      `INSERT INTO sellers (user_id, full_name, email, shop_name, slug, is_active, status, terms_accepted)
       VALUES ($1, 'Repro Test Seller', $2, $3, $3, true, 'active', true) RETURNING id`,
      [testSellerUserId, sellerEmail, `repro-shop-${Date.now()}`]
    );
    testSellerId = sellerRes.rows[0].id;

    // 2. Create test buyer
    const buyerEmail = `repro-buyer-${Date.now()}@test.byblos`;
    const buyerUserRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, 'hash', 'buyer', true) RETURNING id`,
      [buyerEmail]
    );
    testBuyerUserId = buyerUserRes.rows[0].id;
    const buyerRes = await pool.query(
      `INSERT INTO buyers (user_id, full_name, email, mobile_payment, status, terms_accepted)
       VALUES ($1, 'Repro Test Buyer', $2, '0711002233', 'active', true) RETURNING id`,
      [testBuyerUserId, buyerEmail]
    );
    testBuyerId = buyerRes.rows[0].id;

    // 3. Create test creator 1
    const creatorEmail = `repro-creator-${Date.now()}@test.byblos`;
    const creatorUserRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, 'hash', 'creator', true) RETURNING id`,
      [creatorEmail]
    );
    testCreatorUserId = creatorUserRes.rows[0].id;
    const creatorRes = await pool.query(
      `INSERT INTO creators (user_id, first_name, last_name, email, mpesa_number, status, terms_accepted)
       VALUES ($1, 'Repro', 'Creator', $2, '0722003344', 'active', true) RETURNING id`,
      [testCreatorUserId, creatorEmail]
    );
    testCreatorId = creatorRes.rows[0].id;

    // Link creator 1 and seller 1
    await pool.query(
      `INSERT INTO seller_creator_links (seller_id, creator_id, code, commission_rate, status)
       VALUES ($1, $2, $3, 0.10, 'active')`,
      [testSellerId, testCreatorId, `code-${Date.now()}`]
    );

    // 4. Create test seller 2 and creator 2 to test deleteUser path
    const sellerEmail2 = `repro-seller2-${Date.now()}@test.byblos`;
    const userRes2 = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, 'hash', 'seller', true) RETURNING id`,
      [sellerEmail2]
    );
    testSellerUserId2 = userRes2.rows[0].id;
    const sellerRes2 = await pool.query(
      `INSERT INTO sellers (user_id, full_name, email, shop_name, slug, is_active, status, terms_accepted)
       VALUES ($1, 'Repro Test Seller 2', $2, $3, $3, true, 'active', true) RETURNING id`,
      [testSellerUserId2, sellerEmail2, `repro-shop2-${Date.now()}`]
    );
    testSellerId2 = sellerRes2.rows[0].id;

    const creatorEmail2 = `repro-creator2-${Date.now()}@test.byblos`;
    const creatorUserRes2 = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, 'hash', 'creator', true) RETURNING id`,
      [creatorEmail2]
    );
    testCreatorUserId2 = creatorUserRes2.rows[0].id;
    const creatorRes2 = await pool.query(
      `INSERT INTO creators (user_id, first_name, last_name, email, mpesa_number, status, terms_accepted)
       VALUES ($1, 'Repro2', 'Creator2', $2, '0722003355', 'active', true) RETURNING id`,
      [testCreatorUserId2, creatorEmail2]
    );
    testCreatorId2 = creatorRes2.rows[0].id;

    await pool.query(
      `INSERT INTO seller_creator_links (seller_id, creator_id, code, commission_rate, status)
       VALUES ($1, $2, $3, 0.10, 'active')`,
      [testSellerId2, testCreatorId2, `code2-${Date.now()}`]
    );
  });

  after(async () => {
    // Cleanup
    await pool.query('DELETE FROM seller_creator_links WHERE seller_id IN ($1, $2) OR creator_id IN ($3, $4)', [testSellerId, testSellerId2, testCreatorId, testCreatorId2]);
    await pool.query('DELETE FROM sellers WHERE id IN ($1, $2)', [testSellerId, testSellerId2]);
    await pool.query('DELETE FROM buyers WHERE id = $1', [testBuyerId]);
    await pool.query('DELETE FROM creators WHERE id IN ($1, $2)', [testCreatorId, testCreatorId2]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)', [testSellerUserId, testSellerUserId2, testBuyerUserId, testCreatorUserId, testCreatorUserId2]);
  });

  it('Symptom 1: Deleted seller is excluded from Buyer Dashboard (findActiveWithStats)', async () => {
    // Soft-delete seller 1
    await softDeleteSeller(testSellerId, testSellerUserId);

    // Call findActiveWithStats which supplies Buyer Dashboard SellersGrid
    const activeSellers = await sellerRepository.findActiveWithStats({ limit: 100, offset: 0 });
    const foundDeletedSeller = activeSellers.find(s => s.id === testSellerId);

    assert.equal(
      foundDeletedSeller,
      undefined,
      `Expected soft-deleted seller ${testSellerId} to be excluded from Buyer Dashboard findActiveWithStats`
    );
  });

  it('Symptom 2: Admin deleteUser on creator excludes creator from Seller Dashboard', async () => {
    // Admin deletes user who is a creator
    await AdminService.deleteUser(testCreatorUserId2);

    // Fetch seller creators dashboard for seller 2
    const sellerDashboard = await CreatorService.getSellerCreatorsDashboard(testSellerId2);
    const foundDeletedCreator = sellerDashboard.activeCreators.find(c => c.creatorId === testCreatorId2);

    assert.equal(
      foundDeletedCreator,
      undefined,
      `Expected deleted creator user ${testCreatorId2} to be excluded from Seller Dashboard activeCreators`
    );
  });

  it('Symptom 3: Admin deleteUser on seller excludes seller from Creator Dashboard', async () => {
    // Admin deletes user who is a seller
    await AdminService.deleteUser(testSellerUserId);

    // Fetch creator dashboard for creator 1
    const creatorDashboard = await CreatorService.getDashboard(testCreatorId);
    const foundDeletedSeller = creatorDashboard.shops.find(s => s.seller_id === testSellerId);

    assert.equal(
      foundDeletedSeller,
      undefined,
      `Expected deleted seller ${testSellerId} to be excluded from Creator Dashboard shops`
    );
  });

  it('Symptom 4: Soft-deleted buyer is excluded from active directory (findAllForAdmin)', async () => {
    // Soft-delete the buyer
    await BuyerModel.softDeleteAccount(testBuyerId, testBuyerUserId);

    const buyers = await buyerRepository.findAllForAdmin({ limit: 100, offset: 0 });
    const foundDeletedBuyer = buyers.find(b => b.id === testBuyerId);

    assert.equal(
      foundDeletedBuyer,
      undefined,
      `Expected soft-deleted buyer ${testBuyerId} to be excluded from active buyers directory`
    );
  });

  it('Symptom 5: Soft-deleted seller is excluded from active directory (getAllSellers)', async () => {
    const sellers = await AdminService.getAllSellers({ limit: 100, offset: 0 });
    const foundDeletedSeller = sellers.find(s => s.id === testSellerId2);
    // Soft-delete seller 2
    await softDeleteSeller(testSellerId2, testSellerUserId2);

    const sellersAfterDelete = await AdminService.getAllSellers({ limit: 100, offset: 0 });
    const foundDeletedSellerAfter = sellersAfterDelete.find(s => s.id === testSellerId2);

    assert.equal(
      foundDeletedSellerAfter,
      undefined,
      `Expected soft-deleted seller ${testSellerId2} to be excluded from active sellers directory`
    );
  });
});
