import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Growth Domain SQL Column Pruning Contract', async (t) => {
    await t.test('creator.service.js does not contain SELECT * queries', () => {
        const filePath = path.resolve(__dirname, '../src/domains/growth/creators/creator.service.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+(\*|[a-zA-Z0-9_]+\.\*)\s+FROM/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 wildcard SELECT queries in creator.service.js, found: ${JSON.stringify(matches)}`);
    });

    await t.test('growth domain files do not contain wildcard SELECT queries', () => {
        const growthDir = path.resolve(__dirname, '../src/domains/growth');
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
        collectFiles(growthDir);

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const matches = content.match(/SELECT\s+(\*|[a-zA-Z0-9_]+\.\*)\s+FROM/gi) || [];
            assert.equal(matches.length, 0, `Found wildcard SELECT in ${path.relative(growthDir, file)}: ${JSON.stringify(matches)}`);
        }
    });

    await t.test('creator projections retain essential identity, financial, and terms properties', () => {
        const filePath = path.resolve(__dirname, '../src/domains/growth/creators/creator.service.js');
        const content = fs.readFileSync(filePath, 'utf8');
        assert.ok(content.includes('terms_accepted'), 'Expected terms_accepted in creator.service.js');
        assert.ok(content.includes('mpesa_number'), 'Expected mpesa_number in creator.service.js');
        assert.ok(content.includes('whatsapp_number'), 'Expected whatsapp_number in creator.service.js');
        assert.ok(content.includes('withdrawal_reserved_balance'), 'Expected withdrawal_reserved_balance in creator.service.js');
    });
});
