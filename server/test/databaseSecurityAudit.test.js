import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDbSslConfig } from '../src/infrastructure/database/database.js';
import { timingSafeEqualString } from '../src/shared/utils/crypto.utils.js';

describe('Database SSL Configuration Security Seam', () => {
    test('enforces rejectUnauthorized=true by default in production', () => {
        const ssl = resolveDbSslConfig({ NODE_ENV: 'production' });
        assert.deepEqual(ssl, {
            rejectUnauthorized: true,
            ca: undefined,
        });
    });

    test('supports DB_SSL_CA in production with normalized newlines', () => {
        const ssl = resolveDbSslConfig({
            NODE_ENV: 'production',
            DB_SSL_CA: '-----BEGIN CERTIFICATE-----\\nMIIB...\\n-----END CERTIFICATE-----',
        });
        assert.equal(ssl.rejectUnauthorized, true);
        assert.equal(ssl.ca, '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----');
    });

    test('allows explicit opt-out of certificate verification when DB_SSL_REJECT_UNAUTHORIZED=false', () => {
        const ssl = resolveDbSslConfig({
            NODE_ENV: 'production',
            DB_SSL_REJECT_UNAUTHORIZED: 'false',
        });
        assert.equal(ssl.rejectUnauthorized, false);
    });

    test('returns false when DB_SSL=false even in production', () => {
        const ssl = resolveDbSslConfig({
            NODE_ENV: 'production',
            DB_SSL: 'false',
        });
        assert.equal(ssl, false);
    });

    test('returns false in non-production environments by default', () => {
        const devSsl = resolveDbSslConfig({ NODE_ENV: 'development' });
        assert.equal(devSsl, false);

        const testSsl = resolveDbSslConfig({ NODE_ENV: 'test' });
        assert.equal(testSsl, false);
    });
});

describe('Buyer Auth Password Timing Safety', () => {
    test('timingSafeEqualString correctly verifies equal passwords', () => {
        assert.equal(timingSafeEqualString('SuperSecretPassword123!', 'SuperSecretPassword123!'), true);
    });

    test('timingSafeEqualString rejects mismatched passwords safely', () => {
        assert.equal(timingSafeEqualString('SuperSecretPassword123!', 'WrongPassword123!'), false);
        assert.equal(timingSafeEqualString('SuperSecretPassword123!', 'SuperSecretPassword123'), false);
        assert.equal(timingSafeEqualString('', 'non-empty'), false);
    });
});
