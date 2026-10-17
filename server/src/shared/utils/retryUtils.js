/**
 * Retry utility implementing exponential backoff with jitter
 * for external network and HTTP gateway calls.
 *
 * Pattern Reference: backend-patterns (Error Handling & Resilience)
 */

import logger from './logger.js';

const TRANSIENT_NETWORK_ERRORS = new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNABORTED',
    'ERR_NETWORK',
    'EPIPE'
]);

const TRANSIENT_HTTP_STATUSES = new Set([
    429, // Too Many Requests
    502, // Bad Gateway
    503, // Service Unavailable
    504  // Gateway Timeout
]);

/**
 * Classifies whether an error is transient (safe to retry)
 * versus permanent (400, 401, 404, 422 - fail fast).
 *
 * @param {any} error
 * @returns {boolean}
 */
export function isTransientHttpError(error) {
    if (!error) return false;

    // Direct network / socket errors
    if (error.code && TRANSIENT_NETWORK_ERRORS.has(String(error.code).toUpperCase())) {
        return true;
    }

    // Axios response status
    const status = error.response?.status || error.statusCode || error.status;
    if (Number.isFinite(status)) {
        if (TRANSIENT_HTTP_STATUSES.has(status)) return true;
        // Generic 5xx (500, 501, etc.) is transient if socket failed or explicitly gateway error
        if (status >= 500 && status <= 599) return true;
        return false;
    }

    // If request was made but no response was received (e.g. timeout before response)
    if (error.request && !error.response) {
        return true;
    }

    return false;
}

/**
 * Executes an async function with exponential backoff and jitter.
 *
 * delay = min(maxDelayMs, baseDelayMs * 2^attempt) + jitter
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {object} [options]
 * @param {number} [options.maxRetries=3]
 * @param {number} [options.baseDelayMs=300]
 * @param {number} [options.maxDelayMs=3000]
 * @param {boolean} [options.jitter=true]
 * @param {(err: any) => boolean} [options.shouldRetry=isTransientHttpError]
 * @param {(meta: { attempt: number, delayMs: number, error: any }) => void} [options.onRetry]
 * @returns {Promise<T>}
 */
export async function executeWithRetry(fn, {
    maxRetries = 3,
    baseDelayMs = 300,
    maxDelayMs = 3000,
    jitter = true,
    shouldRetry = isTransientHttpError,
    onRetry = null
} = {}) {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt >= maxRetries || !shouldRetry(error)) {
                throw error;
            }

            const exponential = baseDelayMs * Math.pow(2, attempt + 1);
            const capped = Math.min(maxDelayMs, exponential);
            const jitterAmount = jitter ? Math.random() * 100 : 0;
            const delayMs = Math.round(capped + jitterAmount);

            if (typeof onRetry === 'function') {
                try {
                    onRetry({ attempt: attempt + 1, delayMs, error });
                } catch {
                    // Ignore onRetry logging errors
                }
            } else {
                logger.warn(`[RetryUtils] Transient error encountered, retrying attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`, {
                    code: error.code,
                    status: error.response?.status,
                    message: error.message
                });
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    throw lastError;
}
