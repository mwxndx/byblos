import { describe, test, expect } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { UniversalHttpClient } from './UniversalHttpClient';
import type { AuthStrategy, AppRole, AuthPlatform } from '../auth/types';

const tick = () => new Promise((r) => setTimeout(r, 5));

// Reject like axios does: a 401 with the config attached so the response
// interceptor's error path runs.
function unauthorized(config: InternalAxiosRequestConfig) {
  const err = new Error('Unauthorized') as Error & { isAxiosError: boolean; config: unknown; response: unknown };
  err.isAxiosError = true;
  err.config = config;
  err.response = { status: 401, data: {}, headers: {}, config };
  return Promise.reject(err);
}

// Adapter: 401 while the attached token still looks expired, 200 once refreshed.
function tokenAwareAdapter() {
  return async (config: InternalAxiosRequestConfig) => {
    const auth = String(config.headers?.Authorization || '');
    if (auth.includes('expired')) return unauthorized(config);
    return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config } as unknown as ReturnType<typeof Promise.resolve>;
  };
}

// Android: independent per-role access tokens.
function androidStrategy() {
  const tokens: Record<string, string> = { seller: 'expired-seller', buyer: 'expired-buyer' };
  const refreshCalls: string[] = [];
  const strategy: AuthStrategy = {
    platform: 'android' as AuthPlatform,
    async getAuthHeaders(role?: AppRole) {
      return { Authorization: `Bearer ${tokens[role ?? 'none'] ?? 'expired-none'}` };
    },
    async getCsrfHeader() { return {}; },
    async handleUnauthorized(role?: AppRole) {
      refreshCalls.push(role ?? 'none');
      await tick();
      if (role) tokens[role] = `fresh-${role}`;
      return true;
    },
    async clearSession() {},
  };
  return { strategy, refreshCalls };
}

// Web: one shared cookie-like session token, role-agnostic.
function webStrategy() {
  let shared = 'expired-shared';
  const refreshCalls: string[] = [];
  const strategy: AuthStrategy = {
    platform: 'web' as AuthPlatform,
    async getAuthHeaders() { return { Authorization: `Bearer ${shared}` }; },
    async getCsrfHeader() { return {}; },
    async handleUnauthorized(role?: AppRole) {
      refreshCalls.push(role ?? 'none');
      await tick();
      shared = 'fresh-shared';
      return true;
    },
    async clearSession() {},
  };
  return { strategy, refreshCalls };
}

describe('UniversalHttpClient — keyed token refresh (Android role race)', () => {
  test('Android: concurrent 401s for different roles each refresh their OWN role', async () => {
    const { strategy, refreshCalls } = androidStrategy();
    const client = new UniversalHttpClient({ authStrategy: strategy });
    client.getAxiosInstance().defaults.adapter = tokenAwareAdapter();

    const [seller, buyer] = await Promise.all([
      client.get('/seller/orders'),
      client.get('/buyer/orders'),
    ]);

    expect(seller.status).toBe(200);
    expect(buyer.status).toBe(200);
    // The bug: a single shared promise would refresh only one role and the
    // other would retry with an expired token. The fix refreshes both.
    expect(refreshCalls.sort()).toEqual(['buyer', 'seller']);
  });

  test('Web: concurrent 401s share ONE refresh (single-flight preserved)', async () => {
    const { strategy, refreshCalls } = webStrategy();
    const client = new UniversalHttpClient({ authStrategy: strategy });
    client.getAxiosInstance().defaults.adapter = tokenAwareAdapter();

    const [seller, buyer] = await Promise.all([
      client.get('/seller/orders'),
      client.get('/buyer/orders'),
    ]);

    expect(seller.status).toBe(200);
    expect(buyer.status).toBe(200);
    // One shared cookie session -> exactly one refresh, avoiding the
    // refresh-token rotation race.
    expect(refreshCalls).toHaveLength(1);
  });
});
