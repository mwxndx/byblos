import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Orders Domain SQL Column Pruning Contract', async (t) => {
    await t.test('OrderService.js does not contain SELECT * queries', () => {
        const filePath = path.resolve(__dirname, '../src/domains/orders/order/OrderService.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+\*\s+FROM/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 SELECT * queries in OrderService.js, found ${matches.length}`);
    });

    await t.test('fulfillmentQueue.service.js does not contain SELECT * queries', () => {
        const filePath = path.resolve(__dirname, '../src/domains/orders/fulfillment/fulfillmentQueue.service.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+\*\s+FROM/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 SELECT * queries in fulfillmentQueue.service.js, found ${matches.length}`);
    });

    await t.test('OrderService.js queries project essential escrow & downstream properties', () => {
        const filePath = path.resolve(__dirname, '../src/domains/orders/order/OrderService.js');
        const content = fs.readFileSync(filePath, 'utf8');

        // Verify required columns are present in query projections
        assert.ok(content.includes('seller_payout_amount'), 'Expected seller_payout_amount in OrderService projection for escrow release');
        assert.ok(content.includes('total_amount'), 'Expected total_amount in OrderService projection for escrow release');
        assert.ok(content.includes('fulfillment_type'), 'Expected fulfillment_type in OrderService projection');
        assert.ok(content.includes('order_type'), 'Expected order_type in OrderService projection');
        assert.ok(content.includes('shipping_address'), 'Expected shipping_address in OrderService projection');
    });

    await t.test('fulfillmentQueue.service.js queries project essential queue & order properties', () => {
        const filePath = path.resolve(__dirname, '../src/domains/orders/fulfillment/fulfillmentQueue.service.js');
        const content = fs.readFileSync(filePath, 'utf8');

        assert.ok(content.includes('order_type'), 'Expected order_type in fulfillmentQueue projection');
        assert.ok(content.includes('attempts'), 'Expected attempts in fulfillmentQueue projection');
        assert.ok(content.includes('max_attempts'), 'Expected max_attempts in fulfillmentQueue projection');
    });
});
