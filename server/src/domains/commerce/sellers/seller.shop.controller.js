// Seller shop/discovery handlers (public shop lookup, search, product listing).
// Split from seller.controller.js in Phase 15.7b; re-exported via that barrel.
import { query } from '../../../infrastructure/database/database.js';
import { findSellerByShopName, isShopNameAvailable, findSellerById } from './seller.model.js';
import { sanitizeSeller, sanitizePublicSeller } from '../../../shared/utils/sanitize.js';

export const checkShopNameAvailability = async (req, res) => {
  try {
    const { shopName } = req.query;

    if (!shopName) {
      return res.status(400).json({
        status: 'error',
        message: 'Shop name is required'
      });
    }

    // Validation format rules (must match Zod schema in sellerValidation.js)
    const shopNameRegex = /^[a-zA-Z0-9._-]+$/;
    const isAllowedFormat = shopNameRegex.test(shopName) && shopName.length >= 3 && shopName.length <= 30;

    if (!isAllowedFormat) {
      let formatMessage = 'Invalid format';
      if (shopName.length < 3) formatMessage = 'Shop name must be at least 3 characters';
      if (shopName.length > 30) formatMessage = 'Shop name must be at most 30 characters';
      if (!shopNameRegex.test(shopName)) formatMessage = 'Shop name can only contain letters, numbers, dots, dashes, and underscores';

      return res.status(200).json({
        status: 'success',
        data: {
          available: false,
          allowed: false,
          message: formatMessage
        }
      });
    }

    const isAvailable = await isShopNameAvailable(shopName);

    res.status(200).json({
      status: 'success',
      data: {
        available: isAvailable,
        allowed: true,
        message: isAvailable ? 'Shop name is available' : 'Shop name is already taken'
      }
    });
  } catch (error) {
    console.error('Error checking shop name availability:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const getSellerByShopName = async (req, res) => {
  try {
    const { shopName } = req.params;


    const seller = await findSellerByShopName(shopName);

    if (!seller) {

      return res.status(404).json({
        status: 'error',
        message: 'Seller not found'
      });
    }

    // console.log('Found seller:', { ... });

    res.status(200).json({
      status: 'success',
      data: {
        seller: sanitizePublicSeller(seller)
      }
    });
  } catch (error) {
    console.error('Get seller by shop name error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Search sellers by city and location
// @route   GET /api/sellers/search
// @access  Public
export const searchSellers = async (req, res) => {
  try {
    const { city, location } = req.query;

    if (!city) {
      return res.status(400).json({
        status: 'error',
        message: 'City is required for search'
      });
    }

    const searchLimit = boundedLimit(req.query.limit, SELLER_SEARCH_MAX);
    const sellers = await searchSellersInDB(city, location, {
      limit: searchLimit,
      offset: boundedOffset(req.query.page, searchLimit),
    });

    // Sanitize results to remove sensitive info
    // searchSellersInDB returns raw rows, so we map them to sanitized public objects
    const sanitizedSellers = sellers.map(s => sanitizePublicSeller(s));

    res.status(200).json({
      status: 'success',
      data: sanitizedSellers
    });

  } catch (error) {
    console.error('Error searching for sellers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Public list endpoints are client-side filtered (the shop page loads a
// seller's whole catalogue and searches it in the browser), so these are
// generous SAFETY CAPS, not real pagination — high enough that realistic
// shops/cities are unaffected, low enough that a pathological or malicious
// dataset can't pull unbounded rows into memory. Swap for true server-side
// pagination + search if catalogues routinely exceed these.
const SELLER_SEARCH_MAX = 200;
const SELLER_PRODUCTS_MAX = 500;
function boundedLimit(rawLimit, cap) {
  const n = parseInt(rawLimit, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, cap) : cap;
}
function boundedOffset(rawPage, limit) {
  const page = Math.max(parseInt(rawPage, 10) || 1, 1);
  return (page - 1) * limit;
}

// Internal function to search sellers in database
async function searchSellersInDB(city, location = null, { limit = SELLER_SEARCH_MAX, offset = 0 } = {}) {
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
  queryText += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

  const result = await query(queryText, queryParams);
  return result.rows;
}

// @desc    Get products for a specific seller
// @route   GET /api/sellers/:sellerId/products
// @access  Public
export const getSellerProducts = async (req, res) => {
  try {
    const { sellerId } = req.params;

    if (!sellerId) {
      return res.status(400).json({
        status: 'error',
        message: 'Seller ID is required'
      });
    }

    const productsLimit = boundedLimit(req.query.limit, SELLER_PRODUCTS_MAX);
    const products = await getSellerProductsFromDB(sellerId, {
      limit: productsLimit,
      offset: boundedOffset(req.query.page, productsLimit),
    });

    res.status(200).json({
      status: 'success',
      data: products
    });

  } catch (error) {
    console.error('Error fetching seller products:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Internal function to get products for a specific seller
async function getSellerProductsFromDB(sellerId, { limit = SELLER_PRODUCTS_MAX, offset = 0 } = {}) {
  const result = await query(
    `SELECT 
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
    LIMIT $2 OFFSET $3`,
    [sellerId, limit, offset]
  );
  return result.rows;
}

export const getSellerById = async (req, res) => {
  try {
    const seller = await findSellerById(req.params.id);

    if (!seller) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found'
      });
    }

    /* console.log('Found seller:', {
      id: seller.id,
      shopName: seller.shop_name,
      // email: seller.email ? '[REDACTED]' : 'missing',
      // phone: seller.phone ? '[REDACTED]' : 'missing',
      isActive: seller.is_active
    }); */

    // Check if the requesting user is the owner of this profile
    const isOwner = await req.user.can('manage-shop', seller, 'product', 'manage');

    // If owner, return full (but sanitized) details. If not, return public details only.
    const responseData = isOwner ? sanitizeSeller(seller) : sanitizePublicSeller(seller);

    res.status(200).json({
      status: 'success',
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching seller:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch seller information'
    });
  }
};

