import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import tokenBlacklist from '../../domains/identity/tokens/tokenBlacklist.service.js';
import CacheService from './cache.service.js';

// In-memory fallback map for RFC 6819 grace period when Redis is unavailable
const _refreshGraceMemory = new Map();
const REFRESH_GRACE_WINDOW_SECONDS = 30;

const getRefreshSecrets = () => {
  const secrets = [process.env.JWT_REFRESH_SECRET, process.env.JWT_SECRET].filter(Boolean);
  if (secrets.length === 0) {
    throw new Error('JWT_REFRESH_SECRET or JWT_SECRET must be configured');
  }
  return secrets;
};

export const generateRefreshToken = (userId, role) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET or JWT_SECRET must be configured');
  return jwt.sign(
    { id: userId, role, type: 'refresh' },
    secret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '90d' }
  );
};

export const verifyRefreshToken = (token) => {
  const secrets = getRefreshSecrets();
  let lastError;
  for (const s of secrets) {
    try {
      const decoded = jwt.verify(token, s);
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }
      return decoded;
    } catch (error) {
      lastError = error;
      if (error.name === 'TokenExpiredError') {
        continue;
      }
      if (error.name === 'JsonWebTokenError') {
        continue;
      }
      throw error;
    }
  }

  if (lastError?.name === 'TokenExpiredError') {
    throw new Error('Refresh token has expired. Please log in again.');
  }
  throw new Error('Invalid refresh token');
};

/**
 * Generate new access token from refresh token.
 * Implements RFC 6819 sliding rotation grace window to absorb concurrent refresh races.
 * Access tokens use JWT_SECRET (short-lived), refresh tokens use JWT_REFRESH_SECRET (long-lived).
 * @param {string} refreshToken - Refresh token
 * @returns {Object} New access token and user info
 */
