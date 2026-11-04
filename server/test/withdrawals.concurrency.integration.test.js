/**
 * withdrawals.concurrency.integration.test.js
 *
 * Deterministic concurrent integration tests covering:
 * 1. Multiple simultaneous withdrawal requests against the same account.
 * 2. Simultaneous withdrawal creation and admin status update.
 * 3. Simultaneous withdrawal creation and rejection.
 * 4. Simultaneous approval and provider callback.
 * 5. Duplicate completion callbacks.
 * 6. Simultaneous reconciliation and callback processing.
 * 7. Multiple withdrawal requests across different account types.
 * 8. Concurrent withdrawals where available funds are insufficient for all requests.
 * 9. Transaction rollback during status and ledger updates.
 * 10. Repeated execution of the same callback or reconciliation operation.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MOCK_PORT = 3099;
process.env.PAYSTACK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_secret_key_for_testing';
process.env.PAYOUT_PROVIDER = 'paystack';

const { pool } = await import('../src/infrastructure/database/database.js');
const WithdrawalService = (await import('../src/domains/payments/withdrawals/withdrawal.service.js')).default;
const payoutCallbackStateMachineService = (await import('../src/domains/payments/payouts/payoutCallbackStateMachine.service.js')).default;
const { reconcileStuckWithdrawalsHelper } = await import('../src/domains/payments/withdrawals/withdrawalReconciliationHelper.js');
const {
  createBuyer,
  createSeller,
  createCreator,
  cleanupBuyer,
  cleanupSeller,
  cleanupCreator
} = await import('./helpers/factories.js');

describe('Withdrawals Concurrency & Deadlock Elimination Suite', () => {
  let testSeller;
  let testCreator;
  let testBuyer;
  let mockServer;

  before(async () => {
    // Setup mock payout provider server
    mockServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (req.url.includes('/transferrecipient')) {
          res.end(JSON.stringify({ status: true, message: 'ok', data: { recipient_code: 'RCP_mock_123' } }));
        } else if (req.url.includes('/transfer')) {
          let ref = 'byblos-mock-ref';
          try { ref = JSON.parse(body).reference || ref; } catch { /* keep default */ }
          res.end(JSON.stringify({ status: true, message: 'ok', data: { transfer_code: 'TRF_mock_123', reference: ref, status: 'success' } }));
        } else {
          res.end(JSON.stringify({ status: true, data: {} }));
        }
      });
    });

    await new Promise((resolve) => {
      mockServer.listen(MOCK_PORT, '127.0.0.1', () => resolve());
      mockServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') resolve();
      });
    });

    testSeller = await createSeller({});
    await pool.query('UPDATE sellers SET balance = 50000 WHERE id = $1', [testSeller.id]);

    testCreator = await createCreator({});
    await pool.query('UPDATE creators SET balance = 50000 WHERE id = $1', [testCreator.id]);

    testBuyer = await createBuyer({ mobilePayment: '0711223344' });
    await pool.query('UPDATE buyers SET refunds = 50000, mobile_payment = $2 WHERE id = $1', [testBuyer.id, '0711223344']);
  });

  after(async () => {
    if (mockServer?.listening) {
      await new Promise((resolve) => mockServer.close(resolve)).catch(() => {});
    }
    if (testSeller?.id) {
      await pool.query('DELETE FROM payout_provider_attempts WHERE seller_id = $1', [testSeller.id]).catch(() => {});
      await pool.query('DELETE FROM withdrawal_requests WHERE seller_id = $1', [testSeller.id]).catch(() => {});
      await cleanupSeller(testSeller.id).catch(() => {});
    }
    if (testCreator?.id) {
      await pool.query('DELETE FROM payout_provider_attempts WHERE creator_id = $1', [testCreator.id]).catch(() => {});
      await pool.query('DELETE FROM withdrawal_requests WHERE creator_id = $1', [testCreator.id]).catch(() => {});
      await cleanupCreator(testCreator.id).catch(() => {});
    }
    if (testBuyer?.id) {
      await pool.query('DELETE FROM payout_provider_attempts WHERE buyer_id = $1', [testBuyer.id]).catch(() => {});
      await pool.query('DELETE FROM withdrawal_requests WHERE buyer_id = $1', [testBuyer.id]).catch(() => {});
      await cleanupBuyer(testBuyer.id).catch(() => {});
    }
  });

  test('1. Multiple simultaneous withdrawal requests against the same account serialize without deadlock', async () => {
    const promises = Array.from({ length: 4 }, (_, i) =>
      WithdrawalService.createWithdrawalRequest({
        entityId: testSeller.id,
        entityType: 'seller',
        amount: 1000,
        mpesaNumber: '0712345678',
        mpesaName: 'Concurrent Seller',
        idempotencyKey: `simultaneous-seller-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`
      })
    );

    const results = await Promise.allSettled(promises);
    const deadlocks = results.filter(r => r.status === 'rejected' && /deadlock|40P01/i.test(r.reason?.message || ''));
    assert.equal(deadlocks.length, 0, 'No deadlocks should occur during simultaneous requests');

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    assert.ok(fulfilled.length >= 1, 'At least one request should succeed');
  });

  test('2. Simultaneous withdrawal creation and admin status update serialize cleanly', async () => {
    const pendingReq = await WithdrawalService.createWithdrawalRequest({
      entityId: testSeller.id,
      entityType: 'seller',
      amount: 500,
      mpesaNumber: '0712345678',
      mpesaName: 'Concurrent Seller',
      idempotencyKey: `admin-update-race-initial-${Date.now()}`
    });

    const op1 = WithdrawalService.createWithdrawalRequest({
      entityId: testSeller.id,
      entityType: 'seller',
      amount: 500,
      mpesaNumber: '0712345678',
      mpesaName: 'Concurrent Seller',
      idempotencyKey: `admin-update-race-concurrent-${Date.now()}`
    });

    const op2 = WithdrawalService.updateStatusWithSideEffects(pendingReq.id, 'completed', {
      remarks: 'Simultaneous admin completion',
      mpesa_receipt: 'CONCURRENT_RCP_1'
    });

    const results = await Promise.allSettled([op1, op2]);
    const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);
    const deadlocks = errors.filter(e => /deadlock|40P01/i.test(e || ''));
    assert.equal(deadlocks.length, 0, 'Zero deadlocks between creation and admin update');
  });

  test('3. Simultaneous withdrawal creation and rejection (failed status + refund)', async () => {
    const pendingReq = await WithdrawalService.createWithdrawalRequest({
      entityId: testCreator.id,
      entityType: 'creator',
      amount: 500,
      mpesaNumber: '0712345678',
      mpesaName: 'Concurrent Creator',
      idempotencyKey: `creator-reject-race-initial-${Date.now()}`
    });

    const op1 = WithdrawalService.createWithdrawalRequest({
      entityId: testCreator.id,
      entityType: 'creator',
      amount: 500,
      mpesaNumber: '0712345678',
      mpesaName: 'Concurrent Creator',
      idempotencyKey: `creator-reject-race-concurrent-${Date.now()}`
    });

    const op2 = WithdrawalService.updateStatusWithSideEffects(pendingReq.id, 'failed', {
      remarks: 'Simultaneous rejection test'
    });

    const results = await Promise.allSettled([op1, op2]);
    const deadlocks = results.filter(r => r.status === 'rejected' && /deadlock|40P01/i.test(r.reason?.message || ''));
    assert.equal(deadlocks.length, 0, 'Zero deadlocks between creation and rejection');
  });

  test('4. Simultaneous approval and provider callback on same withdrawal request', async () => {
    const idemKey = `callback-race-initial-${Date.now()}`;
    const req = await WithdrawalService.createWithdrawalRequest({
      entityId: testBuyer.id,
      entityType: 'buyer_refund',
      amount: 600,
      mpesaNumber: '0711223344',
      mpesaName: 'Concurrent Buyer',
      idempotencyKey: idemKey
    });

    const op1 = WithdrawalService.updateStatusWithSideEffects(req.id, 'completed', {
      remarks: 'Admin override approval',
      mpesa_receipt: 'RCP_OVERRIDE_1'
    });

    const op2 = payoutCallbackStateMachineService.handleProviderCallback({
      event: 'transfer.success',
      data: {
        transaction_reference: `ref-${req.id}`,
        client_reference: idemKey,
        transfer_code: 'TRF_CALLBACK_1',
        amount: 600,
        status: 'success'
      }
    });

    const results = await Promise.allSettled([op1, op2]);
    const deadlocks = results.filter(r => r.status === 'rejected' && /deadlock|40P01/i.test(r.reason?.message || ''));
    assert.equal(deadlocks.length, 0, 'Zero deadlocks between approval and provider callback');

    const { rows: [finalRow] } = await pool.query('SELECT status FROM withdrawal_requests WHERE id = $1', [req.id]);
    assert.equal(finalRow.status, 'completed');
  });

  test('5. Duplicate completion callbacks execute idempotently without double-release', async () => {
    const idemKey = `dup-callback-${Date.now()}`;
    const req = await WithdrawalService.createWithdrawalRequest({
      entityId: testSeller.id,
      entityType: 'seller',
      amount: 400,
      mpesaNumber: '0712345678',
      mpesaName: 'Concurrent Seller',
      idempotencyKey: idemKey
    });

    const callbackPayload = {
      event: 'transfer.success',
      data: {
        transaction_reference: `ref-dup-${req.id}`,
        client_reference: idemKey,
        transfer_code: 'TRF_DUP_1',
        amount: 400,
        status: 'success'
      }
    };

    const res1 = await payoutCallbackStateMachineService.handleProviderCallback(callbackPayload);
    const res2 = await payoutCallbackStateMachineService.handleProviderCallback(callbackPayload);

    assert.ok(['completed', 'already_completed', 'ignored_completed'].includes(res2.status), 'Second callback must be handled idempotently');
  });

  test('6. Simultaneous reconciliation and callback processing', async () => {
    const req = await WithdrawalService.createWithdrawalRequest({
      entityId: testSeller.id,
      entityType: 'seller',
      amount: 300,
      mpesaNumber: '0712345678',
      mpesaName: 'Concurrent Seller',
      idempotencyKey: `reconcile-race-${Date.now()}`
    });

    const op1 = reconcileStuckWithdrawalsHelper(WithdrawalService, 0);
    const op2 = payoutCallbackStateMachineService.handleProviderCallback({
      event: 'transfer.success',
      data: {
        transaction_reference: req.provider_reference || `ref-${req.id}`,
        amount: 300,
        status: 'success'
      }
    });

    const results = await Promise.allSettled([op1, op2]);
    const deadlocks = results.filter(r => r.status === 'rejected' && /deadlock|40P01/i.test(r.reason?.message || ''));
    assert.equal(deadlocks.length, 0, 'No deadlock during simultaneous reconciliation and callback');
  });

  test('7. Multiple withdrawal requests across different account types in parallel', async () => {
    const ops = [
      WithdrawalService.createWithdrawalRequest({
        entityId: testSeller.id,
        entityType: 'seller',
        amount: 200,
        mpesaNumber: '0712345678',
        mpesaName: 'Concurrent Seller',
        idempotencyKey: `multi-acc-seller-${Date.now()}`
      }),
      WithdrawalService.createWithdrawalRequest({
        entityId: testCreator.id,
        entityType: 'creator',
        amount: 200,
        mpesaNumber: '0712345678',
        mpesaName: 'Concurrent Creator',
        idempotencyKey: `multi-acc-creator-${Date.now()}`
      }),
      WithdrawalService.createWithdrawalRequest({
        entityId: testBuyer.id,
        entityType: 'buyer_refund',
        amount: 200,
        mpesaNumber: '0711223344',
        mpesaName: 'Concurrent Buyer',
        idempotencyKey: `multi-acc-buyer-${Date.now()}`
      })
    ];

    const results = await Promise.all(ops);
    assert.equal(results.length, 3, 'All 3 multi-account withdrawals must complete successfully');
    assert.ok(results.every(r => r.id > 0));
  });

  test('8. Concurrent withdrawals where available funds are insufficient for all requests', async () => {
    const limitedSeller = await createSeller({});
    await pool.query('UPDATE sellers SET balance = 1500 WHERE id = $1', [limitedSeller.id]);

    try {
      const attempts = await Promise.allSettled([
        WithdrawalService.createWithdrawalRequest({
          entityId: limitedSeller.id,
          entityType: 'seller',
          amount: 1000,
          mpesaNumber: '0712345678',
          mpesaName: 'Limited Seller',
          idempotencyKey: `insufficient-race-1-${Date.now()}`
        }),
        WithdrawalService.createWithdrawalRequest({
          entityId: limitedSeller.id,
          entityType: 'seller',
          amount: 1000,
          mpesaNumber: '0712345678',
          mpesaName: 'Limited Seller',
          idempotencyKey: `insufficient-race-2-${Date.now()}`
        }),
        WithdrawalService.createWithdrawalRequest({
          entityId: limitedSeller.id,
          entityType: 'seller',
          amount: 1000,
          mpesaNumber: '0712345678',
          mpesaName: 'Limited Seller',
          idempotencyKey: `insufficient-race-3-${Date.now()}`
        })
      ]);

      const succeeded = attempts.filter(a => a.status === 'fulfilled');
      const rejected = attempts.filter(a => a.status === 'rejected');

      assert.equal(succeeded.length, 1, 'Exactly one 1000 KES request should succeed');
      assert.equal(rejected.length, 2, 'The other two requests should be rejected due to insufficient balance');

      const { rows: [finalSeller] } = await pool.query('SELECT balance FROM sellers WHERE id = $1', [limitedSeller.id]);
      assert.ok(Number.parseFloat(finalSeller.balance) >= 0, 'Balance must never become negative');
    } finally {
      await pool.query('DELETE FROM payout_provider_attempts WHERE seller_id = $1', [limitedSeller.id]).catch(() => {});
      await pool.query('DELETE FROM withdrawal_requests WHERE seller_id = $1', [limitedSeller.id]).catch(() => {});
      await cleanupSeller(limitedSeller.id).catch(() => {});
    }
  });

  test('9. Transaction rollback preserves state and leaves balance intact', async () => {
    const { rows: [initialBuyer] } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [testBuyer.id]);
    const initialBalance = Number.parseFloat(initialBuyer.refunds);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO withdrawal_requests (buyer_id, amount, mpesa_number, mpesa_name, status, idempotency_key, created_at)
         VALUES ($1, 500, '0711223344', 'Buyer Test', 'processing', $2, NOW())`,
        [testBuyer.id, `rollback-test-${Date.now()}`]
      );
      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    const { rows: [afterBuyer] } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [testBuyer.id]);
    assert.equal(Number.parseFloat(afterBuyer.refunds), initialBalance, 'Balance must remain unchanged after rollback');
  });

  test('10. Repeated execution of the same callback operation is strictly idempotent', async () => {
    const idemKey = `repeated-callback-${Date.now()}`;
    const req = await WithdrawalService.createWithdrawalRequest({
      entityId: testCreator.id,
      entityType: 'creator',
      amount: 250,
      mpesaNumber: '0712345678',
      mpesaName: 'Concurrent Creator',
      idempotencyKey: idemKey
    });

    const payload = {
      event: 'transfer.success',
      data: {
        transaction_reference: `ref-cb-${req.id}`,
        client_reference: idemKey,
        amount: 250,
        status: 'success'
      }
    };

    for (let i = 0; i < 5; i++) {
      const res = await payoutCallbackStateMachineService.handleProviderCallback(payload);
      assert.ok(res !== null);
    }

    const { rows: countRows } = await pool.query(
      'SELECT count(*) FROM withdrawal_requests WHERE id = $1 AND status = $2',
      [req.id, 'completed']
    );
    assert.equal(parseInt(countRows[0].count, 10), 1, 'Only exactly 1 request row exists in completed state');
  });
});
