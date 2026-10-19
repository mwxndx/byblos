import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Application Layer SQL Column Pruning Contract', async (t) => {
    await t.test('paymentCron.js does not contain SELECT * queries', () => {
        const filePath = path.resolve(__dirname, '../src/application/cron/paymentCron.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+(\*|[a-zA-Z0-9_]+\.\*)\s+FROM/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 wildcard SELECT queries in paymentCron.js, found: ${JSON.stringify(matches)}`);
    });

    await t.test('reconciliationEngine.js does not contain SELECT * queries', () => {
        const filePath = path.resolve(__dirname, '../src/application/cron/reconciliationEngine.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+(\*|[a-zA-Z0-9_]+\.\*)\s+FROM/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 wildcard SELECT queries in reconciliationEngine.js, found: ${JSON.stringify(matches)}`);
    });

    await t.test('entire application layer does not contain wildcard SELECT queries', () => {
        const appDir = path.resolve(__dirname, '../src/application');
        const files = [];

        function collectFiles(dir) {
            for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    collectFiles(fullPath);
                } else if (item.isFile() && item.name.endsWith('.js')) {
                    files.push(fullPath);
                }
            }
        }
        collectFiles(appDir);

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const matches = content.match(/SELECT\s+(\*|[a-zA-Z0-9_]+\.\*)\s+FROM/gi) || [];
            assert.equal(matches.length, 0, `Found wildcard SELECT in ${path.relative(appDir, file)}: ${JSON.stringify(matches)}`);
        }
    });

    await t.test('reconciliation row lock preserves essential order settlement properties', () => {
        const filePath = path.resolve(__dirname, '../src/application/cron/reconciliationEngine.js');
        const content = fs.readFileSync(filePath, 'utf8');
        assert.ok(content.includes('seller_payout_amount'), 'Expected seller_payout_amount in reconciliation projection');
        assert.ok(content.includes('total_amount'), 'Expected total_amount in reconciliation projection');
        assert.ok(content.includes('platform_fee_amount'), 'Expected platform_fee_amount in reconciliation projection');
        assert.ok(content.includes('seller_id'), 'Expected seller_id in reconciliation projection');
    });
});
