import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MOCK_PORT = 3098;
process.env.PAYSTACK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_secret_key_for_testing';
process.env.PAYOUT_PROVIDER = 'paystack';

const { pool } = await import('../src/infrastructure/database/database.js');
const withdrawalService = (await import('../src/domains/payments/withdrawals/withdrawal.service.js')).default;
const payoutService = (await import('../src/domains/payments/payouts/payout.service.js')).default;
const LedgerService = (await import('../src/domains/finance/ledger/LedgerService.js')).default;
const Fees = (await import('../src/shared/config/fees.js')).default;
const { createSeller, cleanupSeller } = await import('./helpers/factories.js');

let mockServer;

before(async () => {
    mockServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            if (req.url.includes('/transferrecipient')) {
                res.end(JSON.stringify({ status: true, message: 'ok', data: { recipient_code: 'RCP_mock_ledger' } }));
            } else if (req.url.includes('/transfer')) {
                let ref = 'byblos-ledger-ref';
                try { ref = JSON.parse(body).reference || ref; } catch { /* default */ }
                res.end(JSON.stringify({ status: true, message: 'ok', data: { transfer_code: 'TRF_mock_ledger', reference: ref, status: 'success' } }));
            } else {
                res.end(JSON.stringify({ status: true, data: {} }));
            }
        });
    });
    await new Promise((resolve) => mockServer.listen(MOCK_PORT, '127.0.0.1', resolve));
});

after(async () => {
    await new Promise((resolve) => mockServer.close(resolve));
});

