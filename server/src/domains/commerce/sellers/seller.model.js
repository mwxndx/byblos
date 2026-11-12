// CRUD only
import { pool } from '../../../infrastructure/database/database.js';
import { toCamelCase } from '../../../shared/utils/caseUtils.js';
import logger from '../../../shared/utils/logger.js';
import { AppError } from '../../../shared/utils/errorHandler.js';


const query = (text, params) => pool.query(text, params);

function trimHyphens(str) {
  if (!str) return '';
  let start = 0;
  let end = str.length;
  while (start < end && str.charCodeAt(start) === 45 /* '-' */) start++;
  while (end > start && str.charCodeAt(end - 1) === 45 /* '-' */) end--;
  return str.slice(start, end);
}

export function normalizeShopName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function slugifyShopName(name) {
  if (!name) return null;
  const replaced = String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
  const slug = trimHyphens(replaced);
  return slug || null;
}

export const createSeller = async (sellerData, externalClient = null) => {
  const { fullName, shopName, email, whatsappNumber, city, location, physicalAddress, latitude, longitude, userId = null, termsAccepted = false, avatarUrl = null } = sellerData;
  const normalizedShopName = normalizeShopName(shopName);
  const slug = slugifyShopName(normalizedShopName);

  const result = await (externalClient || pool).query(
    `INSERT INTO sellers (full_name, shop_name, slug, email, whatsapp_number, city, location, physical_address, latitude, longitude, user_id, terms_accepted, terms_accepted_at, avatar_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CASE WHEN $12 = true THEN NOW() ELSE NULL END, $13)
     RETURNING *`,
    [fullName, normalizedShopName, slug, email, whatsappNumber, city, location, physicalAddress, latitude, longitude, userId, termsAccepted, avatarUrl]
  );
  return toCamelCase(result.rows[0]);
};

export const findSellerByEmail = async (email) => {
  if (!email) return null;
  const result = await query(
    `SELECT id, user_id, full_name, shop_name, slug, email, whatsapp_number,
            city, location, bio, avatar_url, total_sales, net_revenue,
            balance, instagram_link, tiktok_link, facebook_link,
            creator_commission_rate, physical_address, latitude, longitude,
            terms_accepted, created_at, updated_at
     FROM sellers 
     WHERE LOWER(email) = $1`,
    [email.toLowerCase()]
  );
  return toCamelCase(result.rows[0]);
};

export const findSellerByWhatsappNumber = async (whatsappNumber) => {
  if (!whatsappNumber) return null;
  const result = await query(
    `SELECT id, user_id AS "userId" FROM sellers WHERE whatsapp_number = $1 LIMIT 1`,
    [String(whatsappNumber).trim()]
  );
  return result.rows[0] || null;
};

