/**
 * Shared admin-list pagination helpers.
 *
 * Mirrors the page/limit -> offset parsing and pagination-meta shape already
 * established by the public catalog endpoints (public.controller.js
 * getProducts/getSellers), so admin list endpoints (buyers, sellers,
 * clients, creators, withdrawal requests) respond with the same envelope
 * shape the frontend's PaginationMeta type already expects.
 */

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Parses page/limit query params into bounded, safe integers plus the
 * matching SQL OFFSET.
 *
 * @param {object} queryParams  Typically req.query.
 * @param {object} [options]
 * @param {number} [options.defaultLimit]
 * @param {number} [options.maxLimit]
 * @returns {{page: number, limit: number, offset: number}}
 */
export function parsePaginationParams(queryParams = {}, { defaultLimit = DEFAULT_PAGE_SIZE, maxLimit = MAX_PAGE_SIZE } = {}) {
  const page = Math.max(1, Number.parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(queryParams.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Builds the {total, page, pageSize, hasMore} envelope from a windowed
 * total_count (COUNT(*) OVER()) and the page actually returned.
 *
 * @param {object} input
 * @param {Array<object>} input.rows       Rows for this page; each is expected
 *                                          to carry a total_count column when
 *                                          rows.length > 0.
 * @param {number} input.page
 * @param {number} input.limit
 * @param {number} input.offset
 * @returns {{total: number, page: number, pageSize: number, hasMore: boolean}}
 */
export function buildPaginationMeta({ rows, page, limit, offset }) {
  const total = Number.parseInt(rows[0]?.total_count || 0, 10);
  return {
    total,
    page,
    pageSize: limit,
    hasMore: offset + rows.length < total
  };
}

/**
 * Builds a `name ILIKE $n OR email ILIKE $n ...`-style clause across one or
 * more columns for a single search term, appending the wildcarded value to
 * `params` and returning the SQL fragment (or '' when there is no search
 * term). Caller is responsible for prefixing with WHERE/AND.
 *
 * @param {string[]} columns    Fully-qualified column expressions, e.g. ['b.full_name', 'b.email'].
 * @param {string|undefined} search
 * @param {unknown[]} params    Mutated in place: the wildcarded term is pushed on match.
 * @returns {string}
 */
export function buildSearchClause(columns, search, params) {
  const term = typeof search === 'string' ? search.trim() : '';
  if (!term || columns.length === 0) return '';
  params.push(`%${term}%`);
  const placeholder = `$${params.length}`;
  return `(${columns.map((col) => `${col} ILIKE ${placeholder}`).join(' OR ')})`;
}
