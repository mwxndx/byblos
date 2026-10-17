import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { executeWithRetry, isTransientHttpError } from '../src/shared/utils/retryUtils.js';

describe('Retry with Exponential Backoff (retryUtils)', () => {
    describe('isTransientHttpError', () => {
        test('identifies socket/network errors as transient', () => {
            assert.equal(isTransientHttpError({ code: 'ECONNRESET' }), true);
            assert.equal(isTransientHttpError({ code: 'ETIMEDOUT' }), true);
            assert.equal(isTransientHttpError({ code: 'ENOTFOUND' }), true);
            assert.equal(isTransientHttpError({ code: 'EAI_AGAIN' }), true);
            assert.equal(isTransientHttpError({ code: 'ECONNABORTED' }), true);
        });

        test('identifies server 5xx and 429 gateway responses as transient', () => {
            assert.equal(isTransientHttpError({ response: { status: 502 } }), true);
            assert.equal(isTransientHttpError({ response: { status: 503 } }), true);
            assert.equal(isTransientHttpError({ response: { status: 504 } }), true);
            assert.equal(isTransientHttpError({ response: { status: 429 } }), true);
            assert.equal(isTransientHttpError({ statusCode: 503 }), true);
        });

        test('rejects client 4xx errors as non-transient (fail-fast without retry)', () => {
            assert.equal(isTransientHttpError({ response: { status: 400 } }), false);
            assert.equal(isTransientHttpError({ response: { status: 401 } }), false);
            assert.equal(isTransientHttpError({ response: { status: 403 } }), false);
            assert.equal(isTransientHttpError({ response: { status: 404 } }), false);
            assert.equal(isTransientHttpError({ response: { status: 422 } }), false);
            assert.equal(isTransientHttpError(new Error('Generic failure')), false);
        });
    });

    describe('executeWithRetry', () => {
        test('succeeds on first attempt without delay', async () => {
            let calls = 0;
            const result = await executeWithRetry(async () => {
                calls++;
                return 'success';
            });

            assert.equal(result, 'success');
            assert.equal(calls, 1);
        });

        test('retries on transient failure and resolves when subsequent call succeeds', async () => {
            let calls = 0;
            const delays = [];

            const result = await executeWithRetry(
                async () => {
                    calls++;
                    if (calls === 1) {
                        const err = new Error('Gateway Timeout');
                        err.response = { status: 504 };
                        throw err;
                    }
                    return 'recovered';
                },
                {
                    maxRetries: 3,
                    baseDelayMs: 10,
                    jitter: false,
                    onRetry: ({ delayMs, attempt }) => delays.push({ delayMs, attempt })
                }
            );

            assert.equal(result, 'recovered');
            assert.equal(calls, 2);
            assert.equal(delays.length, 1);
            assert.equal(delays[0].attempt, 1);
            assert.equal(delays[0].delayMs, 20); // baseDelayMs * 2^1
        });

        test('aborts immediately and does not retry on non-transient error', async () => {
            let calls = 0;

            await assert.rejects(
                async () => {
                    await executeWithRetry(async () => {
                        calls++;
                        const err = new Error('Bad Request');
                        err.response = { status: 400 };
                        throw err;
                    });
                },
                /Bad Request/
            );

            assert.equal(calls, 1); // No retries
        });

        test('exhausts retries and throws the last error when all attempts fail', async () => {
            let calls = 0;

            await assert.rejects(
                async () => {
                    await executeWithRetry(
                        async () => {
                            calls++;
                            const err = new Error('Service Unavailable');
                            err.response = { status: 503 };
                            throw err;
                        },
                        { maxRetries: 2, baseDelayMs: 5, jitter: false }
                    );
                },
                /Service Unavailable/
            );

            // Initial attempt + 2 retries = 3 calls
            assert.equal(calls, 3);
        });
    });
});
