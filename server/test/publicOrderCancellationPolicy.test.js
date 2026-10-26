import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createCancelPendingPublicOrder } from '../src/application/controllers/public.controller.js';

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('public order cancellation payment verification', () => {
  test('fails closed without mutating an order when provider verification fails', async () => {
    let lookupCount = 0;
    const handler = createCancelPendingPublicOrder({
      orderStatusRepository: {
        async findStatusByIdentifier() {
          lookupCount += 1;
          return {
            id: 42,
            status: 'PAYMENT_PENDING',
            client_checkout_token: 'checkout-secret',
            provider_reference: 'paystack-reference',
          };
        },
      },
      paymentClient: {
        async checkTransactionStatus() {
          throw new Error('provider unavailable');
        },
      },
    });
    const response = createResponse();

    await handler({
      params: { id: 'BYB-42' },
      body: { clientCheckoutToken: 'checkout-secret' },
      query: {},
    }, response);

    assert.equal(lookupCount, 1);
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, {
      status: 'pending_verification',
      code: 'PAYMENT_STATUS_UNVERIFIED',
      message: 'We could not verify the payment status. Your order remains unchanged while verification is retried.',
    });
  });

  test('rejects cancellation with 403 when order has null or missing client_checkout_token', async () => {
    const handler = createCancelPendingPublicOrder({
      orderStatusRepository: {
        async findStatusByIdentifier() {
          return {
            id: 43,
            status: 'PAYMENT_PENDING',
            client_checkout_token: null,
            provider_reference: 'paystack-ref',
          };
        },
      },
    });
    const response = createResponse();

    await handler({
      params: { id: 'BYB-43' },
      body: { clientCheckoutToken: 'any-token' },
      query: {},
    }, response);

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body, {
      status: 'error',
      message: 'Unauthorized: client token does not match order.',
    });
  });
});
