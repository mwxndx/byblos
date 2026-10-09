import { query } from '../../../infrastructure/database/database.js';
import { enrichRequestWithSla } from '../../payments/refunds/refundSla.service.js';

/**
 * Lists a buyer's pending refund requests, newest first.
 *
 * @param {number|string} buyerId
 * @returns {Promise<Array<{id: number, amount: string, status: string, requested_at: string}>>}
 */
export async function findPendingByBuyerId(buyerId) {
  const sql = `
    SELECT id, amount, status, requested_at
    FROM refund_requests
    WHERE buyer_id = $1 AND status = 'pending'
    ORDER BY requested_at DESC
  `;
  const { rows } = await query(sql, [buyerId]);
  return rows;
}

/**
 * Inserts a new refund request for a buyer in the 'pending' state.
 *
 * @param {object} input
 * @param {number|string} input.buyerId
 * @param {number} input.amount
 * @param {string} input.paymentMethod
 * @param {string} input.paymentDetails  Already-serialized JSON.
 * @returns {Promise<object>}             The inserted row.
 */
export async function createForBuyer({ buyerId, amount, paymentMethod, paymentDetails }) {
  const sql = `
    INSERT INTO refund_requests (
      buyer_id, amount, status, payment_method, payment_details
    ) VALUES ($1, $2, 'pending', $3, $4)
    RETURNING *
  `;
  const { rows } = await query(sql, [buyerId, amount, paymentMethod, paymentDetails]);
  return rows[0];
}

const SELECT_WITH_BUYER = `
  SELECT
    rr.*,
    b.id as buyer_id,
    b.full_name as buyer_name,
    b.email as buyer_email,
    b.whatsapp_number as buyer_phone,
    b.refunds as buyer_current_refunds,
    po.order_number
  FROM refund_requests rr
  JOIN buyers b ON rr.buyer_id = b.id
  LEFT JOIN product_orders po ON rr.order_id = po.id
`;

/**
 * Lists refund requests joined with buyer details, supporting urgency sorting and SLA filters.
 *
 * @param {object} [opts]
 * @param {string} [opts.status]       Optional status filter.
 * @param {boolean} [opts.overdueOnly] Filter to only requests exceeding SLA.
 * @param {string} [opts.sortBy]       'urgency' or 'newest'.
 * @param {number} opts.limit
 * @param {number} opts.offset
 * @returns {Promise<Array<object>>}
 */
export async function findAllWithBuyer({ status, overdueOnly, sortBy = 'urgency', limit, offset } = {}) {
  const params = [];
  const conditions = [];
  let sql = SELECT_WITH_BUYER;

  if (status) {
    params.push(status);
    conditions.push(`rr.status = $${params.length}`);
  }
  if (overdueOnly) {
    conditions.push(`rr.status IN ('pending', 'manual_review') AND (rr.requested_at < NOW() - INTERVAL '48 hours' OR (rr.payment_details->'sla'->>'is_breached')::boolean = true)`);
  }
  if (conditions.length) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  let orderClause = 'ORDER BY rr.requested_at DESC';
  if (sortBy === 'urgency') {
    orderClause = `ORDER BY 
      CASE 
        WHEN rr.status IN ('pending', 'manual_review') AND (rr.requested_at < NOW() - INTERVAL '48 hours' OR (rr.payment_details->'sla'->>'is_breached')::boolean = true) THEN 0
        WHEN rr.status IN ('pending', 'manual_review') AND (rr.requested_at < NOW() - INTERVAL '36 hours') THEN 1
        ELSE 2
      END ASC, rr.requested_at ASC`;
  }

  params.push(limit, offset);
  sql += ` ${orderClause} LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await query(sql, params);
  return rows.map(enrichRequestWithSla);
}

/**
 * Counts refund requests, optionally filtered by status or overdue SLA.
 *
 * @param {object} [opts]
 * @param {string} [opts.status]
 * @param {boolean} [opts.overdueOnly]
 * @returns {Promise<number>}
 */
export async function countAll({ status, overdueOnly } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (overdueOnly) {
    conditions.push(`status IN ('pending', 'manual_review') AND (requested_at < NOW() - INTERVAL '48 hours' OR (payment_details->'sla'->>'is_breached')::boolean = true)`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) FROM refund_requests ${whereClause}`;
  const { rows } = await query(sql, params);
  return parseInt(rows[0].count, 10);
}

/**
 * Fetches a single refund request joined with buyer details and enriched with SLA.
 *
 * @param {number|string} id
 * @returns {Promise<object|undefined>}
 */
export async function findByIdWithBuyer(id) {
  const sql = `${SELECT_WITH_BUYER} WHERE rr.id = $1`;
  const { rows } = await query(sql, [id]);
  return rows[0] ? enrichRequestWithSla(rows[0]) : undefined;
}

/**
 * Fetches the minimal header (status + buyer identity) used by the reject
 * flow's pre-update validation. Returns undefined when not found.
 *
 * @param {number|string} id
 * @returns {Promise<{status: string, buyer_id: number, amount: string, full_name: string, whatsapp_number: string}|undefined>}
 */
export async function findHeaderById(id) {
  const sql = `
    SELECT rr.status, rr.buyer_id, rr.amount, b.full_name, b.whatsapp_number
    FROM refund_requests rr
    JOIN buyers b ON b.id = rr.buyer_id
    WHERE rr.id = $1
  `;
  const { rows } = await query(sql, [id]);
  return rows[0];
}

/**
 * Marks a refund request rejected, setting admin metadata.
 *
 * @param {object} input
 * @param {number|string} input.id
 * @param {string} input.adminNotes
 * @param {number|null} input.processedBy
 */
export async function markRejected({ id, adminNotes, processedBy }) {
  const sql = `
    UPDATE refund_requests
    SET status = 'rejected',
        admin_notes = $1,
        processed_by = $2,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = $3
  `;
  await query(sql, [adminNotes, processedBy, id]);
}

// ─── Transactional methods ──────────────────────────────────────────────────
// Methods below accept an optional `executor` (anything with a
// `.query(text, params)` method — pg.Pool, pg.PoolClient, or the default
// wrapped helper). Pass a pg.PoolClient to participate in an
// externally-managed transaction.

const DEFAULT_EXECUTOR = { query };

/**
 * SELECT … FOR UPDATE on a single refund request row. Used inside an
 * admin-approval transaction to serialize concurrent confirm/reject calls
 * on the same request.
 *
 * @param {number|string} id
 * @param {{query: Function}} [executor]  pg.PoolClient for transactional use.
 * @returns {Promise<object|undefined>}
 */
export async function findByIdForUpdate(id, executor = DEFAULT_EXECUTOR) {
  const sql = `
    SELECT rr.*
    FROM refund_requests rr
    WHERE rr.id = $1
    FOR UPDATE
  `;
  const { rows } = await executor.query(sql, [id]);
  return rows[0];
}

/**
 * Marks a refund request completed inside an admin-approval transaction.
 *
 * @param {object} input
 * @param {number|string} input.id
 * @param {string} input.adminNotes
 * @param {number|null} input.processedBy
 * @param {{query: Function}} [executor]
 */
export async function markCompleted({ id, adminNotes, processedBy }, executor = DEFAULT_EXECUTOR) {
  const sql = `
    UPDATE refund_requests
    SET status = 'completed',
        admin_notes = $1,
        processed_by = $2,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = $3
  `;
  await executor.query(sql, [adminNotes, processedBy, id]);
}
