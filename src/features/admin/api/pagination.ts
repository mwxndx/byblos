import type { PaginationMeta } from '../types/dashboard';

export interface AdminListParams {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Builds the axios `params` object for a paginated admin list request,
 * omitting empty/default values so the URL stays clean (no `?search=`).
 */
export function toRequestParams({ page, limit, search }: AdminListParams): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (page && page > 1) params.page = page;
  if (limit) params.limit = limit;
  if (search && search.trim()) params.search = search.trim();
  return params;
}

/**
 * Reads the `pagination` envelope the backend returns alongside `data` for
 * every paginated admin list endpoint, falling back to a single-page shape
 * for a response that (unexpectedly) omits it rather than throwing.
 */
export function readPaginationMeta(responseData: unknown, itemCount: number): PaginationMeta {
  const envelope = responseData as { pagination?: Partial<PaginationMeta> } | undefined;
  const pagination = envelope?.pagination;
  return {
    total: pagination?.total ?? itemCount,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? itemCount,
    hasMore: pagination?.hasMore ?? false
  };
}
