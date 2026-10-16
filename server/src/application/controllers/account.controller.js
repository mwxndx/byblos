// Account-switching handlers. Let a user who owns more than one profile type
// (buyer / seller / creator) move between those accounts without
// re-entering their password. Ownership is derived from req.user, which the
// `protect` middleware already resolves from the buyers/sellers/creators tables.
import { AppError } from '../../shared/utils/errorHandler.js';
import { signToken } from '../../shared/utils/jwt.js';
import { generateRefreshToken } from '../../shared/utils/refreshToken.js';
import { setAuthCookie, setRefreshTokenCookie } from '../../shared/utils/cookie.utils.js';

const VALID_ROLES = ['buyer', 'seller', 'creator'];

const ownedAccounts = (user) => ({
  buyer: !!user.hasBuyerProfile || user.userType === 'seller' || user.userType === 'creator' || user.role === 'seller' || user.role === 'creator',
  seller: !!user.hasSellerProfile,
  creator: !!user.hasCreatorProfile,
});

/**
 * GET /api/auth/accounts
 * Report which account types the authenticated user owns so the client can
 * offer an account switcher only when there is somewhere to switch to.
 */
export const myAccounts = async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      current: req.user.userType,
      accounts: ownedAccounts(req.user),
    },
  });
};

/**
 * POST /api/auth/switch  { role }
 * Issue a fresh access + refresh token for another role the SAME user already
 * owns. Only roles the user actually has a profile for are permitted, so this
 * can never be used to reach an account the caller does not own.
 */
export const switchRole = async (req, res, next) => {
  try {
    const { role } = req.body || {};

    if (!VALID_ROLES.includes(role)) {
      return next(new AppError('Invalid account type.', 400));
    }

    // Auto-provision buyer profile if a seller or creator switches to buyer
    if (role === 'buyer' && !req.user.hasBuyerProfile) {
      const { pool } = await import('../../infrastructure/database/database.js');
      const Buyer = (await import('../../domains/commerce/buyers/buyer.model.js')).default;
      let existingBuyer = await Buyer.findByUserId(req.user.id);
      if (!existingBuyer) {
        existingBuyer = await Buyer.findByEmail(req.user.email);
        if (existingBuyer && !existingBuyer.userId) {
          await pool.query('UPDATE buyers SET user_id = $1 WHERE id = $2 AND user_id IS NULL', [req.user.id, existingBuyer.id]);
        }
      }
      if (!existingBuyer) {
        const fallbackName = req.user.email ? req.user.email.split('@')[0] : 'Buyer';
        const fullName = req.user.fullName || req.user.full_name || req.user.name || fallbackName;
        const phone = req.user.phone || req.user.whatsappNumber || req.user.whatsapp_number || null;
        await Buyer.create({
          fullName,
          email: req.user.email,
          mobilePayment: phone,
          whatsappNumber: phone,
          city: req.user.city || 'Nairobi',
          location: req.user.location || 'Nairobi',
          userId: req.user.id,
          termsAccepted: true
        });
        const roleRes = await pool.query("SELECT id FROM roles WHERE slug = 'buyer'");
        if (roleRes.rows[0]) {
          await pool.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.user.id, roleRes.rows[0].id]
          );
        }
      }
      req.user.hasBuyerProfile = true;
    }

    if (!ownedAccounts(req.user)[role]) {
      return next(new AppError('You do not have that account.', 403));
    }

    const token = signToken(req.user.id, role, req.user.email);
    const refreshToken = generateRefreshToken(req.user.id, role);
    setAuthCookie(res, token);
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      status: 'success',
      data: { token, refreshToken, role },
    });
  } catch (error) {
    next(error);
  }
};
