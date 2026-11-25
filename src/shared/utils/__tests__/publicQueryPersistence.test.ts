import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PUBLIC_QUERY_CACHE_KEY,
  hydratePublicQueryCache,
  persistPublicQueries,
} from '../publicQueryPersistence';

describe('publicQueryPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('persists only public catalog queries and excludes auth/orders/payments', () => {
    const client = new QueryClient();
    client.setQueryData(['public-sellers', { page: 1 }], { sellers: [{ id: 1, shopName: 'Eris' }] });
    client.setQueryData(['public-shop', 'eris'], { id: 1, shopName: 'Eris' });
    client.setQueryData(['public-products', 1], [{ id: 10, name: 'Shirt' }]);
    client.setQueryData(['auth', 'me'], { id: 99, token: 'secret' });
    client.setQueryData(['buyer-orders'], [{ id: 500, total: 1000 }]);

    persistPublicQueries(client);

    const raw = localStorage.getItem(PUBLIC_QUERY_CACHE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    const keys = parsed.entries.map((entry: { queryKey: unknown[] }) => entry.queryKey[0]);

    expect(keys).toEqual(['public-sellers', 'public-shop', 'public-products']);
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('buyer-orders');
  });

  it('hydrates fresh public queries and ignores expired cache entries', () => {
    const now = Date.now();
    localStorage.setItem(
      PUBLIC_QUERY_CACHE_KEY,
      JSON.stringify({
        entries: [
          {
            queryKey: ['public-shop', 'eris'],
            data: { id: 1, shopName: 'Eris' },
            dataUpdatedAt: now - 5 * 60_000,
          },
          {
            queryKey: ['public-sellers', { page: 1 }],
            data: { sellers: [{ id: 2 }] },
            dataUpdatedAt: now - 120 * 60_000, // expired (> 60m)
          },
        ],
      })
    );

    const client = new QueryClient();
    hydratePublicQueryCache(client);

    expect(client.getQueryData(['public-shop', 'eris'])).toEqual({ id: 1, shopName: 'Eris' });
    expect(client.getQueryData(['public-sellers', { page: 1 }])).toBeUndefined();
  });
});