export const refreshAccessToken = async (refreshToken) => {
  const tokenHash = crypto.createHash('sha256').update(String(refreshToken)).digest('hex');
  const graceKey = `refresh_grace:${tokenHash}`;

  // 1) RFC 6819 Grace Period FIRST: concurrent clients may still present the
  // pre-rotation token within the window. Rotation blacklists the old token, so
  // blacklist must not run before grace replay. Logout still wins: it blacklists
  // without writing a grace entry, so those tokens fall through and are rejected.
  try {
    const cachedGrace = (await CacheService.get(graceKey)) || _refreshGraceMemory.get(graceKey);
    if (cachedGrace && cachedGrace.data) {
      const isRevoked = await tokenBlacklist.isBlacklisted(cachedGrace.data.refreshToken);
      if (isRevoked) {
        _refreshGraceMemory.delete(graceKey);
        await CacheService.delete(graceKey);
        throw new Error('Refresh token has been revoked. Please log in again.');
      }

      const { pool } = await import('../../infrastructure/database/database.js');
      const { rows } = await pool.query(
        'SELECT id, is_active FROM users WHERE id = $1',
        [cachedGrace.data.user.id]
      );
      const user = rows[0];
      if (!user || user.is_active === false) {
        _refreshGraceMemory.delete(graceKey);
        await CacheService.delete(graceKey);
        throw new Error('User account is invalid or deactivated. Please log in again.');
      }

      if (cachedGrace.data.user.role === 'seller') {
        const { rows: sellerRows } = await pool.query(
          'SELECT status FROM sellers WHERE user_id = $1 LIMIT 1',
          [cachedGrace.data.user.id]
        );
        if (sellerRows[0] && sellerRows[0].status !== 'active') {
          _refreshGraceMemory.delete(graceKey);
          await CacheService.delete(graceKey);
          throw new Error('Your seller account has been deactivated or suspended.');
        }
      } else if (cachedGrace.data.user.role === 'creator') {
        const { rows: creatorRows } = await pool.query(
          'SELECT status FROM creators WHERE user_id = $1 LIMIT 1',
          [cachedGrace.data.user.id]
        );
        if (creatorRows[0] && creatorRows[0].status !== 'active') {
          _refreshGraceMemory.delete(graceKey);
          await CacheService.delete(graceKey);
          throw new Error('Your creator account has been deactivated or suspended.');
        }
      } else if (cachedGrace.data.user.role === 'logistics') {
        const { rows: partnerRows } = await pool.query(
          'SELECT lp.active AS partner_active FROM users u LEFT JOIN logistics_partners lp ON u.id = lp.user_id WHERE u.id = $1 LIMIT 1',
          [cachedGrace.data.user.id]
        );
        if (partnerRows[0] && partnerRows[0].partner_active === false) {
          _refreshGraceMemory.delete(graceKey);
          await CacheService.delete(graceKey);
          throw new Error('Your logistics account has been deactivated or suspended.');
        }
      }

      return cachedGrace.data;
    }
  } catch (err) {
    if (err.message && (err.message.includes('deactivated') || err.message.includes('suspended') || err.message.includes('revoked'))) {
      throw err;
    }
  }

  const decoded = verifyRefreshToken(refreshToken);

  // SECURITY: a refresh token revoked on logout (or explicitly revoked) must not
  // be able to mint fresh access tokens.
  const isRevoked = await tokenBlacklist.isBlacklisted(refreshToken);
  if (isRevoked) {
    throw new Error('Refresh token has been revoked. Please log in again.');
  }

  // Verify the user exists, is active, and password was not changed after token issuance
  const { pool } = await import('../../infrastructure/database/database.js');
  const { rows } = await pool.query(
    'SELECT id, email, role, is_active, is_verified, password_changed_at FROM users WHERE id = $1',
    [decoded.id]
  );
  const user = rows[0];
  if (!user || user.is_active === false) {
    throw new Error('User account is invalid or deactivated. Please log in again.');
  }

  // Profile-specific status check: ensure suspended/inactive profiles cannot refresh tokens
  if (decoded.role === 'seller') {
    const { rows: sellerRows } = await pool.query(
      'SELECT status FROM sellers WHERE user_id = $1 LIMIT 1',
      [decoded.id]
    );
    if (sellerRows[0] && sellerRows[0].status !== 'active') {
      throw new Error('Your seller account has been deactivated or suspended.');
    }
  } else if (decoded.role === 'creator') {
    const { rows: creatorRows } = await pool.query(
      'SELECT status FROM creators WHERE user_id = $1 LIMIT 1',
      [decoded.id]
    );
    if (creatorRows[0] && creatorRows[0].status !== 'active') {
      throw new Error('Your creator account has been deactivated or suspended.');
    }
  } else if (decoded.role === 'logistics') {
    const { rows: partnerRows } = await pool.query(
      'SELECT lp.active AS partner_active FROM users u LEFT JOIN logistics_partners lp ON u.id = lp.user_id WHERE u.id = $1 LIMIT 1',
      [decoded.id]
    );
    if (partnerRows[0] && partnerRows[0].partner_active === false) {
      throw new Error('Your logistics account has been deactivated or suspended.');
    }
  }

  if (user.password_changed_at) {
    const changedTimestamp = Math.floor(new Date(user.password_changed_at).getTime() / 1000);
    if (decoded.iat && decoded.iat < changedTimestamp) {
      throw new Error('Your password was recently changed. Please log in again.');
    }
  }

  // Blacklist the consumed refresh token (token rotation: old token is invalidated)
  await tokenBlacklist.addToken(refreshToken, decoded.exp);

  const accessSecret = process.env.JWT_SECRET;
  if (!accessSecret) throw new Error('JWT_SECRET must be configured');
  const accessToken = jwt.sign(
    { id: decoded.id, role: decoded.role, email: user.email },
    accessSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  const newRefreshToken = generateRefreshToken(decoded.id, decoded.role);

  const result = {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: decoded.id,
      role: decoded.role,
      email: user.email,
    },
  };

  // Cache in RFC 6819 grace period cache (30 seconds)
  try {
    await CacheService.set(graceKey, { data: result }, REFRESH_GRACE_WINDOW_SECONDS);
  } catch (_) { /* ignore cache write failures */ }
  _refreshGraceMemory.set(graceKey, {
    data: result,
    expiresAt: Date.now() + REFRESH_GRACE_WINDOW_SECONDS * 1000,
  });

  // Opportunistic cleanup of expired in-memory grace entries
  for (const [k, v] of _refreshGraceMemory.entries()) {
    if (v.expiresAt && v.expiresAt < Date.now()) _refreshGraceMemory.delete(k);
  }

  return result;
};

export default {
  generateRefreshToken,
  verifyRefreshToken,
  refreshAccessToken,
};
