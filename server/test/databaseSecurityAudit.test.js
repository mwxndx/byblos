import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDbSslConfig, pool } from '../src/infrastructure/database/database.js';
import { timingSafeEqualString } from '../src/shared/utils/crypto.utils.js';
import { bootstrapPrivilegedAccountIfConfigured } from '../src/domains/identity/auth/bootstrapPrivilegedAccounts.js';
import PaymentService from '../src/domains/payments/payments/payment.service.js';

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

describe('Privileged Account Bootstrapping Role Separation Seam', () => {
    test('bootstrapping marketing credentials assigns role=marketing, not admin', async () => {
        const testEmail = `marketing-test-${Date.now()}@test.byblos.local`;
        process.env.MARKETING_EMAIL = testEmail;
        process.env.MARKETING_PASSWORD = 'SecretMarketingPass123!';
        try {
            const user = await bootstrapPrivilegedAccountIfConfigured(testEmail, 'SecretMarketingPass123!');
            assert.ok(user);
            assert.equal(user.email, testEmail);
            assert.equal(user.role, 'marketing');
        } finally {
            delete process.env.MARKETING_EMAIL;
            delete process.env.MARKETING_PASSWORD;
            await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);
        }
    });
});

describe('Payment Status Identifier IDOR Mitigation Seam', () => {
    test('disallows numeric database ID enumeration by default for public lookups', async () => {
        const dummyInv = `inv-num-test-${Date.now()}`;
        const { rows: [p] } = await pool.query(
            `INSERT INTO payments (invoice_id, amount, currency, status, provider_reference, updated_at)
             VALUES ($1, 100, 'KES', 'pending', $1, NOW()) RETURNING id`,
            [dummyInv]
        );
        try {
            // When allowNumericId is false (public mode), querying by integer ID must return null
            const payment = await PaymentService.checkPaymentStatus(String(p.id), { allowNumericId: false });
            assert.equal(payment, null);
        } finally {
            await pool.query('DELETE FROM payments WHERE id = $1', [p.id]);
        }
    });

    test('allows lookup by string reference or when allowNumericId is true', async () => {
        const dummyInv = `inv-test-${Date.now()}`;
        const { rows: [p] } = await pool.query(
            `INSERT INTO payments (invoice_id, amount, currency, status, provider_reference, updated_at)
             VALUES ($1, 100, 'KES', 'pending', $1, NOW()) RETURNING id`,
            [dummyInv]
        );
        try {
            const foundByRef = await PaymentService.checkPaymentStatus(dummyInv);
            assert.ok(foundByRef);
            assert.equal(foundByRef.provider_reference, dummyInv);

            const foundById = await PaymentService.checkPaymentStatus(String(p.id), { allowNumericId: true });
            assert.ok(foundById);
            assert.equal(foundById.id, p.id);
        } finally {
            await pool.query('DELETE FROM payments WHERE id = $1', [p.id]);
        }
    });
});
