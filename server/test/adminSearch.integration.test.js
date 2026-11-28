import test, { describe, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool } from '../src/infrastructure/database/database.js';
import AdminService from '../src/domains/identity/admin/admin.service.js';
import * as buyerRepository from '../src/domains/commerce/buyers/buyer.repository.js';
import * as withdrawalRequestRepository from '../src/domains/payments/withdrawals/withdrawalRequest.repository.js';
import {
  createUser,
  createSeller,
  createBuyer,
  cleanupUser,
  cleanupSeller,
  cleanupBuyer,
} from './helpers/factories.js';

describe('Admin directory search queries (sellers, creators, buyers, withdrawals)', () => {
  let sellerUser;
  let seller;
  let buyerUser;
  let buyer;
  let creatorUser;
  let creator;
  let withdrawalId;
  const uniqueTag = crypto.randomUUID().slice(0, 8);

  test('setup fixtures', async () => {
    sellerUser = await createUser({ role: 'seller', email: `searchseller-${uniqueTag}@byblos.test` });
    seller = await createSeller({ userId: sellerUser.id, shopName: `SearchShop-${uniqueTag}` });
    await pool.query('UPDATE sellers SET shop_name = $2, email = $3 WHERE id = $1', [seller.id, `SearchShop-${uniqueTag}`, sellerUser.email]);
    buyerUser = await createUser({ role: 'buyer', email: `searchbuyer-${uniqueTag}@byblos.test` });
    buyer = await createBuyer({ userId: buyerUser.id, fullName: `SearchBuyer ${uniqueTag}` });
    await pool.query('UPDATE buyers SET full_name = $2 WHERE id = $1', [buyer.id, `SearchBuyer ${uniqueTag}`]);

    creatorUser = await createUser({ role: 'creator', email: `searchcreator-${uniqueTag}@byblos.test` });
    const { rows: cRows } = await pool.query(
      `INSERT INTO creators (user_id, first_name, last_name, email, mpesa_number, status, terms_accepted, username)
       VALUES ($1, $2, 'Tester', $3, '254700888999', 'active', true, $4)
       RETURNING *`,
      [creatorUser.id, `SearchCreator${uniqueTag}`, creatorUser.email, `sc${uniqueTag}`]
    );
    creator = cRows[0];

    const { rows: wRows } = await pool.query(
      `INSERT INTO withdrawal_requests (seller_id, amount, mpesa_number, mpesa_name, status, provider_reference, idempotency_key)
       VALUES ($1, 500, '254700111999', 'Search Seller', 'manual_review', $2, $3)
       RETURNING id`,
      [seller.id, `WD-SEARCH-${uniqueTag}`, `wd-idemp-${uniqueTag}`]
    );
    withdrawalId = wRows[0].id;
  });

  test('getAllSellers searches by shop_name, full_name, and email', async () => {
    const byShop = await AdminService.getAllSellers({ limit: 25, offset: 0, search: `SearchShop-${uniqueTag}` });
    assert.equal(byShop.length, 1);
    assert.equal(byShop[0].id, seller.id);

    const byEmail = await AdminService.getAllSellers({ limit: 25, offset: 0, search: `searchseller-${uniqueTag}` });
    assert.equal(byEmail.length, 1);
  });

  test('getAllCreators searches by name and email', async () => {
    const rows = await AdminService.getAllCreators({ limit: 25, offset: 0, search: `SearchCreator${uniqueTag}` });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, creator.id);
  });

  test('buyerRepository.findAllForAdmin searches by full_name and email', async () => {
    const rows = await buyerRepository.findAllForAdmin({ limit: 25, offset: 0, search: `SearchBuyer ${uniqueTag}` });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, buyer.id);
  });

  test('withdrawalRequestRepository.findAllWithSeller searches by seller shop/name/email', async () => {
    const rows = await withdrawalRequestRepository.findAllWithSeller({ limit: 25, offset: 0, search: `SearchShop-${uniqueTag}` });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, withdrawalId);
  });

  after(async () => {
    if (withdrawalId) await pool.query('DELETE FROM withdrawal_requests WHERE id = $1', [withdrawalId]);
    if (creator?.id) await pool.query('DELETE FROM creators WHERE id = $1', [creator.id]);
    await cleanupBuyer(buyer?.id);
    await cleanupSeller(seller?.id);
    await cleanupUser(creatorUser?.id);
    await cleanupUser(buyerUser?.id);
    await cleanupUser(sellerUser?.id);
  });
});
