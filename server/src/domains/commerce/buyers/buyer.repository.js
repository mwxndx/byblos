import { query } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';

// Defensive upper bound for the admin buyer directory (which has no pagination
// yet). Small/absent today, but the query was fully unbounded; this caps the
// scan and warns when the cap is reached so real pagination gets added before
// the directory grows past it, rather than the endpoint silently degrading.
const ADMIN_BUYER_LIST_CAP = 1000;

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
 * Returns all buyers linked to a user account, for the admin directory.
 * Sorted newest first.
 *
 * @returns {Promise<Array<object>>}
 */
export async function findAllForAdmin() {
  // Fetch one past the cap so we can tell whether more buyers exist without a
  // separate COUNT. The cap is a fixed internal constant, not user input.
  const sql = `
    SELECT ${ADMIN_BUYER_COLUMNS}
    FROM buyers
    WHERE user_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ${ADMIN_BUYER_LIST_CAP + 1}
  `;
  const { rows } = await query(sql);
  if (rows.length > ADMIN_BUYER_LIST_CAP) {
    logger.warn(
      `[AdminBuyers] buyer directory exceeded ${ADMIN_BUYER_LIST_CAP} rows; returning the newest ${ADMIN_BUYER_LIST_CAP}. ` +
      `Add real pagination to the admin buyers endpoint (buyer.repository.findAllForAdmin / admin.controller).`
    );
    return rows.slice(0, ADMIN_BUYER_LIST_CAP);
  }
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

