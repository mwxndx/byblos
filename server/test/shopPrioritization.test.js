import test from 'node:test';
import assert from 'node:assert/strict';
import { findActiveWithStats } from '../src/domains/commerce/sellers/seller.repository.js';
import { pool } from '../src/infrastructure/database/database.js';

test('Shop Prioritization Algorithm (findActiveWithStats)', async (t) => {
  const uniquePrefix = `prio_${Date.now().toString(36)}_`;

  // Create test users for FK
  const user1 = (await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, 'hash', 'seller') RETURNING id",
    [`${uniquePrefix}1@test.com`]
  )).rows[0];
  const user2 = (await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, 'hash', 'seller') RETURNING id",
    [`${uniquePrefix}2@test.com`]
  )).rows[0];
  const user3 = (await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, 'hash', 'seller') RETURNING id",
    [`${uniquePrefix}3@test.com`]
  )).rows[0];
  const user4 = (await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, 'hash', 'seller') RETURNING id",
    [`${uniquePrefix}4@test.com`]
  )).rows[0];

  // 1. Seller Incomplete (no photo, no socials)
  const sellerIncomplete = (await pool.query(
    `INSERT INTO sellers (user_id, full_name, shop_name, email, avatar_url, instagram_link, tiktok_link, is_active)
     VALUES ($1, 'Incomplete Seller', $2, $3, NULL, NULL, NULL, true) RETURNING id`,
    [user1.id, `${uniquePrefix}Incomplete`, `${uniquePrefix}1@test.com`]
  )).rows[0];

  // 2. Seller Photo Only
  const sellerPhotoOnly = (await pool.query(
    `INSERT INTO sellers (user_id, full_name, shop_name, email, avatar_url, instagram_link, tiktok_link, is_active)
     VALUES ($1, 'Photo Only Seller', $2, $3, 'https://example.com/photo.jpg', NULL, NULL, true) RETURNING id`,
    [user2.id, `${uniquePrefix}PhotoOnly`, `${uniquePrefix}2@test.com`]
  )).rows[0];

  // 3. Seller Photo + Instagram
  const sellerPhotoIg = (await pool.query(
    `INSERT INTO sellers (user_id, full_name, shop_name, email, avatar_url, instagram_link, tiktok_link, is_active)
     VALUES ($1, 'Photo IG Seller', $2, $3, 'https://example.com/photo.jpg', 'my_ig', NULL, true) RETURNING id`,
    [user3.id, `${uniquePrefix}PhotoIg`, `${uniquePrefix}3@test.com`]
  )).rows[0];

  // 4. Seller Complete: Photo + Instagram + TikTok
  const sellerComplete = (await pool.query(
    `INSERT INTO sellers (user_id, full_name, shop_name, email, avatar_url, instagram_link, tiktok_link, is_active)
     VALUES ($1, 'Complete Seller', $2, $3, 'https://example.com/photo.jpg', 'my_ig', 'my_tiktok', true) RETURNING id`,
    [user4.id, `${uniquePrefix}Complete`, `${uniquePrefix}4@test.com`]
  )).rows[0];

  try {
    await t.test('orders shops with business photo, instagram, and tiktok as first', async () => {
      const rows = await findActiveWithStats({ limit: 100, offset: 0 });
      const testIds = [sellerComplete.id, sellerPhotoIg.id, sellerPhotoOnly.id, sellerIncomplete.id];
      const matchingRows = rows.filter(r => testIds.includes(r.id));

      assert.equal(matchingRows.length, 4, 'All test sellers should be returned');

      // Index of each in the results
      const indexComplete = matchingRows.findIndex(r => r.id === sellerComplete.id);
      const indexPhotoIg = matchingRows.findIndex(r => r.id === sellerPhotoIg.id);
      const indexPhotoOnly = matchingRows.findIndex(r => r.id === sellerPhotoOnly.id);
      const indexIncomplete = matchingRows.findIndex(r => r.id === sellerIncomplete.id);

      // Seller with all 3 must be first among these sellers
      assert.equal(indexComplete, 0, 'Shop with photo, instagram, and tiktok must be first');
      assert.ok(indexComplete < indexPhotoIg, 'Complete shop must precede Photo + IG shop');
      assert.ok(indexPhotoIg < indexPhotoOnly, 'Photo + IG shop must precede Photo-only shop');
      assert.ok(indexPhotoOnly < indexIncomplete, 'Photo-only shop must precede Incomplete shop');
    });
  } finally {
    await pool.query('DELETE FROM sellers WHERE id = ANY($1)', [[sellerComplete.id, sellerPhotoIg.id, sellerPhotoOnly.id, sellerIncomplete.id]]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[user1.id, user2.id, user3.id, user4.id]]);
  }
});

