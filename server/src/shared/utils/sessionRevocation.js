// Session revocation helpers shared by every role's logout handler.
//
// AUTH FIX: logout previously blacklisted ONLY the 24h access token, leaving the
// 90-day refresh token fully valid — and the refresh flow never consulted the
// blacklist. A logged-out (or stolen post-logout) refresh token could therefore
// mint fresh access tokens for up to 90 days. Revoking BOTH tokens on logout,
// combined with the blacklist check added to refreshAccessToken(), makes logout
// actually terminate the session.
import tokenBlacklist from '../../domains/identity/tokens/tokenBlacklist.service.js';
import { getTokenFromRequest, verifyToken } from './jwt.js';
import { verifyRefreshToken } from './refreshToken.js';
import { invalidateAuthCacheForUser } from './authCache.js';
import CacheService from './cache.service.js';
import logger from './logger.js';

/**
 * Blacklist both the access token and the refresh token attached to a request.
 * Each token is decoded with its own secret to derive the correct TTL; failures
 * (expired/invalid/malformed) are non-fatal — logout must always succeed.
 * @param {import('express').Request} req
 */
export async function revokeSessionTokens(req) {
  // 1) Access token — Authorization header, x-access-token, or jwt cookie.
  const accessToken = getTokenFromRequest(req);
  if (accessToken) {
    try {
      const decoded = verifyToken(accessToken);
      await tokenBlacklist.addToken(accessToken, decoded.exp);
    } catch (err) {
      logger.debug('[LOGOUT] Could not blacklist access token:', err.message);
    }
  }

  // 2) Refresh token — cookie or body; signed with the separate refresh secret.
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (refreshToken && typeof refreshToken === 'string') {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      await tokenBlacklist.addToken(refreshToken, decoded.exp);
    } catch (err) {
      logger.debug('[LOGOUT] Could not blacklist refresh token:', err.message);
    }
  }
}

/**
 * Clear all auth cookies (access jwt/token + refresh) so the browser session ends.
 * @param {import('express').Response} res
 */
export function clearAuthCookies(res) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    expires: new Date(0),
  };
  res.cookie('jwt', '', { ...base, path: '/' });
  res.cookie('token', '', { ...base, path: '/' });
  res.cookie('refreshToken', '', { ...base, path: '/' });
  res.cookie('refreshToken', '', { ...base, path: '/api/auth/refresh-token' });
}

/**
 * Invalidate all sessions, caches, and permissions for a user immediately (ban/suspension/deletion/password reset).
 * 1. Purges user tokens from the in-memory _authCache.
 * 2. Clears Redis permissions and cross-role caches.
 * 3. Updates users.password_changed_at = NOW() (if user row exists) to invalidate all existing JWTs and refresh tokens.
 * @param {string|number} userId
 */
export async function invalidateUserSessions(userId) {
  if (!userId) return;

  // 1) Invalidate in-memory authCache
  try {
    invalidateAuthCacheForUser(userId);
  } catch (err) {
    logger.warn(`[SESSION_REVOCATION] Failed to clear authCache for user ${userId}:`, err.message);
  }

  // 2) Invalidate Redis caches
  try {
    await Promise.all([
      CacheService.delete(`user:${userId}:cross-roles`),
      CacheService.delete(`user:permissions:${userId}`),
      CacheService.delete(`user:${userId}:permissions`),
    ]);
  } catch (err) {
    logger.warn(`[SESSION_REVOCATION] Failed to clear Redis keys for user ${userId}:`, err.message);
  }

  // 3) Bump password_changed_at in database to instantly invalidate all in-flight JWTs and refresh tokens
  try {
    const { pool } = await import('../../infrastructure/database/database.js');
    await pool.query(
      'UPDATE users SET password_changed_at = NOW(), updated_at = NOW() WHERE id = $1',
      [userId]
    );
  } catch (err) {
    logger.warn(`[SESSION_REVOCATION] Failed to bump password_changed_at for user ${userId}:`, err.message);
  }
}

export default { revokeSessionTokens, clearAuthCookies, invalidateUserSessions };