export const findSellerByUserId = async (userId) => {
  const result = await query(
    `SELECT 
      id, 
      user_id AS "userId",
      full_name AS "fullName", 
      shop_name AS "shopName", 
      slug,
      email, 
      whatsapp_number AS "whatsappNumber", 
      city,
      location,
      bio,
      avatar_url AS "avatarUrl",
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      instagram_link AS "instagramLink",
      tiktok_link AS "tiktokLink",
      facebook_link AS "facebookLink",
      creator_commission_rate AS "creatorCommissionRate",
      physical_address AS "physicalAddress",
      latitude,
      longitude,
      terms_accepted AS "termsAccepted",
      created_at AS "createdAt"
     FROM sellers
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
};

export const findSellerByShopName = async (shopName) => {
  if (!shopName || typeof shopName !== 'string') return null;
  const rawInput = shopName.trim();
  if (!rawInput) return null;

  logger.debug('Executing findSellerByShopName query', { shopName: rawInput.replace(/[\n\r]/g, '') });

  const normalized = normalizeShopName(rawInput);
  const slugified = slugifyShopName(rawInput) || '';
  const unslugified = rawInput.replaceAll('-', ' ');

  const queryText = `
    SELECT 
      s.id, 
      s.full_name AS "fullName", 
      s.shop_name AS "shopName", 
      s.slug,
      s.email, 
      s.whatsapp_number AS "whatsappNumber", 
      s.city, 
      s.location, 
      s.physical_address AS "physicalAddress",
      s.latitude,
      s.longitude,
      s.bio,
      s.avatar_url AS "avatarUrl",
      s.instagram_link AS "instagramLink",
      s.tiktok_link AS "tiktokLink",
      s.facebook_link AS "facebookLink",
      s.creator_commission_rate AS "creatorCommissionRate",
      s.is_creator_marketplace_enabled AS "isCreatorMarketplaceEnabled",
      s.total_sales AS "totalSales",
      s.net_revenue AS "netRevenue",
      s.balance,
      s.created_at AS "createdAt",
      COALESCE(
        json_agg(
          json_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'price', p.price,
            'imageUrl', p.image_url,
            'image_url', p.image_url,
            'images', p.images,
            'aesthetic', p.aesthetic,
            'sellerId', p.seller_id,
            'status', p.status,
            'isSold', (p.status = 'sold'),
            'isDigital', p.is_digital,
            'productType', p.product_type,
            'is_custom_product', p.is_custom_product,
            'production_days', p.production_days,
            'customization_prompt', p.customization_prompt,
            'is_imported_product', p.is_imported_product,
            'import_days', p.import_days,
            'import_note', p.import_note,
            'serviceLocations', p.service_locations,
            'serviceOptions', p.service_options,
            'createdAt', p.created_at,
            'updatedAt', p.updated_at
          ) ORDER BY p.created_at DESC
        ) FILTER (WHERE p.id IS NOT NULL),
        '[]'::json
      ) AS products
    FROM sellers s
    LEFT JOIN products p ON s.id = p.seller_id AND p.status = 'available'
    WHERE COALESCE(s.status, 'active') = 'active'
      AND (
        LOWER(TRIM(s.shop_name)) = LOWER(TRIM($1))
        OR (s.slug IS NOT NULL AND LOWER(TRIM(s.slug)) = LOWER(TRIM($1)))
        OR (s.slug IS NOT NULL AND LOWER(TRIM(s.slug)) = LOWER(TRIM($2)))
        OR LOWER(TRIM(s.shop_name)) = LOWER(TRIM($3))
        OR LOWER(TRIM(s.shop_name)) = LOWER(TRIM($4))
      )
    GROUP BY s.id
    ORDER BY 
      CASE 
        WHEN LOWER(TRIM(s.shop_name)) = LOWER(TRIM($1)) THEN 1
        WHEN LOWER(TRIM(s.shop_name)) = LOWER(TRIM($4)) THEN 2
        WHEN s.slug IS NOT NULL AND LOWER(TRIM(s.slug)) = LOWER(TRIM($1)) THEN 3
        ELSE 4
      END
    LIMIT 1
  `;

  const result = await query(queryText, [rawInput, slugified, unslugified, normalized]);

  logger.debug('Query result details', {
    rowCount: result.rowCount
  });

  return result.rows[0];
};

export const isShopNameAvailable = async (shopName) => {
  if (!shopName || typeof shopName !== 'string') return false;
  const normalized = normalizeShopName(shopName);
  const slug = slugifyShopName(normalized);
  const result = await query(
    `SELECT 1 FROM sellers 
     WHERE LOWER(TRIM(shop_name)) = LOWER(TRIM($1)) 
        OR (slug IS NOT NULL AND LOWER(TRIM(slug)) = LOWER(TRIM($2)))`,
    [normalized, slug]
  );
  return result.rowCount === 0;
};

export const findSellerById = async (id) => {
  const result = await query(
    `SELECT 
      id, 
      user_id AS "userId",
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      whatsapp_number AS "whatsappNumber", 
      location, 
      city, 
      physical_address AS "physicalAddress",
      latitude,
      longitude,
      bio,
      avatar_url AS "avatarUrl",
      instagram_link AS "instagramLink",
      tiktok_link AS "tiktokLink",
      facebook_link AS "facebookLink",
      creator_commission_rate AS "creatorCommissionRate",
      is_creator_marketplace_enabled AS "isCreatorMarketplaceEnabled",
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      created_at AS "createdAt", 
      updated_at AS "updatedAt"
     FROM sellers 
     WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

export const updateSeller = async (id, updates) => {
  logger.info('Updating seller record', {
    id,
    updatedFields: Object.keys(updates || {}).filter(k => k !== 'password')
  });

  if (!id) {
    logger.error('No ID provided for updateSeller');
    throw new Error('Seller ID is required for update');
  }

  // NOTE: `email` is intentionally NOT updatable here. Email is the auth identity,
  // owned by the users table (login uses users.email); sellers.email is seeded in
  // sync at registration. Allowing a profile PATCH to change sellers.email alone
  // desynced it from users.email. Email changes must go through a verified auth
  // flow that updates both, not this profile-update path.
  const { fullName, shopName, whatsappNumber, city, location, instagramLink, instagram_link, tiktokLink, tiktok_link, facebookLink, facebook_link, creatorCommissionRate, creator_commission_rate } = updates || {};
  const updatesList = [];
  const values = [id];
  let paramCount = 1;

  if (fullName) {
    paramCount++;
    updatesList.push(`full_name = $${paramCount}`);
    values.push(fullName);
  }

  if (shopName) {
    const normalizedShopName = normalizeShopName(shopName);
    const slug = slugifyShopName(normalizedShopName);
    paramCount++;
    updatesList.push(`shop_name = $${paramCount}`);
    values.push(normalizedShopName);
    if (slug) {
      paramCount++;
      updatesList.push(`slug = $${paramCount}`);
      values.push(slug);
    }
  }

  if (whatsappNumber) {
    paramCount++;
    updatesList.push(`whatsapp_number = $${paramCount}`);
    values.push(whatsappNumber);
  }

  // Removed password update from here - it is handled by User model

  if (city) {
    paramCount++;
    updatesList.push(`city = $${paramCount}`);
    values.push(city);
  }

  if (location) {
    paramCount++;
    updatesList.push(`location = $${paramCount}`);
    values.push(location);
  }



  // Handle instagram link update (accept both camelCase and snake_case)
  const instagramLinkToUpdate = instagramLink || instagram_link;
  // Allow empty string to clear the link
  if (instagramLinkToUpdate !== undefined) {
    paramCount++;
    updatesList.push(`instagram_link = $${paramCount}`);
    values.push(instagramLinkToUpdate);
  }

  // Handle tiktok link update
  const tiktokLinkToUpdate = tiktokLink || tiktok_link;
  if (tiktokLinkToUpdate !== undefined) {
    paramCount++;
    updatesList.push(`tiktok_link = $${paramCount}`);
    values.push(tiktokLinkToUpdate);
  }

  // Handle facebook link update
  const facebookLinkToUpdate = facebookLink || facebook_link;
  if (facebookLinkToUpdate !== undefined) {
    paramCount++;
    updatesList.push(`facebook_link = $${paramCount}`);
    values.push(facebookLinkToUpdate);
  }

  if (updates.bio !== undefined) {
    paramCount++;
    updatesList.push(`bio = $${paramCount}`);
    values.push(updates.bio);
  }

  if (updates.avatarUrl !== undefined || updates.avatar_url !== undefined) {
    const avatarUrlToUpdate = updates.avatarUrl !== undefined ? updates.avatarUrl : updates.avatar_url;
    paramCount++;
    updatesList.push(`avatar_url = $${paramCount}`);
    values.push(avatarUrlToUpdate || null);
  }

  const creatorCommissionRateToUpdate = creatorCommissionRate !== undefined ? creatorCommissionRate : creator_commission_rate;
  if (creatorCommissionRateToUpdate !== undefined) {
    const normalizedRate = Number(creatorCommissionRateToUpdate);
    if (!Number.isFinite(normalizedRate) || normalizedRate < 0.01 || normalizedRate > 0.30) {
      throw new Error('Creator commission must be between 1% and 30%');
    }
    paramCount++;
    updatesList.push(`creator_commission_rate = $${paramCount}`);
    values.push(normalizedRate);
  }

  // Handle physical shop fields. If no physical address, coordinates MUST be null (not Nairobi sentinel)




  // Handle physical address update
  if (updates.physicalAddress !== undefined) {
    paramCount++;
    updatesList.push(`physical_address = $${paramCount}`);
    values.push(updates.physicalAddress);
  }

  // Handle coordinates
  if (updates.latitude !== undefined) {
    paramCount++;
    updatesList.push(`latitude = $${paramCount}`);
    values.push(updates.latitude);
  }

  if (updates.longitude !== undefined) {
    paramCount++;
    updatesList.push(`longitude = $${paramCount}`);
    values.push(updates.longitude);
  }

  if (updatesList.length === 0) {
    logger.warn('No valid fields to updateSeller', { id });
    throw new Error('No valid fields to update');
  }

  const queryText = `
    UPDATE sellers
    SET ${updatesList.join(', ')}, updated_at = NOW()
    WHERE id = $1
    RETURNING 
      id, 
      user_id AS "userId",
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      whatsapp_number AS "whatsappNumber", 
      city, 
      location, 
      instagram_link AS "instagramLink",
      tiktok_link AS "tiktokLink",
      facebook_link AS "facebookLink",
      creator_commission_rate AS "creatorCommissionRate",
      total_sales AS "totalSales",
      net_revenue AS "netRevenue",
      balance,
      physical_address AS "physicalAddress",
      latitude,
      longitude,
      bio,
      avatar_url AS "avatarUrl",
      created_at AS "createdAt"
    `;


  try {
    const result = await query(queryText, values);

    if (!result.rows || result.rows.length === 0) {
      logger.warn('No rows returned from updateSeller', { id });
      throw new Error('No seller found with the given ID');
    }

    logger.info('Successfully updated seller', { id: result.rows[0].id });
    return result.rows[0];
  } catch (error) {
    logger.error('Database error in updateSeller', {
      message: error.message,
      code: error.code
    });
    throw error; // Re-throw to be caught by the controller
  }
};


// Soft-delete a seller: block if they still hold a balance, otherwise anonymise
// PII, hide the shop (status='deleted' + tombstoned unique name/slug), and
// deactivate the auth account. Orders/withdrawals are preserved via FK.
export const softDeleteSeller = async (sellerId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Refuse deletion while ANY money is still attached to the account, not just
    // the immediately-available `balance`. Tombstoning sets status='deleted' and
    // deactivates the users row, so a deleted seller can no longer authenticate to
    // withdraw. `pending_settlement_balance` is escrow already earned but still in
    // the T+2 clearing hold (it becomes withdrawable `balance` once the settlement
    // job runs), and `withdrawal_reserved_balance` is money reserved against a
    // withdrawal already in flight — deleting mid-payout risks the funds being
    // refunded to a `balance` the seller can never reach. All three are money owed
    // to the seller that deletion would strand.
    // (refund_reserved_balance is deliberately excluded: it funds a buyer-refund
    // obligation, processed against the tombstoned row without the seller needing
    // to authenticate, so it is not stranded by deletion.)
    const balRes = await client.query(
      `SELECT balance, pending_settlement_balance, withdrawal_reserved_balance
       FROM sellers WHERE id = $1 FOR UPDATE`,
      [sellerId]
    );
    if (!balRes.rows.length) {
      throw new AppError('Seller account not found.', 404);
    }
    const { balance, pending_settlement_balance: pending, withdrawal_reserved_balance: reserved } = balRes.rows[0];
    const totalHeld = Number(balance || 0) + Number(pending || 0) + Number(reserved || 0);
    if (totalHeld > 0) {
      throw new AppError('Your account still has funds — available, clearing, or a withdrawal in progress. Please withdraw your balance and wait for any pending settlement or withdrawal to complete before deleting your account.', 400);
    }
    const tag = `${userId || sellerId}_${Date.now()}`;
    const tombstone = `deleted_seller_${tag}@deleted.byblos`;
    await client.query(
      `UPDATE sellers SET user_id = NULL, status = 'deleted', is_active = FALSE, full_name = 'Deleted user', email = $1,
         shop_name = $2, slug = $3, whatsapp_number = NULL, instagram_link = NULL,
         tiktok_link = NULL, facebook_link = NULL,
         city = NULL, location = NULL, physical_address = NULL,
         latitude = NULL, longitude = NULL, updated_at = NOW() WHERE id = $4`,
      [tombstone, `deleted-shop-${tag}`, `deleted-shop-${tag}`, sellerId]
    );

    await client.query(
      `UPDATE seller_creator_links
       SET status = 'deleted',
           updated_at = NOW()
       WHERE seller_id = $1
         AND status IN ('active', 'paused')`,
      [sellerId]
    );

    await client.query(
      `UPDATE seller_creator_invites
       SET status = 'seller_deleted',
           updated_at = NOW()
       WHERE seller_id = $1
         AND status = 'pending'`,
      [sellerId]
    );
    if (userId) {
      await client.query(
        "UPDATE users SET is_active = FALSE, email = $1, password_hash = 'DELETED' WHERE id = $2",
        [tombstone, userId]
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    if (!(error instanceof AppError)) {
      logger.error('softDeleteSeller failed', { sellerId, userId, error: error.message });
    }
    throw error;
  } finally {
    client.release();
  }
};
