import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Logistics Domain SQL Column Pruning Contract', async (t) => {
    await t.test('All logistics domain service files contain 0 SELECT * queries', () => {
        const logisticsDir = path.resolve(__dirname, '../src/domains/logistics');
        const files = fs.readdirSync(logisticsDir).filter(f => f.endsWith('.js'));

        files.forEach(file => {
            const filePath = path.join(logisticsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const matches = content.match(/SELECT\s+\*\s+FROM/gi) || [];
            assert.equal(matches.length, 0, `Expected 0 SELECT * queries in ${file}, found ${matches.length}`);
        });
    });

    await t.test('logisticsRequest.service.js retains required payment and order columns', () => {
        const filePath = path.resolve(__dirname, '../src/domains/logistics/logisticsRequest.service.js');
        const content = fs.readFileSync(filePath, 'utf8');

        // Check payments columns
        assert.ok(content.includes('provider_reference'), 'Expected provider_reference in payments query');
        assert.ok(content.includes('currency'), 'Expected currency in payments query');

        // Check product_orders columns
        assert.ok(content.includes('order_number'), 'Expected order_number in product_orders query');
        assert.ok(content.includes('total_amount'), 'Expected total_amount in product_orders query');
        assert.ok(content.includes('fulfillment_type'), 'Expected fulfillment_type in product_orders query');
        assert.ok(content.includes('order_type'), 'Expected order_type in product_orders query');
        assert.ok(content.includes('shipping_address'), 'Expected shipping_address in product_orders query');
    });
});
