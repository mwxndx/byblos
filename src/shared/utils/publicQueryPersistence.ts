import type { QueryClient } from '@tanstack/react-query';

export const PUBLIC_QUERY_CACHE_KEY = 'byblos:public-query-cache:v1';
const MAX_CACHE_AGE_MS = 60 * 60 * 1000; // 60 minutes
const MAX_PERSISTED_ENTRIES = 30;
const PUBLIC_QUERY_PREFIXES = new Set(['public-sellers', 'public-shop', 'public-products']);

interface PersistedQueryEntry {
  queryKey: readonly unknown[];
  data: unknown;
  dataUpdatedAt: number;
}

interface PersistedQueryPayload {
  entries: PersistedQueryEntry[];
}

function isPublicQueryKey(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === 'string' && PUBLIC_QUERY_PREFIXES.has(queryKey[0]);
}

/**
 * Hydrates non-expired public catalog queries from localStorage into QueryClient
 * so storefronts and shop lists render immediately on cold app launch.
 */
export function hydratePublicQueryCache(queryClient: QueryClient): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(PUBLIC_QUERY_CACHE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as PersistedQueryPayload;
    if (!Array.isArray(parsed?.entries)) return;

    const now = Date.now();
    for (const entry of parsed.entries) {
      if (
        !entry ||
        !Array.isArray(entry.queryKey) ||
        !isPublicQueryKey(entry.queryKey) ||
        typeof entry.dataUpdatedAt !== 'number' ||
        now - entry.dataUpdatedAt > MAX_CACHE_AGE_MS ||
        entry.data === undefined
      ) {
        continue;
      }

      queryClient.setQueryData(entry.queryKey, entry.data, {
        updatedAt: entry.dataUpdatedAt,
      });
    }
  } catch {
    // Ignore corrupt cache or restricted storage (e.g. Safari private mode)
  }
}

/**
 * Persists successful public catalog queries to localStorage (excluding auth/orders/payments).
 */
export function persistPublicQueries(queryClient: QueryClient): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const entries: PersistedQueryEntry[] = [];

    for (const query of queryClient.getQueryCache().getAll()) {
      if (
        query.state.status !== 'success' ||
        query.state.data === undefined ||
        !isPublicQueryKey(query.queryKey) ||
        now - query.state.dataUpdatedAt > MAX_CACHE_AGE_MS
      ) {
        continue;
      }

      entries.push({
        queryKey: query.queryKey,
        data: query.state.data,
        dataUpdatedAt: query.state.dataUpdatedAt,
      });

      if (entries.length >= MAX_PERSISTED_ENTRIES) break;
    }

    window.localStorage.setItem(PUBLIC_QUERY_CACHE_KEY, JSON.stringify({ entries }));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function setupPublicQueryPersistence(queryClient: QueryClient): () => void {
  hydratePublicQueryCache(queryClient);

  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event?.type !== 'updated' || !isPublicQueryKey(event.query.queryKey)) {
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => persistPublicQueries(queryClient), 400);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

