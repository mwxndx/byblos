/**
 * gate3-financial-workflows.journey.test.js
 *
 * GATE 3: Financial Workflows End-to-End Business Journey
 *
 * Verifies:
 *   1. Affiliate & Creator Referral Attribution (Commission derivation, self-referral prevention, escrow crediting)
 *   2. Financial Precision & Fee Calculation (Tiered withdrawal fee, limits, service charges)
 *   3. Balance Deductions, Holds & Idempotency (Atomic balance reserve, idempotent replay, overdraft protection)
 *   4. Concurrent Withdrawal Race Condition Prevention (Row locking, zero double-spend guarantee)
 *   5. Provider Callback Reconciliation & Refund Recovery (Terminal success reserve clearing, terminal failure wallet refund)
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MOCK_PAYSTACK_PORT = 3105;
process.env.PAYSTACK_BASE_URL = `http://127.0.0.1:${MOCK_PAYSTACK_PORT}`;
process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_secret_key_for_testing';
process.env.PAYOUT_PROVIDER = 'paystack';

import { pool } from '../../src/infrastructure/database/database.js';
import CreatorService from '../../src/domains/growth/creators/creator.service.js';
import withdrawalService from '../../src/domains/payments/withdrawals/withdrawal.service.js';
import payoutCallbackStateMachineService from '../../src/domains/payments/payouts/payoutCallbackStateMachine.service.js';
import escrowManager from '../../src/domains/orders/escrow/EscrowManager.js';
import Fees from '../../src/shared/config/fees.js';
import {
  createUser,
  createBuyer,
  createSeller,
  createCreator,
  createSellerCreatorLink,
  createCompletedOrder,
  cleanupOrder,
  cleanupSeller,
  cleanupBuyer,
  cleanupUser,
  cleanupCreator
} from '../helpers/factories.js';

let mockHttpServer;
const createdUserIds = [];
const createdSellerIds = [];
const createdBuyerIds = [];
const createdCreatorIds = [];
const createdOrderIds = [];
const createdWithdrawalIds = [];

before(async () => {
  mockHttpServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url.includes('/transferrecipient')) {
        res.end(JSON.stringify({ status: true, message: 'Recipient created', data: { recipient_code: 'RCP_mock_gate3' } }));
      } else if (req.url.includes('/transfer')) {
        let reference = 'trf-ref-gate3';
        try {
          reference = JSON.parse(body).reference || reference;
        } catch { /* use default */ }
        res.end(JSON.stringify({
          status: true,
          message: 'Transfer queued',
          data: {
            transfer_code: 'TRF_mock_gate3',
            reference,
            status: 'success'
          }
        }));
      } else {
        res.end(JSON.stringify({ status: true, data: {} }));
      }
    });
  });

  await new Promise((resolve) => mockHttpServer.listen(MOCK_PAYSTACK_PORT, '127.0.0.1', resolve));
});

after(async () => {
  if (mockHttpServer) {
    await new Promise((resolve) => mockHttpServer.close(resolve));
  }

  // Cleanup created withdrawal records
  if (createdWithdrawalIds.length > 0) {
    await pool.query('DELETE FROM payout_provider_attempts WHERE withdrawal_request_id = ANY($1)', [createdWithdrawalIds]);
    await pool.query('DELETE FROM withdrawal_requests WHERE id = ANY($1)', [createdWithdrawalIds]);
  }

  // Cleanup created orders
  for (const orderId of createdOrderIds) {
    await cleanupOrder(orderId).catch(() => {});
  }

  // Cleanup creator links and creators
  for (const creatorId of createdCreatorIds) {
    await cleanupCreator(creatorId).catch(() => {});
  }

  // Cleanup sellers
  for (const sellerId of createdSellerIds) {
    await pool.query('DELETE FROM payouts WHERE seller_id = $1', [sellerId]).catch(() => {});
    await pool.query('DELETE FROM withdrawal_requests WHERE seller_id = $1', [sellerId]).catch(() => {});
    await cleanupSeller(sellerId).catch(() => {});
  }

  // Cleanup buyers
  for (const buyerId of createdBuyerIds) {
    await pool.query('DELETE FROM withdrawal_requests WHERE buyer_id = $1', [buyerId]).catch(() => {});
    await cleanupBuyer(buyerId).catch(() => {});
  }

  // Cleanup users
  for (const userId of createdUserIds) {
    await cleanupUser(userId).catch(() => {});
  }
});