describe('Cryptographic Financial Ledger Phase 3 - Seam Integration & Tamper Detection', () => {
    test('enforces strict DB trigger immutability (UPDATE and DELETE are rejected)', async () => {
        const client = await pool.connect();
        try {
            // Check that genesis root exists
            const { rows: roots } = await client.query(
                `SELECT sequence_number, event_type, row_hash FROM financial_ledger WHERE sequence_number = 1`
            );
            assert.equal(roots.length, 1);
            assert.equal(roots[0].event_type, 'GENESIS_ROOT');

            // Attempting to UPDATE any row in financial_ledger must fail via trigger
            await assert.rejects(
                async () => {
                    await client.query(`UPDATE financial_ledger SET amount = 999999 WHERE sequence_number = 1`);
                },
                (err) => {
                    assert.match(err.message, /CRITICAL SECURITY VIOLATION/);
                    return true;
                }
            );

            // Attempting to DELETE any row in financial_ledger must fail via trigger
            await assert.rejects(
                async () => {
                    await client.query(`DELETE FROM financial_ledger WHERE sequence_number = 1`);
                },
                (err) => {
                    assert.match(err.message, /CRITICAL SECURITY VIOLATION/);
                    return true;
                }
            );
        } finally {
            client.release();
        }
    });

    test('verifies seller balance against cryptographic ledger and permits valid withdrawal', async () => {
        const seller = await createSeller();
        const client = await pool.connect();

        try {
            // Set seller balance and seed matching ledger history
            await client.query('BEGIN');
            await client.query(`UPDATE sellers SET balance = 5000 WHERE id = $1`, [seller.id]);
            await LedgerService.appendEntry(client, {
                eventType: 'GENESIS_BALANCE',
                entityType: 'seller',
                entityId: seller.id,
                amount: 5000,
                balanceAfter: 5000,
                payload: { note: 'test_seed' }
            });
            await client.query('COMMIT');

            // Verify withdrawal proceeds normally
            const withdrawAmount = 1000;
            const req = await withdrawalService.createWithdrawalRequest({
                entityType: 'seller',
                entityId: seller.id,
                amount: withdrawAmount,
                mpesaNumber: '0712345678',
                mpesaName: 'Seller Ledger Test',
                idempotencyKey: `idemp_valid_withdraw_${seller.id}`
            });

            assert.ok(req.id);
            assert.equal(req.status, 'processing');

            // Check that WITHDRAWAL_RESERVE_LOCKED was appended to financial_ledger
            const { rows: ledgerRows } = await client.query(
                `SELECT event_type, amount, balance_after
                 FROM financial_ledger
                 WHERE entity_type = 'seller' AND entity_id = $1
                 ORDER BY sequence_number DESC LIMIT 1`,
                [seller.id]
            );

            const expectedFee = Fees.calculateWithdrawalFee(withdrawAmount);
            const expectedDeduction = withdrawAmount + expectedFee;

            assert.equal(ledgerRows[0].event_type, 'WITHDRAWAL_RESERVE_LOCKED');
            assert.equal(Number(ledgerRows[0].amount), -expectedDeduction);
            assert.equal(Number(ledgerRows[0].balance_after), 5000 - expectedDeduction);
        } finally {
            client.release();
            await cleanupSeller(seller.id).catch(() => {});
        }
    });

    test('tamper detection: blocks withdrawal with 403 when rogue DB update alters seller balance', async () => {
        const seller = await createSeller();
        const client = await pool.connect();

        try {
            // Seed genuine seller balance and matching ledger entry for 2000
            await client.query('BEGIN');
            await client.query(`UPDATE sellers SET balance = 2000 WHERE id = $1`, [seller.id]);
            await LedgerService.appendEntry(client, {
                eventType: 'GENESIS_BALANCE',
                entityType: 'seller',
                entityId: seller.id,
                amount: 2000,
                balanceAfter: 2000,
                payload: { note: 'genuine_balance' }
            });
            await client.query('COMMIT');

            // Simulate rogue attacker/admin modifying sellers table directly without ledger
            await client.query(
                `UPDATE sellers SET balance = 50000 WHERE id = $1`,
                [seller.id]
            );

            // Attempting to withdraw against the tampered balance MUST be blocked with 403
            await assert.rejects(
                async () => {
                    await withdrawalService.createWithdrawalRequest({
                        entityType: 'seller',
                        entityId: seller.id,
                        amount: 5000,
                        mpesaNumber: '0712345678',
                        mpesaName: 'Rogue Exploit Attempt',
                        idempotencyKey: `idemp_rogue_exploit_${seller.id}`
                    });
                },
                (err) => {
                    assert.equal(err.statusCode, 403);
                    assert.match(err.message, /Cryptographic balance verification failed/);
                    return true;
                }
            );

            // Verify sellers balance was not drained into reserve
            const { rows: sellerRows } = await client.query(`SELECT balance, withdrawal_reserved_balance FROM sellers WHERE id = $1`, [seller.id]);
            assert.equal(Number(sellerRows[0].withdrawal_reserved_balance), 0);
        } finally {
            client.release();
            await cleanupSeller(seller.id).catch(() => {});
        }
    });

    test('appends WITHDRAWAL_REVERSED_REFUND when failed payout is refunded to wallet', async () => {
        const seller = await createSeller();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            await client.query(`UPDATE sellers SET balance = 3000 WHERE id = $1`, [seller.id]);
            await LedgerService.appendEntry(client, {
                eventType: 'GENESIS_BALANCE',
                entityType: 'seller',
                entityId: seller.id,
                amount: 3000,
                balanceAfter: 3000,
                payload: { note: 'test_refund_seed' }
            });
            await client.query('COMMIT');

            // Create a withdrawal request row so the FK constraint on withdrawal_id is satisfied
            const { rows: reqRows } = await client.query(
                `INSERT INTO withdrawal_requests (seller_id, amount, status, mpesa_number, mpesa_name, idempotency_key)
                 VALUES ($1, $2, 'failed', '0712345678', 'Test Seller', $3)
                 RETURNING id`,
                [seller.id, 500, `idemp_refund_test_${seller.id}`]
            );
            const withdrawalId = reqRows[0].id;

            // Simulate refund to wallet inside transaction
            await client.query('BEGIN');
            const mockRequest = {
                id: withdrawalId,
                seller_id: seller.id,
                amount: 500,
                metadata: { withdrawal_fee: 15 }
            };

            const newBalance = await payoutService.refundToWallet(client, mockRequest);
            await client.query('COMMIT');

            assert.equal(newBalance, 3000 + 515);

            // Verify ledger entry
            const { rows: ledgerRows } = await client.query(
                `SELECT event_type, amount, balance_after
                 FROM financial_ledger
                 WHERE entity_type = 'seller' AND entity_id = $1
                 ORDER BY sequence_number DESC LIMIT 1`,
                [seller.id]
            );

            assert.equal(ledgerRows[0].event_type, 'WITHDRAWAL_REVERSED_REFUND');
            assert.equal(Number(ledgerRows[0].amount), 515);
            assert.equal(Number(ledgerRows[0].balance_after), 3515);
        } finally {
            client.release();
            await cleanupSeller(seller.id).catch(() => {});
        }
    });
});
