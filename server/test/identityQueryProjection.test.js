import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Identity Domain SQL Column Pruning Contract', async (t) => {
    await t.test('user.model.js does not contain SELECT * queries', () => {
        const filePath = path.resolve(__dirname, '../src/domains/identity/users/user.model.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+\*\s+FROM/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 SELECT * queries in user.model.js, found ${matches.length}`);
    });

    await t.test('auth.service.js does not contain SELECT * queries', () => {
        const filePath = path.resolve(__dirname, '../src/domains/identity/auth/auth.service.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+\*\s+FROM/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 SELECT * queries in auth.service.js, found ${matches.length}`);
    });

    await t.test('crossRoleResolver.js does not contain SELECT * queries', () => {
        const filePath = path.resolve(__dirname, '../src/domains/identity/auth/crossRoleResolver.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+\*\s+FROM/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 SELECT * queries in crossRoleResolver.js, found ${matches.length}`);
    });

    await t.test('admin.service.js does not contain SELECT * queries on base tables', () => {
        const filePath = path.resolve(__dirname, '../src/domains/identity/admin/admin.service.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/SELECT\s+\*\s+FROM\s+(?!buyer_regions|seller_regions|order_regions)\w+/gi) || [];
        assert.equal(matches.length, 0, `Expected 0 SELECT * table queries in admin.service.js, found ${matches.length}`);
    });

    await t.test('creator resolution retains required identity and terms properties', () => {
        const authPath = path.resolve(__dirname, '../src/domains/identity/auth/auth.service.js');
        const authContent = fs.readFileSync(authPath, 'utf8');
        assert.ok(authContent.includes('terms_accepted'), 'Expected terms_accepted in auth.service creator projection');
        assert.ok(authContent.includes('status'), 'Expected status in auth.service creator projection');

        const resolverPath = path.resolve(__dirname, '../src/domains/identity/auth/crossRoleResolver.js');
        const resolverContent = fs.readFileSync(resolverPath, 'utf8');
        assert.ok(resolverContent.includes('terms_accepted'), 'Expected terms_accepted in crossRoleResolver creator projection');
    });
});
