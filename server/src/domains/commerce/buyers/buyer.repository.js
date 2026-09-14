import { query } from '../../../infrastructure/database/database.js';
import { buildSearchClause } from '../../../shared/utils/pagination.utils.js';

const ADMIN_BUYER_COLUMNS = `
  id,
  user_id,
  full_name as name,
  email,
  mobile_payment,
  whatsapp_number,
  status,
  city,
  location,
  created_at
`;

/**
 * Returns one page of buyers linked to a user account, for the admin
 * directory. Sorted newest first. Each row carries a windowed total_count
 * (see pagination.utils.js buildPaginationMeta).
 *
 * @param {object} input
 * @param {number} input.limit
 * @param {number} input.offset
 * @param {string} [input.search]  Matches name or email (case-insensitive, substring).
 * @returns {Promise<Array<object>>}
 */
export async function findAllForAdmin({ limit, offset, search } = {}) {
  const params = [];
  const searchClause = buildSearchClause(['full_name', 'email'], search, params);

  let sql = `
    SELECT ${ADMIN_BUYER_COLUMNS}, COUNT(*) OVER() AS total_count
    FROM buyers
    WHERE user_id IS NOT NULL
  `;
  if (searchClause) sql += ` AND ${searchClause}`;

  params.push(limit, offset);
  sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Fetches a single buyer by id for the admin detail view. Returns
 * undefined when not found.
 *
 * @param {number|string} id
 * @returns {Promise<object|undefined>}
 */
export async function findByIdForAdmin(id) {
  const sql = `
    SELECT
      id,
      full_name as name,
      email,
      mobile_payment,
      whatsapp_number,
      status,
      city,
      location,
      created_at
    FROM buyers
    WHERE id = $1
  `;
  const { rows } = await query(sql, [id]);
  return rows[0];
}

// ─── Transactional methods ──────────────────────────────────────────────────
// Pass a pg.PoolClient as `executor` to participate in a caller-managed
// transaction; defaults to the wrapped module-level query helper.

