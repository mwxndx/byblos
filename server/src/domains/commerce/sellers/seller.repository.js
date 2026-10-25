import { query } from '../../../infrastructure/database/database.js';

/**
 * Fetches the referral-related fields for a seller. Returns undefined
 * if the seller does not exist.
 *
 * @param {number|string} sellerId
 * @returns {Promise<{referral_code: string|null, total_sales: number}|undefined>}
 */
export async function findReferralInfoById(sellerId) {
  const sql = `SELECT referral_code, total_sales FROM sellers WHERE id = $1`;
  const { rows } = await query(sql, [sellerId]);
  return rows[0];
}

/**
 * Returns the public-facing columns for a single seller. Undefined when
 * not found.
 *
 * @param {number|string} sellerId
 * @returns {Promise<object|undefined>}
 */
export async function findPublicById(sellerId) {
  const sql = `
    SELECT id, shop_name, city, location, theme, created_at, updated_at
    FROM sellers
    WHERE id = $1
  `;
  const { rows } = await query(sql, [sellerId]);
  return rows[0];
}

/**
 * Lists active sellers for the public directory, sorted by wishlist
 * popularity, including 24-hour knock counts and a windowed total count.
 *
 * @param {object} input
 * @param {number} input.limit
 * @param {number} input.offset
 * @returns {Promise<Array<object>>}
 */
export async function findActiveWithStats({ limit, offset }) {
  const sql = `
    SELECT
      s.id,
      s.full_name,
      s.shop_name,
      s.slug,
      s.avatar_url,
      s.bio,
      s.theme,
      s.physical_address,
      s.latitude,
      s.longitude,
      s.instagram_link AS "instagramLink",
      s.tiktok_link AS "tiktokLink",
      s.created_at,
      COALESCE(k.knock_count, 0) AS knock_count,
      COUNT(*) OVER() AS total_count,
      COUNT(w.id) as total_wishlist_count
    FROM sellers s
    LEFT JOIN products p ON s.id = p.seller_id
    LEFT JOIN wishlists w ON p.id = w.product_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS knock_count
      FROM seller_knocks sk
      WHERE sk.seller_id = s.id
        AND sk.created_at >= NOW() - INTERVAL '24 hours'
    ) k ON true
    WHERE s.user_id IS NOT NULL
      AND (s.status IS NULL OR s.status NOT IN ('deleted', 'suspended'))
      AND (s.is_active = true OR s.is_active IS NULL)
    GROUP BY s.id, k.knock_count
    ORDER BY total_wishlist_count DESC, s.id ASC
    LIMIT $1 OFFSET $2
  `;
  const { rows } = await query(sql, [limit, offset]);
  return rows;
}

/**
 * Records a knock against a seller and returns both whether the seller
 * exists and the 24-hour knock count. If the seller does not exist, no
 * row is inserted and seller_exists is false.
 *
 * @param {number} sellerId
 * @returns {Promise<{seller_exists: boolean, knock_count: number}>}
 */
export async function recordKnockAndCount(sellerId) {
  const sql = `
    WITH target AS (
      SELECT id FROM sellers WHERE id = $1
    ),
    inserted AS (
      INSERT INTO seller_knocks (seller_id)
      SELECT id FROM target
      RETURNING seller_id
    )
    SELECT
      EXISTS(SELECT 1 FROM target) AS seller_exists,
      (
        SELECT COUNT(*)::int
        FROM seller_knocks
        WHERE seller_id = $1
          AND created_at >= NOW() - INTERVAL '24 hours'
      ) AS knock_count
  `;
  const { rows } = await query(sql, [sellerId]);
  return rows[0];
}

// ─── Transactional methods ──────────────────────────────────────────────────
// Pass a pg.PoolClient as `executor` to participate in a caller-managed
// transaction; defaults to the wrapped module-level query helper.

const DEFAULT_EXECUTOR = { query };

/**
 * Acquires a row-level lock on a seller, returning the id only. Used to
 * serialize concurrent operations against a seller's balance (e.g. the
 * admin withdrawal-override refund path).
 *
 * @param {number|string} sellerId
 * @param {{query: Function}} [executor]
 */
export async function lockById(sellerId, executor = DEFAULT_EXECUTOR) {
  const sql = `SELECT id FROM sellers WHERE id = $1 FOR UPDATE`;
  await executor.query(sql, [sellerId]);
}

/**
 * Updates seller theme configuration.
 *
 * @param {number|string} sellerId
 * @param {string} theme
 * @returns {Promise<{theme: string, shop_name: string}|undefined>}
 */
export async function updateSellerTheme(sellerId, theme) {
  const sql = `UPDATE sellers SET theme = $1 WHERE id = $2 RETURNING theme, shop_name`;
  const { rows } = await query(sql, [theme, sellerId]);
  return rows[0];
}

/**
 * Updates seller business avatar / photo.
 *
 * @param {number|string} sellerId
 * @param {string|null} avatarUrl
 * @returns {Promise<{id: number, avatarUrl: string|null}|undefined>}
 */
export async function updateSellerBusinessPhoto(sellerId, avatarUrl) {
  const sql = `
    UPDATE sellers
    SET avatar_url = $1
    WHERE id = $2
    RETURNING id, avatar_url AS "avatarUrl"
  `;
  const { rows } = await query(sql, [avatarUrl, sellerId]);
  return rows[0];
}

/**
 * Searches sellers by city and optional location filter.
 *
 * @param {object} input
 * @param {string} input.city
 * @param {string|null} [input.location]
 * @param {number} [input.limit]
 * @param {number} [input.offset]
 * @returns {Promise<Array<object>>}
 */
export async function findSellersByLocation({ city, location = null, limit = 50, offset = 0 } = {}) {
  let queryText = `
    SELECT 
      id, 
      full_name AS "fullName", 
      shop_name AS "shopName", 
      city, 
      location,
      theme,
      created_at AS "createdAt"
    FROM sellers 
    WHERE LOWER(city) = LOWER($1)
  `;

  const queryParams = [city];

  if (location) {
    queryText += ' AND LOWER(location) LIKE LOWER($2)';
    queryParams.push(`%${location}%`);
  }

  queryText += ' ORDER BY created_at DESC';
  queryParams.push(limit, offset);
  const limitIdx = queryParams.length - 1;
  const offsetIdx = queryParams.length;
  queryText += " LIMIT $" + limitIdx + " OFFSET $" + offsetIdx;

  const { rows } = await query(queryText, queryParams);
  return rows;
}

/**
 * Retrieves public product catalog for a specific seller.
 *
 * @param {number|string} sellerId
 * @param {object} [options]
 * @param {number} [options.limit]
 * @param {number} [options.offset]
 * @returns {Promise<Array<object>>}
 */
export async function findSellerProducts(sellerId, { limit = 50, offset = 0 } = {}) {
  const sql = `
    SELECT 
      p.id,
      p.name,
      p.description,
      p.price,
      p.image_url AS "imageUrl",
      p.images,
      p.aesthetic,
      p.seller_id AS "sellerId",
      p.status = 'sold' AS "isSold",
      p.status,
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt",
      p.is_digital AS "isDigital",
      p.product_type AS "productType",
      p.is_custom_product,
      p.production_days,
      p.customization_prompt,
      p.is_imported_product,
      p.import_days,
      p.import_note,
      p.service_locations AS "serviceLocations",
      p.service_options AS "serviceOptions",
      s.shop_name AS "sellerName"
    FROM products p
    JOIN sellers s ON p.seller_id = s.id
    WHERE p.seller_id = $1 AND p.status = 'available'
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await query(sql, [sellerId, limit, offset]);
  return rows;
}
