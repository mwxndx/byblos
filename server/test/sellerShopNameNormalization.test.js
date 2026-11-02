import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShopName, createSeller, isShopNameAvailable, findSellerByShopName } from '../src/domains/commerce/sellers/seller.model.js';
import { pool } from '../src/infrastructure/database/database.js';

test('Seller Shop Name Normalization Domain Contract', async (t) => {
  await t.test('normalizeShopName utility', () => {
    assert.equal(normalizeShopName('urban_wear'), 'Urban Wear');
    assert.equal(normalizeShopName('glam_boutique_ke'), 'Glam Boutique Ke');
    assert.equal(normalizeShopName('my__cool___shop'), 'My Cool Shop');
    assert.equal(normalizeShopName('_thrift_store_'), 'Thrift Store');
    assert.equal(normalizeShopName('jane'), 'Jane');
    assert.equal(normalizeShopName('store_101'), 'Store 101');
    assert.equal(normalizeShopName(''), '');
    assert.equal(normalizeShopName(null), '');
    assert.equal(normalizeShopName(undefined), '');

    // Never contains an underscore
    const testCases = ['a_b', 'under_score_test', '___multi___'];
    for (const input of testCases) {
      const normalized = normalizeShopName(input);
      assert.equal(normalized.includes('_'), false);
      assert.equal(normalized.charAt(0), normalized.charAt(0).toUpperCase());
    }
  });

  await t.test('createSeller automatically normalizes shop name and sets valid slug', async () => {
    const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const rawShopName = `cool_apparel_${uniqueSuffix}`;
    const email = `seller_${uniqueSuffix}@test.byblos.local`;

    const seller = await createSeller({
      fullName: 'Test Seller',
      shopName: rawShopName,
      email,
      city: 'Nairobi',
      location: 'Westlands'
    });

    try {
      assert.ok(seller);
      assert.ok(seller.id);
      // Shop name must start with a capital letter
      assert.equal(seller.shopName.charAt(0), seller.shopName.charAt(0).toUpperCase());
      // Underscores must be replaced by space
      assert.equal(seller.shopName.includes('_'), false);
      assert.ok(seller.shopName.startsWith('Cool Apparel '));
      // Slug must match slugified shop name without underscores
      assert.ok(seller.slug);
      assert.equal(seller.slug.includes('_'), false);
    } finally {
      await pool.query('DELETE FROM sellers WHERE id = $1', [seller.id]);
    }
  });

  await t.test('isShopNameAvailable matches both underscore variant and normalized variant', async () => {
    const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const email = `seller_${uniqueSuffix}@test.byblos.local`;

    const seller = await createSeller({
      fullName: 'Test Availability Seller',
      shopName: `vintage_denim_${uniqueSuffix}`,
      email,
      city: 'Nairobi',
      location: 'Kilimani'
    });

    try {
      // Testing with the underscore input should report taken
      const availableWithUnderscore = await isShopNameAvailable(`vintage_denim_${uniqueSuffix}`);
      assert.equal(availableWithUnderscore, false);

      // Testing with the normalized title-cased space-separated input should report taken
      const normalized = `Vintage Denim ${uniqueSuffix.charAt(0).toUpperCase() + uniqueSuffix.slice(1)}`;
      const availableWithNormalized = await isShopNameAvailable(normalized);
      assert.equal(availableWithNormalized, false);

      // Testing an unallocated name should report available
      const unusedName = `totally_random_shop_${uniqueSuffix}`;
      const availableUnused = await isShopNameAvailable(unusedName);
      assert.equal(availableUnused, true);
    } finally {
      await pool.query('DELETE FROM sellers WHERE id = $1', [seller.id]);
    }
  });

  await t.test('database contains zero seller shop names with underscores or starting with lowercase', async () => {
    const { rows } = await pool.query(`
      SELECT id, shop_name, slug 
      FROM sellers 
      WHERE position('_' in shop_name) > 0 OR shop_name ~ '^[a-z]'
    `);
    assert.equal(rows.length, 0, `Expected 0 unnormalized sellers in DB, found: ${JSON.stringify(rows)}`);
  });
});
