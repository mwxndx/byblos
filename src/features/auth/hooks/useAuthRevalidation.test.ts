import { describe, test, expect } from 'vitest';
import { isDefinitiveAuthFailure } from './useAuthRevalidation';

// Guards the "don't log a valid user out on a transient blip" rule: only a
// 401/404 clears the session; everything else (5xx, timeout, offline) must be
// treated as recoverable so a cold-starting backend never signs a user out.
describe('isDefinitiveAuthFailure', () => {
  test('401 and 404 are definitive auth failures (clear the session)', () => {
    expect(isDefinitiveAuthFailure({ response: { status: 401 } })).toBe(true);
    expect(isDefinitiveAuthFailure({ response: { status: 404 } })).toBe(true);
  });

  test('transient failures are NOT auth failures (keep the session)', () => {
    // 5xx / cold backend, gateway, rate limit
    expect(isDefinitiveAuthFailure({ response: { status: 500 } })).toBe(false);
    expect(isDefinitiveAuthFailure({ response: { status: 502 } })).toBe(false);
    expect(isDefinitiveAuthFailure({ response: { status: 503 } })).toBe(false);
    expect(isDefinitiveAuthFailure({ response: { status: 429 } })).toBe(false);
    // Timeout / offline — no response object at all
    expect(isDefinitiveAuthFailure({ code: 'ECONNABORTED' })).toBe(false);
    expect(isDefinitiveAuthFailure(new Error('Network Error'))).toBe(false);
    expect(isDefinitiveAuthFailure(undefined)).toBe(false);
  });
});
