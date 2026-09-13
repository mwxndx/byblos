import logger from '../../shared/utils/logger.js';
import { getRedisClient } from '../../shared/config/redis.js';

const DEFAULT_TTL_SECONDS = 86400; // 24h — safe for terminal operations.
const REDIS_READ_TIMEOUT_MS = 2000; // Cap the cache lookup so a stalled Redis can't hang the request.

// Reject if `promise` doesn't settle within `ms`. The underlying promise keeps
// a no-op catch so a late settlement (e.g. an offline-queued command resolving
// after reconnect) never surfaces as an unhandled rejection.
const withTimeout = (promise, ms) => {
  promise.catch(() => {});
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('redis read timeout')), ms)),
  ]);
};

/**
 * Idempotency middleware factory. A successful (2xx) response is cached under
 * the request's Idempotency-Key for `ttlSeconds`; a later request carrying the
 * same key within that window replays the cached response instead of
 * re-running the handler.
 *
 * Choose the TTL by the operation's semantics:
 *   - Terminal / never-reversed actions (delete a user, create an order): the
 *     default 24h is fine — the same key always means the same outcome.
 *   - Toggleable actions (activate <-> suspend a seller): use a SHORT window
 *     (seconds) that only absorbs an accidental double-submit. A long TTL would
 *     replay a stale success and silently skip a later genuine re-toggle.
 *
 * @param {number} ttlSeconds cache lifetime for a replayable response.
 * @param {object} [deps] dependency overrides, for tests only; production call sites never pass this.
 * @param {() => unknown} [deps.getClient] defaults to the real Redis singleton.
 * @param {number} [deps.readTimeoutMs] cache-lookup timeout; defaults to REDIS_READ_TIMEOUT_MS.
 */
export const enforceIdempotency = (ttlSeconds = DEFAULT_TTL_SECONDS, { getClient = getRedisClient, readTimeoutMs = REDIS_READ_TIMEOUT_MS } = {}) => async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (!idempotencyKey) return next();

  let redisClient = null;
  try {
    redisClient = getClient();
  } catch (e) {
    redisClient = null;
  }

  // Fail open when Redis isn't ready. ioredis has its offline queue enabled in
  // production, so a get() against an unreachable server would queue forever
  // and hang the request — strictly worse than skipping idempotency. Gate on
  // readiness the same way createResilientRateLimiter does. The in-memory
  // fallback (used only when ioredis isn't installed) has no real connection
  // state but is always usable, so accept it via its own marker.
  const redisUsable = Boolean(redisClient) && (redisClient.status === 'ready' || redisClient.__inMemoryFallback === true);
  if (!redisUsable) return next();

  try {
    const cacheKey = `idempotency:${idempotencyKey}`;
    const cachedResponse = await withTimeout(redisClient.get(cacheKey), readTimeoutMs);

    if (cachedResponse) {
      logger.info(`[IDEMPOTENCY] Replayed cached response for key ${idempotencyKey}`);
      const { status, body } = JSON.parse(cachedResponse);
      return res.status(status).json(body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire-and-forget: never awaited, so a stalled write can't block the response.
        redisClient.setex(cacheKey, ttlSeconds, JSON.stringify({ status: res.statusCode, body })).catch(err => {
          logger.warn('[IDEMPOTENCY] Failed to cache response in Redis:', err.message);
        });
      }
      return originalJson(body);
    };
  } catch (err) {
    logger.warn('[IDEMPOTENCY] Redis error in idempotency middleware:', err.message);
  }

  next();
};

export default enforceIdempotency;
