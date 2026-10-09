import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RefundPolicyService, REFUND_POLICY_CONSTANTS } from '../src/domains/payments/refunds/refundPolicy.service.js';

describe('RefundPolicyService.evaluatePolicyRules', () => {
  const policyService = new RefundPolicyService();

  test('auto-approves late payment on unfulfilled/cancelled order', () => {
    const evaluation = policyService.evaluatePolicyRules({
      order: { id: 101, status: 'CANCELLED' },
      amount: 1200,
      reason: 'late_payment_on_cancelled_order',
      payout: { status: 'pending', settlement_status: 'pending' },
      buyerPastRefundCount: 0
    });

    assert.equal(evaluation.decision, 'AUTO_APPROVE');
    assert.match(evaluation.reason, /Late payment received for unfulfilled cancelled order/i);
    assert.equal(evaluation.policyVersion, REFUND_POLICY_CONSTANTS.POLICY_VERSION);
  });

  test('auto-approves late payment on expired order even if amount > 1500 (since goods never moved)', () => {
    const evaluation = policyService.evaluatePolicyRules({
      order: { id: 102, status: 'EXPIRED' },
      amount: 5000,
      reason: 'late_payment_on_cancelled_order',
      payout: null,
      buyerPastRefundCount: 0
    });

    assert.equal(evaluation.decision, 'AUTO_APPROVE');
    assert.match(evaluation.reason, /Late payment received for unfulfilled cancelled order/i);
  });

  test('routes late payment to manual review if seller payout already disbursed', () => {
    const evaluation = policyService.evaluatePolicyRules({
      order: { id: 103, status: 'CANCELLED' },
      amount: 1000,
      reason: 'late_payment_on_cancelled_order',
      payout: { status: 'completed', settlement_status: 'settled' },
      buyerPastRefundCount: 0
    });

    assert.equal(evaluation.decision, 'MANUAL_REVIEW');
    assert.match(evaluation.reason, /Seller payout has already settled/i);
  });

  test('routes to manual review if order is IN_TRANSIT or DELIVERED (RMA required)', () => {
    const evaluation = policyService.evaluatePolicyRules({
      order: { id: 104, status: 'IN_TRANSIT' },
      amount: 500,
      reason: 'buyer_requested_return',
      payout: null,
      buyerPastRefundCount: 0
    });

    assert.equal(evaluation.decision, 'MANUAL_REVIEW');
    assert.match(evaluation.reason, /requires physical return and RMA inspection/i);
  });

  test('routes to manual review if amount exceeds MAX_AUTO_REFUND_AMOUNT for normal refund', () => {
    const evaluation = policyService.evaluatePolicyRules({
      order: { id: 105, status: 'CREATED' },
      amount: 2500,
      reason: 'buyer_cancellation',
      payout: null,
      buyerPastRefundCount: 0
    });

    assert.equal(evaluation.decision, 'MANUAL_REVIEW');
    assert.match(evaluation.reason, /exceeds auto-approval ceiling/i);
  });

  test('routes to manual review if buyer has reached monthly velocity limit', () => {
    const evaluation = policyService.evaluatePolicyRules({
      order: { id: 106, status: 'CREATED' },
      amount: 800,
      reason: 'buyer_cancellation',
      payout: null,
      buyerPastRefundCount: 2 // Maximum is 2
    });

    assert.equal(evaluation.decision, 'MANUAL_REVIEW');
    assert.match(evaluation.reason, /Buyer refund velocity threshold reached/i);
  });

  test('auto-approves low-value pre-fulfillment order cancellation within thresholds', () => {
    const evaluation = policyService.evaluatePolicyRules({
      order: { id: 107, status: 'CREATED' },
      amount: 800,
      reason: 'buyer_cancellation',
      payout: { status: 'pending', settlement_status: 'pending' },
      buyerPastRefundCount: 1
    });

    assert.equal(evaluation.decision, 'AUTO_APPROVE');
    assert.match(evaluation.reason, /Low-value unfulfilled order within standard risk thresholds/i);
  });
});
