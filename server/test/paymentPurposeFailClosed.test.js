import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PaymentPurpose,
  extractPaymentPurpose,
  isPaymentPurposeRefundable
} from '../src/domains/payments/payments/paymentPurpose.policy.js';

describe('PaymentPurpose Policy Fail-Closed Verification (H-03)', () => {
  test('valid declared purposes return expected refundability', () => {
    assert.equal(isPaymentPurposeRefundable(PaymentPurpose.ORDER_CHECKOUT), true);
    assert.equal(isPaymentPurposeRefundable(PaymentPurpose.SELLER_PICKUP_FEE), false);

    assert.equal(isPaymentPurposeRefundable(extractPaymentPurpose({ payment_purpose: 'order_checkout' })), true);
    assert.equal(isPaymentPurposeRefundable(extractPaymentPurpose({ payment_purpose: 'seller_pickup_fee' })), false);
    assert.equal(isPaymentPurposeRefundable(extractPaymentPurpose({ logistics_payment_type: 'seller_pickup_fee' })), false);
  });

  test('supported legacy records (null, undefined, empty object, legacy object without purpose) evaluate as refundable', () => {
    assert.equal(extractPaymentPurpose(null), null);
    assert.equal(isPaymentPurposeRefundable(extractPaymentPurpose(null)), true);

    assert.equal(extractPaymentPurpose(undefined), null);
    assert.equal(isPaymentPurposeRefundable(extractPaymentPurpose(undefined)), true);

    assert.equal(extractPaymentPurpose({}), null);
    assert.equal(isPaymentPurposeRefundable(extractPaymentPurpose({})), true);

    assert.equal(extractPaymentPurpose('{}'), null);
    assert.equal(isPaymentPurposeRefundable(extractPaymentPurpose('{}')), true);

    assert.equal(extractPaymentPurpose({ source: 'web', client_ip: '127.0.0.1' }), null);
    assert.equal(isPaymentPurposeRefundable(extractPaymentPurpose({ source: 'web', client_ip: '127.0.0.1' })), true);
  });

  test('malformed JSON metadata fails closed as non-refundable and alerts', () => {
    const purpose = extractPaymentPurpose('{"invalid json: true');
    // Must NOT be null (which would fail open as legacy checkout)
    assert.notEqual(purpose, null, 'Malformed JSON must not resolve to null');
    assert.equal(isPaymentPurposeRefundable(purpose), false, 'Malformed JSON metadata must evaluate to non-refundable');
  });

  test('non-string payment_purpose (number, boolean, object) fails closed as non-refundable', () => {
    const purposeNum = extractPaymentPurpose({ payment_purpose: 12345 });
    assert.notEqual(purposeNum, null, 'Numeric purpose must not resolve to null');
    assert.equal(isPaymentPurposeRefundable(purposeNum), false);

    const purposeBool = extractPaymentPurpose({ payment_purpose: true });
    assert.notEqual(purposeBool, null, 'Boolean purpose must not resolve to null');
    assert.equal(isPaymentPurposeRefundable(purposeBool), false);

    const purposeObj = extractPaymentPurpose({ payment_purpose: { nested: 'val' } });
    assert.notEqual(purposeObj, null, 'Object purpose must not resolve to null');
    assert.equal(isPaymentPurposeRefundable(purposeObj), false);
  });

  test('non-object metadata (array, primitive string, number) fails closed as non-refundable', () => {
    const purposeArr = extractPaymentPurpose(['order_checkout']);
    assert.notEqual(purposeArr, null);
    assert.equal(isPaymentPurposeRefundable(purposeArr), false);

    const purposePrimStr = extractPaymentPurpose('non_json_string');
    assert.notEqual(purposePrimStr, null);
    assert.equal(isPaymentPurposeRefundable(purposePrimStr), false);
  });

  test('unknown non-empty purpose fails closed', () => {
    const purpose = extractPaymentPurpose({ payment_purpose: 'unregistered_auxiliary_tax' });
    assert.equal(purpose, 'unregistered_auxiliary_tax');
    assert.equal(isPaymentPurposeRefundable(purpose), false);
  });
});
