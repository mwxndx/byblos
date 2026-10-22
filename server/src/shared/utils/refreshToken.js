import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import tokenBlacklist from '../../domains/identity/tokens/tokenBlacklist.service.js';
import CacheService from './cache.service.js';

// In-memory fallback map for RFC 6819 grace period when Redis is unavailable
const _refreshGraceMemory = new Map();
const REFRESH_GRACE_WINDOW_SECONDS = 30;

// Periodic cleanup of expired entries in memory map
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of _refreshGraceMemory.entries()) {
    if (val.expiresAt < now) _refreshGraceMemory.delete(key);
  }
}, 60 * 1000).unref();

/**
 * Generate a refresh token (longer-lived, uses JWT_REFRESH_SECRET)
 * Includes unique jti (RFC 7519) to ensure token uniqueness even within the same second.
 * @param {string|number} id - User ID
 * @param {string} role - User role
 * @returns {string} Refresh token
 */
export const generateRefreshToken = (id, role = 'buyer') => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET (or JWT_SECRET fallback) is not defined');
  }

  return jwt.sign(
    { id, role, type: 'refresh', jti: crypto.randomUUID() },
    secret,
    { algorithm: 'HS256', expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '90d' }
  );
};

/**
 * Verify a refresh token with zero-downtime secret rotation support
 * @param {string} token - Refresh token
 * @returns {Object} Decoded token
 */
export const verifyRefreshToken = (token) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET (or JWT_SECRET fallback) is not defined');
  }

  const previousSecrets = (process.env.JWT_REFRESH_PREVIOUS_SECRETS || process.env.JWT_PREVIOUS_SECRETS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const secretsToTry = [secret, ...previousSecrets];
  let lastError = null;

  for (const s of secretsToTry) {
    try {
      const decoded = jwt.verify(token, s);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      lastError = error;
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired. Please log in again.');
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

  // 1) RFC 6819 Grace Period check: if this refresh token was rotated within the last 30s,
  // return the cached response rather than throwing a revoked error on concurrent client requests.
  try {
    const cachedGrace = (await CacheService.get(graceKey)) || _refreshGraceMemory.get(graceKey);
    if (cachedGrace && cachedGrace.data) {
      return cachedGrace.data;
    }
  } catch {}

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

  // Access token always uses JWT_SECRET — separate from refresh secret
  const accessToken = jwt.sign(
    { id: decoded.id, role: decoded.role, email: user.email },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  // Rolling refresh: mint a brand-new refresh token on every refresh so a user
  // who keeps opening the app never has to log in again — the window slides
  // forward each time instead of expiring a fixed period after first login.
  const newRefreshToken = generateRefreshToken(decoded.id, decoded.role);

  const result = {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: decoded.id,
      role: decoded.role,
      email: user.email
    }
  };

  // Cache in RFC 6819 grace period cache (30 seconds)
  try {
    await CacheService.set(graceKey, { data: result }, REFRESH_GRACE_WINDOW_SECONDS);
  } catch {}
  _refreshGraceMemory.set(graceKey, {
    data: result,
    expiresAt: Date.now() + REFRESH_GRACE_WINDOW_SECONDS * 1000
  });

  return result;
};
