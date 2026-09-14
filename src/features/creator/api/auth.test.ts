import { describe, it, expect, vi, beforeEach } from 'vitest';

// login() imports the shared axios instance as a default export and calls
// apiClient.post directly, so the instance itself is mocked rather than the
// underlying transport.
vi.mock('@/infrastructure/http/apiClient', () => ({
  default: { post: vi.fn() },
}));

import apiClient from '@/infrastructure/http/apiClient';
import { login } from './auth';

const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;

describe('creator login', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('resolves creator/token/refreshToken from the real backend response shape', () => {
    // Actual shape from creator.controller.js login: everything nested under `data`.
    mockedPost.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          creator: { id: 'c1', name: 'Ama' },
          token: 'access-token',
          refreshToken: 'refresh-token',
          user: { email: 'ama@example.com', role: 'creator', is_verified: true },
        },
      },
    });

    return login({ email: 'ama@example.com', password: 'secret' }).then((result) => {
      expect(result.creator).toEqual({ id: 'c1', name: 'Ama' });
      expect(result.token).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  it('does not let an unrelated top-level field on the response body override the resolved token', () => {
    // Regression test for the precedence bug: the old implementation spread
    // `...responseBody` AFTER the resolved {creator, token, refreshToken},
    // so any of those three names appearing as an unrelated top-level key on
    // the raw response body would silently win over the correctly-resolved
    // nested value. Simulate exactly that: a top-level `token` that is NOT
    // the real access token (e.g. some other backend field that happens to
    // share the name) alongside the real one nested under `data`.
    mockedPost.mockResolvedValue({
      data: {
        status: 'success',
        token: 'not-the-real-token',
        data: {
          creator: { id: 'c1', name: 'Ama' },
          token: 'real-access-token',
          refreshToken: 'refresh-token',
        },
      },
    });

    return login({ email: 'ama@example.com', password: 'secret' }).then((result) => {
      expect(result.token).toBe('real-access-token');
    });
  });

  it('falls back to a flat (non-nested) response shape', () => {
    mockedPost.mockResolvedValue({
      data: {
        creator: { id: 'c2', name: 'Kofi' },
        token: 'flat-token',
      },
    });

    return login({ email: 'kofi@example.com', password: 'secret' }).then((result) => {
      expect(result.creator).toEqual({ id: 'c2', name: 'Kofi' });
      expect(result.token).toBe('flat-token');
    });
  });

  it('accepts the legacy (email, password) call signature', () => {
    mockedPost.mockResolvedValue({
      data: { data: { creator: { id: 'c3' }, token: 't3' } },
    });

    return login('legacy@example.com', 'secret').then((result) => {
      expect(mockedPost).toHaveBeenCalledWith('/creators/login', {
        email: 'legacy@example.com',
        password: 'secret',
      });
      expect(result.creator).toEqual({ id: 'c3' });
    });
  });
});