describe('GATE 3: Financial Workflows Business Journey', () => {
  let seller;
  let creatorUser;
  let creator;
  let buyer;
  let link;

  test('Setup: seed seller, creator, buyer, and affiliate link', async () => {
    // 1. Create seller
    const sUser = await createUser({ email: `gate3_seller_${Date.now()}@test.byblos.local` });
    createdUserIds.push(sUser.id);
    seller = await createSeller({ userId: sUser.id, shopName: 'Gate3 Shop' });
    createdSellerIds.push(seller.id);

    // 2. Create creator with authenticated user
    creatorUser = await createUser({ email: `gate3_creator_${Date.now()}@test.byblos.local` });
    createdUserIds.push(creatorUser.id);
    creator = await createCreator({
      userId: creatorUser.id,
      email: creatorUser.email,
      mpesaNumber: '254711998877',
      firstName: 'Sarah',
      lastName: 'Affiliate'
    });
    createdCreatorIds.push(creator.id);

    // 3. Create independent buyer
    const bUser = await createUser({ email: `gate3_buyer_${Date.now()}@test.byblos.local` });
    createdUserIds.push(bUser.id);
    buyer = await createBuyer({
      userId: bUser.id,
      fullName: 'Alice Buyer',
      mobilePayment: '254722334455'
    });
    createdBuyerIds.push(buyer.id);

    // 4. Create active affiliate link with 10% commission
    link = await createSellerCreatorLink({
      sellerId: seller.id,
      creatorId: creator.id,
      commissionRate: 0.10
    });

    assert.ok(seller.id);
    assert.ok(creator.id);
    assert.ok(buyer.id);
    assert.ok(link.code);
    assert.equal(Number(link.commission_rate), 0.10);
  });

  // ---------------------------------------------------------------------------
  // 1. Affiliate & Creator Referral Attribution
  // ---------------------------------------------------------------------------
  describe('1. Affiliate & Creator Referral Attribution', () => {
    test('Resolves valid creator code and computes accurate commission', async () => {
      const subtotal = 3000;
      const attribution = await CreatorService.resolveAttribution({
        code: link.code,
        sellerId: seller.id,
        productSubtotal: subtotal,
        buyer
      });

      assert.ok(attribution, 'Attribution must be resolved for active code and matching seller');
      assert.equal(attribution.creator_id, creator.id);
      assert.equal(attribution.seller_id, seller.id);
      assert.equal(attribution.commission_rate, 0.10);
      assert.equal(attribution.commission_base_amount, 3000);
      assert.equal(attribution.commission_amount, 300, '10% of 3000 is 300');
    });

    test('Self-referral prevention: creator cannot earn commission on their own purchase', async () => {
      // Buyer has the same userId / email / phone as the creator
      const selfBuyer = {
        id: buyer.id,
        userId: creatorUser.id,
        creatorId: creator.id,
        email: creatorUser.email,
        phone: creator.mpesa_number
      };

      const attribution = await CreatorService.resolveAttribution({
        code: link.code,
        sellerId: seller.id,
        productSubtotal: 3000,
        buyer: selfBuyer
      });

      assert.equal(attribution, null, 'Self-referral must return null and block commission');
    });

    test('Escrow release credits creator earnings and updates balance idempotently', async () => {
      const initialCreator = (await pool.query('SELECT balance, total_earnings, total_sales FROM creators WHERE id = $1', [creator.id])).rows[0];
      const initialBalance = Number(initialCreator.balance || 0);

      const order = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 3200,
        sellerPayoutAmount: 2700,
        platformFeeAmount: 10,
        metadata: {
          creator_attribution: {
            code: link.code,
            creator_id: creator.id,
            seller_creator_link_id: link.id,
            seller_id: seller.id,
            commission_rate: 0.10,
            commission_base_amount: 3000,
            commission_amount: 300
          }
        }
      });
      createdOrderIds.push(order.id);

      // Release escrow via EscrowManager
      const releaseClient = await pool.connect();
      try {
        await releaseClient.query('BEGIN');
        const releaseRes = await escrowManager.releaseFunds(releaseClient, order, 'TestJourney');
        assert.ok(releaseRes.success, 'Escrow release must succeed');
        await releaseClient.query('COMMIT');
      } catch (err) {
        await releaseClient.query('ROLLBACK');
        throw err;
      } finally {
        releaseClient.release();
      }

      // Verify creator earning record was inserted
      const { rows: earningRows } = await pool.query(
        'SELECT * FROM creator_earnings WHERE order_id = $1 AND creator_id = $2',
        [order.id, creator.id]
      );
      assert.equal(earningRows.length, 1, 'Creator earning record must exist');
      assert.equal(Number(earningRows[0].amount), 300);
      assert.equal(Number(earningRows[0].rate), 0.10);

      // Verify creator balance updated
      const { rows: updatedCreator } = await pool.query(
        'SELECT balance, total_earnings, total_sales FROM creators WHERE id = $1',
        [creator.id]
      );
      assert.equal(Number(updatedCreator[0].balance), initialBalance + 300, 'Creator balance must be credited by 300');
      assert.equal(Number(updatedCreator[0].total_earnings), Number(initialCreator.total_earnings || 0) + 300);
      assert.equal(Number(updatedCreator[0].total_sales), Number(initialCreator.total_sales || 0) + 1);

      // Idempotency: re-running credit for the same order must not duplicate earnings
      const retryClient = await pool.connect();
      try {
        await retryClient.query('BEGIN');
        const dupResult = await CreatorService.creditCreatorForOrder(retryClient, { order, paymentId: null });
        assert.equal(dupResult, null, 'Duplicate order credit must be ignored');
        await retryClient.query('COMMIT');
      } finally {
        retryClient.release();
      }

      // Check balance is STILL initial + 300 (no double credit)
      const { rows: verifyNoDup } = await pool.query('SELECT balance FROM creators WHERE id = $1', [creator.id]);
      assert.equal(Number(verifyNoDup[0].balance), initialBalance + 300, 'Creator balance must not be credited twice');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Financial Precision & Fee Calculation Rules
  // ---------------------------------------------------------------------------
  describe('2. Financial Precision & Fee Calculation Rules', () => {
    test('Tiered withdrawal fees adhere strictly to published schedule', () => {
      assert.equal(Fees.calculateWithdrawalFee(50), 21, 'KES 50 is in tier 1 (fee 21)');
      assert.equal(Fees.calculateWithdrawalFee(1000), 21, 'KES 1,000 is in tier 1 (fee 21)');
      assert.equal(Fees.calculateWithdrawalFee(1500), 21, 'KES 1,500 boundary is in tier 1 (fee 21)');
      assert.equal(Fees.calculateWithdrawalFee(1501), 45, 'KES 1,501 is in tier 2 (fee 45)');
      assert.equal(Fees.calculateWithdrawalFee(10000), 45, 'KES 10,000 is in tier 2 (fee 45)');
      assert.equal(Fees.calculateWithdrawalFee(19999.99), 45, 'KES 19,999.99 boundary is in tier 2 (fee 45)');
      assert.equal(Fees.calculateWithdrawalFee(20000), 63, 'KES 20,000 is in tier 3 (fee 63)');
      assert.equal(Fees.calculateWithdrawalFee(50000), 63, 'KES 50,000 is in tier 3 (fee 63)');
    });

    test('Enforces minimum and maximum withdrawal boundaries', async () => {
      // Sub-minimum
      await assert.rejects(
        () => withdrawalService.createWithdrawalRequest({
          entityId: seller.id,
          entityType: 'seller',
          amount: 20,
          mpesaNumber: '0712345678',
          mpesaName: 'Seller Name',
          idempotencyKey: `sub-min-${Date.now()}`
        }),
        /Minimum withdrawal amount is KES 50/i
      );

      // Above maximum (250,000)
      await assert.rejects(
        () => withdrawalService.createWithdrawalRequest({
          entityId: seller.id,
          entityType: 'seller',
          amount: 300000,
          mpesaNumber: '0712345678',
          mpesaName: 'Seller Name',
          idempotencyKey: `over-max-${Date.now()}`
        }),
        /Maximum withdrawal amount is KES 250,000/i
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Balance Deductions, Holds & Idempotency
  // ---------------------------------------------------------------------------
  describe('3. Balance Deductions, Holds & Idempotency', () => {
    test('Withdrawal atomically deducts balance, reserves funds, and records request', async () => {
      // Seed seller with available balance of KES 5,000
      await pool.query('UPDATE sellers SET balance = 5000, withdrawal_reserved_balance = 0 WHERE id = $1', [seller.id]);

      const idempotencyKey = `journey-withdraw-seller-${Date.now()}`;
      const amount = 1000;
      const expectedFee = Fees.calculateWithdrawalFee(amount); // 21
      const totalDeduction = amount + expectedFee; // 1021

      const request = await withdrawalService.createWithdrawalRequest({
        entityId: seller.id,
        entityType: 'seller',
        amount,
        mpesaNumber: '0712345678',
        mpesaName: 'Test Seller',
        idempotencyKey
      });
      createdWithdrawalIds.push(request.id);

      assert.ok(request.id, 'Withdrawal request must be created');
      assert.equal(Number(request.amount), 1000);

      // Verify seller database state
      const { rows: sellerRows } = await pool.query(
        'SELECT balance, withdrawal_reserved_balance FROM sellers WHERE id = $1',
        [seller.id]
      );
      assert.equal(Number(sellerRows[0].balance), 5000 - totalDeduction, 'Balance must be deducted by amount + fee');
      assert.equal(Number(sellerRows[0].withdrawal_reserved_balance), totalDeduction, 'Reserved balance must be credited by total deduction');

      // Replay same request with identical idempotency key -> returns existing without double deduction
      const replay = await withdrawalService.createWithdrawalRequest({
        entityId: seller.id,
        entityType: 'seller',
        amount,
        mpesaNumber: '0712345678',
        mpesaName: 'Test Seller',
        idempotencyKey
      });

      assert.equal(replay.id, request.id, 'Must return the same withdrawal request for identical idempotency key');

      const { rows: postReplayRows } = await pool.query(
        'SELECT balance, withdrawal_reserved_balance FROM sellers WHERE id = $1',
        [seller.id]
      );
      assert.equal(Number(postReplayRows[0].balance), 5000 - totalDeduction, 'Replay must NOT deduct balance again');
    });

    test('Rejects withdrawal if requested amount + fee exceeds available balance', async () => {
      // Current available balance is 3,979
      await assert.rejects(
        () => withdrawalService.createWithdrawalRequest({
          entityId: seller.id,
          entityType: 'seller',
          amount: 4500,
          mpesaNumber: '0712345678',
          mpesaName: 'Test Seller',
          idempotencyKey: `insufficient-${Date.now()}`
        }),
        /Insufficient balance/i
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Concurrent Withdrawal Race Condition Prevention
  // ---------------------------------------------------------------------------
  describe('4. Concurrent Withdrawal Race Condition Prevention', () => {
    test('Simultaneous withdrawal requests cannot double-drain balance (row locking guard)', async () => {
      // Seed seller with EXACTLY KES 1,000 balance
      const freshSeller = await createSeller({ shopName: 'Race Seller' });
      createdSellerIds.push(freshSeller.id);
      await pool.query('UPDATE sellers SET balance = 1000, withdrawal_reserved_balance = 0 WHERE id = $1', [freshSeller.id]);

      // Two requests for KES 600 each.
      // Each requires 600 + 21 = 621 deduction.
      // Combined they require 1,242 > 1,000.
      // Under row locking (FOR UPDATE), exactly one MUST succeed and the second MUST fail with Insufficient balance.
      const req1 = withdrawalService.createWithdrawalRequest({
        entityId: freshSeller.id,
        entityType: 'seller',
        amount: 600,
        mpesaNumber: '0712345678',
        mpesaName: 'Race Seller',
        idempotencyKey: `concurrent-1-${Date.now()}`
      });

      const req2 = withdrawalService.createWithdrawalRequest({
        entityId: freshSeller.id,
        entityType: 'seller',
        amount: 600,
        mpesaNumber: '0712345678',
        mpesaName: 'Race Seller',
        idempotencyKey: `concurrent-2-${Date.now()}`
      });

      const results = await Promise.allSettled([req1, req2]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, 'Exactly one concurrent withdrawal request must succeed');
      assert.equal(rejected.length, 1, 'The competing concurrent withdrawal request must be rejected');
      assert.match(rejected[0].reason.message, /Insufficient balance/i);

      createdWithdrawalIds.push(fulfilled[0].value.id);

      // Inspect persisted database invariants
      const { rows } = await pool.query(
        'SELECT balance, withdrawal_reserved_balance FROM sellers WHERE id = $1',
        [freshSeller.id]
      );
      assert.equal(Number(rows[0].balance), 1000 - 621, 'Remaining balance must be 379');
      assert.equal(Number(rows[0].withdrawal_reserved_balance), 621, 'Reserved balance must be exactly 621');
      assert.ok(Number(rows[0].balance) >= 0, 'Balance must never go negative');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Provider Callback Reconciliation & Refund Recovery
  // ---------------------------------------------------------------------------
  describe('5. Provider Callback Reconciliation & Refund Recovery', () => {
    test('Successful provider callback marks request completed and clears reserved balance', async () => {
      // 1. Create a withdrawal request in processing status
      const testSeller = await createSeller({ shopName: 'Callback Success Seller' });
      createdSellerIds.push(testSeller.id);
      await pool.query('UPDATE sellers SET balance = 2000, withdrawal_reserved_balance = 0 WHERE id = $1', [testSeller.id]);

      const idempotencyKey = `success-cb-${Date.now()}`;
      const request = await withdrawalService.createWithdrawalRequest({
        entityId: testSeller.id,
        entityType: 'seller',
        amount: 500,
        mpesaNumber: '0712345678',
        mpesaName: 'Callback Seller',
        idempotencyKey
      });
      createdWithdrawalIds.push(request.id);

      // Force status to processing with a distinct provider_reference
      const providerRef = `PROV-SUCC-${Date.now()}`;
      await pool.query(
        `UPDATE withdrawal_requests SET status = 'processing', provider_reference = $1 WHERE id = $2`,
        [providerRef, request.id]
      );

      // 2. Simulate provider callback indicating successful transfer
      const callbackResult = await payoutCallbackStateMachineService.handleProviderCallback({
        status: 'success',
        transaction_reference: providerRef,
        amount: 500,
        mpesa_receipt: 'QWE123RTY',
        remarks: 'Transfer completed successfully'
      });

      assert.equal(callbackResult.withdrawalId, request.id);

      // 3. Verify withdrawal request status is completed
      const { rows: reqRows } = await pool.query('SELECT status, mpesa_receipt FROM withdrawal_requests WHERE id = $1', [request.id]);
      assert.equal(reqRows[0].status, 'completed');
      assert.equal(reqRows[0].mpesa_receipt, 'QWE123RTY');

      // 4. Verify reserved balance was cleared
      const { rows: sellerRows } = await pool.query('SELECT withdrawal_reserved_balance FROM sellers WHERE id = $1', [testSeller.id]);
      assert.equal(Number(sellerRows[0].withdrawal_reserved_balance), 0, 'Reserved balance must be cleared upon successful completion');
    });

    test('Failed provider callback marks request failed and restores reserved funds to balance', async () => {
      // 1. Create a withdrawal request
      const testSeller = await createSeller({ shopName: 'Callback Failure Seller' });
      createdSellerIds.push(testSeller.id);
      await pool.query('UPDATE sellers SET balance = 2000, withdrawal_reserved_balance = 0 WHERE id = $1', [testSeller.id]);

      const idempotencyKey = `fail-cb-${Date.now()}`;
      const request = await withdrawalService.createWithdrawalRequest({
        entityId: testSeller.id,
        entityType: 'seller',
        amount: 500,
        mpesaNumber: '0712345678',
        mpesaName: 'Callback Seller',
        idempotencyKey
      });
      createdWithdrawalIds.push(request.id);

      const providerRef = `PROV-FAIL-${Date.now()}`;
      await pool.query(
        `UPDATE withdrawal_requests SET status = 'processing', provider_reference = $1 WHERE id = $2`,
        [providerRef, request.id]
      );

      // Balance before callback failure: 2000 - 521 = 1479, reserved: 521
      const preCheck = (await pool.query('SELECT balance, withdrawal_reserved_balance FROM sellers WHERE id = $1', [testSeller.id])).rows[0];
      assert.equal(Number(preCheck.balance), 1479);
      assert.equal(Number(preCheck.withdrawal_reserved_balance), 521);

      // 2. Simulate provider callback indicating failed transfer
      const callbackResult = await payoutCallbackStateMachineService.handleProviderCallback({
        status: 'failed',
        transaction_reference: providerRef,
        amount: 500,
        remarks: 'M-Pesa recipient phone unreachable'
      });

      assert.equal(callbackResult.withdrawalId, request.id);

      // 3. Verify withdrawal request status is failed
      const { rows: reqRows } = await pool.query('SELECT status FROM withdrawal_requests WHERE id = $1', [request.id]);
      assert.equal(reqRows[0].status, 'failed');

      // 4. Verify funds are restored from reserved balance back to available balance
      const { rows: sellerRows } = await pool.query('SELECT balance, withdrawal_reserved_balance FROM sellers WHERE id = $1', [testSeller.id]);
      assert.equal(Number(sellerRows[0].balance), 2000, 'Balance must be restored to original 2,000');
      assert.equal(Number(sellerRows[0].withdrawal_reserved_balance), 0, 'Reserved balance must be zeroed');
    });
  });
});
