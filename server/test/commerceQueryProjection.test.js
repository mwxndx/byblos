import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Commerce Domain SQL Column Pruning Contract', async (t) => {
    await t.test('product.model.js does not contain SELECT * queries', () => {
        const filePath = path.resolve(__dirname, '../src/domains/commerce/products/product.model.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+\*\s+FROM/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 SELECT * queries in product.model.js, found ${matches.length}`);
    });

    await t.test('buyer.service.js does not contain SELECT * queries', () => {
        const filePath = path.resolve(__dirname, '../src/domains/commerce/buyers/buyer.service.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+\*\s+FROM/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 SELECT * queries in buyer.service.js, found ${matches.length}`);
    });

    await t.test('seller.model.js does not contain SELECT * queries', () => {
        const filePath = path.resolve(__dirname, '../src/domains/commerce/sellers/seller.model.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+\*\s+FROM/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 SELECT * queries in seller.model.js, found ${matches.length}`);
    });

    await t.test('product.model.js queries retain essential checkout & catalog properties', () => {
        const filePath = path.resolve(__dirname, '../src/domains/commerce/products/product.model.js');
        const content = fs.readFileSync(filePath, 'utf8');

        assert.ok(content.includes('price'), 'Expected price in product.model.js projection');
        assert.ok(content.includes('is_digital'), 'Expected is_digital in product.model.js projection');
        assert.ok(content.includes('digital_file_path'), 'Expected digital_file_path in product.model.js projection');
        assert.ok(content.includes('track_inventory'), 'Expected track_inventory in product.model.js projection');
        assert.ok(content.includes('quantity'), 'Expected quantity in product.model.js projection');
        assert.ok(content.includes('service_options'), 'Expected service_options in product.model.js projection');
    });

    await t.test('buyer.service.js queries retain authentication properties', () => {
        const filePath = path.resolve(__dirname, '../src/domains/commerce/buyers/buyer.service.js');
        const content = fs.readFileSync(filePath, 'utf8');

        assert.ok(content.includes('password_hash'), 'Expected password_hash in buyer.service.js projection');
        assert.ok(content.includes('email'), 'Expected email in buyer.service.js projection');
    });
});
