import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  providerPayloadIndicatesSuccess,
  providerPayloadIndicatesFailure
} from '../src/domains/payments/payouts/payoutCallbackStateMachine.service.js';
import { reconcileStuckWithdrawalsHelper } from '../src/domains/payments/withdrawals/withdrawalReconciliationHelper.js';
import withdrawalService from '../src/domains/payments/withdrawals/withdrawal.service.js';
import payoutService from '../src/domains/payments/payouts/payout.service.js';
import { pool } from '../src/infrastructure/database/database.js';

describe('Payout Status Indicators & Reconciliation Hardening', () => {
  test('providerPayloadIndicatesSuccess handles Paystack raw wrapper and normalized payloads', () => {
    // 1. Paystack raw GET /transfer/verify/:reference response
    const rawPaystackSuccess = {
      status: true,
      message: 'Transfer retrieved',
      data: {
        amount: 50000,
        currency: 'KES',
        status: 'success',
        transfer_code: 'TRF_TEST_123'
      }
    };
    assert.equal(
      providerPayloadIndicatesSuccess(rawPaystackSuccess),
      true,
      'Raw Paystack verify payload with data.status="success" must indicate success'
    );

    // 2. Normalized transfer client payload
    const normalizedSuccess = {
      success: true,
      status: 'success',
      amount: 500,
      data: { status: 'success' }
    };
    assert.equal(
      providerPayloadIndicatesSuccess(normalizedSuccess),
      true,
      'Normalized success payload must indicate success'
    );

    // 3. Flat status success
    assert.equal(providerPayloadIndicatesSuccess({ status: 'completed' }), true);
    assert.equal(providerPayloadIndicatesSuccess({ status: 'paid' }), true);
    assert.equal(providerPayloadIndicatesSuccess({ result_code: 0 }), true);

    // 4. Failure should NOT indicate success
    const rawPaystackFailed = {
      status: true,
      message: 'Transfer failed',
      data: {
        amount: 50000,
        status: 'failed',
        transfer_code: 'TRF_TEST_FAILED'
      }
    };
    assert.equal(providerPayloadIndicatesSuccess(rawPaystackFailed), false);
  });

  test('providerPayloadIndicatesFailure handles Paystack raw wrapper and normalized payloads', () => {
    const rawPaystackFailed = {
      status: true,
      message: 'Transfer failed',
      data: {
        amount: 50000,
        currency: 'KES',
        status: 'failed',
        transfer_code: 'TRF_TEST_FAILED'
      }
    };
    assert.equal(
      providerPayloadIndicatesFailure(rawPaystackFailed),
      true,
      'Raw Paystack verify payload with data.status="failed" must indicate failure'
    );

    const rawPaystackReversed = {
      status: true,
      data: { status: 'reversed' }
    };
    assert.equal(providerPayloadIndicatesFailure(rawPaystackReversed), true);
  });

  test('reconcileStuckWithdrawalsHelper completes stuck processing withdrawal with Paystack raw response', async () => {
    // Setup test seller
    const sellerRes = await pool.query(
      `INSERT INTO sellers (shop_name, full_name, email, whatsapp_number, balance, withdrawal_reserved_balance, status)
       VALUES ($1, $2, $3, $4, 0, 521, 'active')
       RETURNING id`,
      [`Shop-${Date.now()}`, 'Reconcile Seller', `reconcile-${Date.now()}@test.com`, '+254712345678']
    );
    const sellerId = sellerRes.rows[0].id;

    // Insert stuck withdrawal request created 3 hours ago
    const ref = `reconcile-test-${Date.now()}`;
    const wrRes = await pool.query(
      `INSERT INTO withdrawal_requests 
         (seller_id, amount, mpesa_number, mpesa_name, status, provider_reference, api_call_pending, idempotency_key, metadata, created_at)
       VALUES ($1, 500, '+254712345678', 'Reconcile Seller', 'processing', $2, FALSE, $3, $4::jsonb, NOW() - INTERVAL '3 hours')
       RETURNING id`,
      [sellerId, ref, `idem-${ref}`, JSON.stringify({ withdrawal_fee: 21, total_deducted: 521 })]
    );
    const withdrawalId = wrRes.rows[0].id;

    // Mock payoutService.checkPayoutStatus to return Paystack verification format
    const origCheckPayoutStatus = payoutService.checkPayoutStatus;
    payoutService.checkPayoutStatus = async (reference) => ({
      success: true,
      status: 'success',
      reference,
      amount: 500,
      transfer_code: 'TRF_MOCK_RECONCILE',
      mpesa_receipt: 'TRF_MOCK_RECONCILE',
      raw_response: {
        status: true,
        message: 'Transfer retrieved',
        data: {
          recipient: 12345,
          amount: 50000,
          currency: 'KES',
          status: 'success',
          transfer_code: 'TRF_MOCK_RECONCILE'
        }
      }
    });

    try {
      await reconcileStuckWithdrawalsHelper(withdrawalService, 2);

      // Verify withdrawal request is now completed and has mpesa_receipt
      const { rows: [updatedWr] } = await pool.query(
        'SELECT status, mpesa_receipt, metadata FROM withdrawal_requests WHERE id = $1',
        [withdrawalId]
      );
      assert.equal(updatedWr.status, 'completed', 'Withdrawal must transition to completed');
      assert.equal(updatedWr.mpesa_receipt, 'TRF_MOCK_RECONCILE', 'M-Pesa receipt must be populated');
      assert.equal(
        updatedWr.metadata?.reconciliation_flag,
        undefined,
        'Must NOT set needs_manual_review when provider succeeds'
      );

      // Verify seller reserved balance was cleared
      const { rows: [updatedSeller] } = await pool.query(
        'SELECT withdrawal_reserved_balance FROM sellers WHERE id = $1',
        [sellerId]
      );
      assert.equal(
        Number(updatedSeller.withdrawal_reserved_balance),
        0,
        'Seller reserved balance must be cleared to 0'
      );
    } finally {
      payoutService.checkPayoutStatus = origCheckPayoutStatus;
    }
  });

  test('_callProviderAndUpdate immediately completes withdrawal if provider returns synchronous success', async () => {
    // Setup test seller
    const sellerRes = await pool.query(
      `INSERT INTO sellers (shop_name, full_name, email, whatsapp_number, balance, withdrawal_reserved_balance, status)
       VALUES ($1, $2, $3, $4, 0, 521, 'active')
       RETURNING id`,
      [`ShopSync-${Date.now()}`, 'Sync Seller', `sync-${Date.now()}@test.com`, '+254712345679']
    );
    const sellerId = sellerRes.rows[0].id;

    // Create withdrawal request
    const ref = `sync-test-${Date.now()}`;
    const wrRes = await pool.query(
      `INSERT INTO withdrawal_requests 
         (seller_id, amount, mpesa_number, mpesa_name, status, api_call_pending, idempotency_key, metadata, created_at)
       VALUES ($1, 500, '+254712345679', 'Sync Seller', 'processing', TRUE, $2, $3::jsonb, NOW())
       RETURNING *`,
      [sellerId, `idem-${ref}`, JSON.stringify({ withdrawal_fee: 21, total_deducted: 521 })]
    );
    const request = wrRes.rows[0];

    const origInitiatePayout = payoutService.initiatePayout;
    payoutService.initiatePayout = async () => ({
      success: true,
      status: 'success',
      reference: ref,
      correlator_id: ref,
      transfer_code: 'TRF_SYNC_123',
      mpesa_receipt: 'TRF_SYNC_123',
      amount: 500,
      message: 'Transfer successful'
    });

    try {
      await withdrawalService._callProviderAndUpdate(
        request,
        { id: sellerId, entity_type: 'seller' },
        500,
        '+254712345679'
      );

      // Verify request is completed immediately, not stuck in processing
      const { rows: [updatedWr] } = await pool.query(
        'SELECT status, mpesa_receipt, provider_reference FROM withdrawal_requests WHERE id = $1',
        [request.id]
      );
      assert.equal(updatedWr.status, 'completed', 'Withdrawal must be completed immediately upon synchronous success');
      assert.equal(updatedWr.mpesa_receipt, 'TRF_SYNC_123');

      // Verify seller reserved balance was cleared immediately
      const { rows: [updatedSeller] } = await pool.query(
        'SELECT withdrawal_reserved_balance FROM sellers WHERE id = $1',
        [sellerId]
      );
      assert.equal(Number(updatedSeller.withdrawal_reserved_balance), 0);
    } finally {
      payoutService.initiatePayout = origInitiatePayout;
    }
  });
});

