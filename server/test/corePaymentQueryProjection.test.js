import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CorePaymentService SQL Column Projection (Query Optimization)', () => {
    const servicePath = path.resolve(__dirname, '../src/domains/payments/payments/CorePaymentService.js');
    const sourceCode = fs.readFileSync(servicePath, 'utf8');

    test('findPaymentByInternalId uses explicit column projection instead of SELECT *', () => {
        // Assert no wildcard select in findPaymentByInternalId
        const internalIdMatch = sourceCode.match(/function\s+findPaymentByInternalId[\s\S]*?FOR UPDATE/);
        assert.ok(internalIdMatch, 'findPaymentByInternalId function should be present');
        const functionBody = internalIdMatch[0];

        assert.equal(
            /SELECT\s+\*\s+FROM\s+payments/i.test(functionBody),
            false,
            'findPaymentByInternalId must not use SELECT *'
        );

        // Required columns for payment completion and fraud inspection
        const requiredColumns = [
            'id', 'order_id', 'status', 'amount', 'currency', 'provider',
            'provider_reference', 'api_ref', 'invoice_id', 'mpesa_receipt', 'metadata'
        ];
        for (const col of requiredColumns) {
            assert.ok(
                functionBody.includes(col),
                `findPaymentByInternalId query projection must include column "${col}"`
            );
        }
    });

    test('findPaymentByProviderReference uses explicit column projection instead of SELECT *', () => {
        const providerRefMatch = sourceCode.match(/function\s+findPaymentByProviderReference[\s\S]*?FOR UPDATE/);
        assert.ok(providerRefMatch, 'findPaymentByProviderReference function should be present');
        const functionBody = providerRefMatch[0];

        assert.equal(
            /SELECT\s+\*\s+FROM\s+payments/i.test(functionBody),
            false,
            'findPaymentByProviderReference must not use SELECT *'
        );

        const requiredColumns = [
            'id', 'order_id', 'status', 'amount', 'currency', 'provider',
            'provider_reference', 'api_ref', 'invoice_id', 'mpesa_receipt', 'metadata'
        ];
        for (const col of requiredColumns) {
            assert.ok(
                functionBody.includes(col),
                `findPaymentByProviderReference query projection must include column "${col}"`
            );
        }
    });

    test('order lookup in completeVerifiedPayment uses explicit column projection instead of SELECT *', () => {
        const orderLookupMatch = sourceCode.match(/SELECT\s+[\s\S]*?FROM\s+product_orders\s+WHERE\s+id\s+=\s+\$1\s+FOR UPDATE/);
        assert.ok(orderLookupMatch, 'order lookup query should be present in completeVerifiedPayment');
        const queryText = orderLookupMatch[0];

        assert.equal(
            /SELECT\s+\*\s+FROM\s+product_orders/i.test(queryText),
            false,
            'order lookup query must not use SELECT *'
        );

        const requiredColumns = [
            'id', 'order_number', 'status', 'payment_status', 'total_amount',
            'seller_id', 'buyer_id', 'fulfillment_type', 'metadata'
        ];
        for (const col of requiredColumns) {
            assert.ok(
                queryText.includes(col),
                `order lookup query projection must include column "${col}"`
            );
        }
    });
});
