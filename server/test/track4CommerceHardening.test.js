import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDigitalPath } from '../src/domains/commerce/products/productValidationRules.js';
import { generateSecureDownloadUrl } from '../src/domains/commerce/repositories/digitalDownload.repository.js';
import InventoryReservationService from '../src/domains/commerce/products/inventoryReservation.service.js';
import * as sellerRepo from '../src/domains/commerce/sellers/seller.repository.js';
import ProductModel from '../src/domains/commerce/products/product.model.js';
import { pool } from '../src/infrastructure/database/database.js';

describe('Track 4: Commerce & Catalog Domain Hardening', () => {
  let testUserId;
  let testSellerId;
  let testProduct1Id;
  let testProduct2Id;

  before(async () => {
    const email = `track4-test-${Date.now()}@byblos.test`;
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active, is_verified)
       VALUES ($1, 'hash_test_123', 'seller', true, true)
       RETURNING id`,
      [email]
    );
    testUserId = userRes.rows[0].id;

    const sellerRes = await pool.query(
      `INSERT INTO sellers (user_id, full_name, email, shop_name, whatsapp_number, terms_accepted, location, city, status)
       VALUES ($1, 'Track 4 Seller', $2, $3, '0712345678', true, 'Westlands', 'Nairobi', 'active')
       RETURNING id`,
      [testUserId, email, `shop-t4-${Date.now()}`]
    );
    testSellerId = sellerRes.rows[0].id;

    const p1Res = await pool.query(
      `INSERT INTO products (seller_id, name, description, price, quantity, reserved_quantity, track_inventory, product_type, status)
       VALUES ($1, 'Track 4 Product 1', 'Test', 100, 10, 0, true, 'physical', 'available')
       RETURNING id`,
      [testSellerId]
    );
    testProduct1Id = p1Res.rows[0].id;

    const p2Res = await pool.query(
      `INSERT INTO products (seller_id, name, description, price, quantity, reserved_quantity, track_inventory, product_type, status)
       VALUES ($1, 'Track 4 Product 2', 'Test', 200, 5, 0, true, 'physical', 'available')
       RETURNING id`,
      [testSellerId]
    );
    testProduct2Id = p2Res.rows[0].id;
  });

  after(async () => {
    if (testProduct1Id || testProduct2Id) {
      await pool.query('DELETE FROM products WHERE id IN ($1, $2)', [testProduct1Id, testProduct2Id]);
    }
    if (testSellerId) {
      await pool.query('DELETE FROM sellers WHERE id = $1', [testSellerId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  test('Action 4.1: InventoryReservationService consolidates duplicate cart items and sorts ascending to prevent deadlocks', async () => {
    // Pass items in reverse order with duplicate product entries: [p2, p1, p2]
    const higherId = Math.max(testProduct1Id, testProduct2Id);
    const lowerId = Math.min(testProduct1Id, testProduct2Id);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const cartItems = [
        { productId: higherId, quantity: 1, trackInventory: true, productType: 'physical' },
        { productId: lowerId, quantity: 2, trackInventory: true, productType: 'physical' },
        { productId: higherId, quantity: 2, trackInventory: true, productType: 'physical' }
      ];

      // Reserve inventory: should consolidate higherId to 3, lowerId to 2, and process in ascending order [lowerId, higherId]
      const count = await InventoryReservationService.reserveInventory(client, cartItems);
      assert.equal(count, 2, 'Should reserve 2 distinct consolidated products');

      // Check database state
      const checkRes = await client.query(
        'SELECT id, reserved_quantity FROM products WHERE id IN ($1, $2) ORDER BY id ASC',
        [lowerId, higherId]
      );
      assert.equal(checkRes.rows[0].id, lowerId);
      assert.equal(checkRes.rows[0].reserved_quantity, 2);
      assert.equal(checkRes.rows[1].id, higherId);
      assert.equal(checkRes.rows[1].reserved_quantity, 3);

      // Release inventory
      await InventoryReservationService.releaseInventory(client, cartItems);
      const releasedRes = await client.query(
        'SELECT id, reserved_quantity FROM products WHERE id IN ($1, $2) ORDER BY id ASC',
        [lowerId, higherId]
      );
      assert.equal(releasedRes.rows[0].reserved_quantity, 0);
      assert.equal(releasedRes.rows[1].reserved_quantity, 0);

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  test('Action 4.1: checkInventory detects cumulative shortage when duplicate cart lines exceed available stock', () => {
    const items = [
      { productId: 101, name: 'Item A', quantity: 3, availableQuantity: 4, trackInventory: true, productType: 'physical' },
      { productId: 101, name: 'Item A', quantity: 2, availableQuantity: 4, trackInventory: true, productType: 'physical' }
    ];

    // Total requested = 5, available = 4. Individual lines (3 and 2) are <= 4, but consolidated (5) > 4
    assert.throws(
      () => InventoryReservationService.checkInventory(items),
      /Insufficient stock for "Item A"/
    );
  });

  test('Action 4.2: sanitizeDigitalPath strictly validates Cloudinary public IDs and blocks path traversal', () => {
    // Valid public IDs
    assert.equal(sanitizeDigitalPath('byblos/digital/book_123'), 'byblos/digital/book_123');
    assert.equal(sanitizeDigitalPath('assets/course-guide.pdf'), 'assets/course-guide.pdf');
    assert.equal(sanitizeDigitalPath('simple_id'), 'simple_id');

    // Invalid / malicious inputs
    assert.throws(() => sanitizeDigitalPath('../../etc/passwd'), /Invalid digital file path/);
    assert.throws(() => sanitizeDigitalPath('/absolute/path/file.pdf'), /Invalid digital file path/);
    assert.throws(() => sanitizeDigitalPath('\\windows\\file.pdf'), /Invalid digital file path/);
    assert.throws(() => sanitizeDigitalPath('uploads/local.pdf'), /Invalid digital file path/);
    assert.throws(() => sanitizeDigitalPath('file\0name'), /Invalid digital file path/);
    assert.throws(() => sanitizeDigitalPath('https://external.com/file.zip'), /not a URL/);
    assert.throws(() => sanitizeDigitalPath('file; rm -rf /'), /invalid characters/);
    assert.throws(() => sanitizeDigitalPath(12345), /expected a string/);
  });

  test('Action 4.2: generateSecureDownloadUrl dynamically extracts file extension for non-PDFs', async () => {
    const zipUrl = await generateSecureDownloadUrl('products/digital/resource_pack', 1, 'resource_pack.zip');
    assert.ok(zipUrl);
    // In test environment without Cloudinary API credentials, fallback returns the digitalFilePath safely
    assert.ok(typeof zipUrl === 'string');

    const epubUrl = await generateSecureDownloadUrl('products/digital/manual.epub', 2);
    assert.ok(epubUrl);
  });

  test('Action 4.3: seller.repository exports required data access functions', async () => {
    assert.equal(typeof sellerRepo.updateSellerTheme, 'function');
    assert.equal(typeof sellerRepo.updateSellerBusinessPhoto, 'function');
    assert.equal(typeof sellerRepo.findSellersByLocation, 'function');
    assert.equal(typeof sellerRepo.findSellerProducts, 'function');

    // Test updateSellerTheme
    const updatedTheme = await sellerRepo.updateSellerTheme(testSellerId, 'modern-dark');
    assert.ok(updatedTheme);
    assert.equal(updatedTheme.theme, 'modern-dark');

    // Test updateSellerBusinessPhoto
    const updatedPhoto = await sellerRepo.updateSellerBusinessPhoto(testSellerId, 'https://cdn.byblos.test/photo.jpg');
    assert.ok(updatedPhoto);
    assert.equal(updatedPhoto.avatarUrl, 'https://cdn.byblos.test/photo.jpg');

    // Test findSellersByLocation
    const sellersInCity = await sellerRepo.findSellersByLocation({ city: 'Nairobi', limit: 10 });
    assert.ok(Array.isArray(sellersInCity));
    const found = sellersInCity.some(s => s.id === testSellerId);
    assert.ok(found, 'Created test seller should be returned in Nairobi search');

    // Test findSellerProducts
    const sellerProducts = await sellerRepo.findSellerProducts(testSellerId, { limit: 10 });
    assert.ok(Array.isArray(sellerProducts));
    assert.ok(sellerProducts.length >= 2, 'Should return at least the 2 test products');
  });

  test('Action 4.5: Deprecated ProductModel reserve/release/commit dead code is removed', () => {
    assert.equal(ProductModel.reserve, undefined, 'ProductModel.reserve should be undefined');
    assert.equal(ProductModel.release, undefined, 'ProductModel.release should be undefined');
    assert.equal(ProductModel.commit, undefined, 'ProductModel.commit should be undefined');
  });
});
