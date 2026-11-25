/**
 * Clamp a query `limit` parameter between 1 and `maxLimit`.
 * Falls back to `defaultLimit` when missing or non-numeric.
 */
export function clampLimit(rawLimit, defaultLimit = 20, maxLimit = 100) {
  const parsed = Number.parseInt(String(rawLimit ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }
  return Math.min(maxLimit, parsed);
}

/**
 * Clamp a query `offset` parameter to a non-negative integer.
 */
export function clampOffset(rawOffset) {
  const parsed = Number.parseInt(String(rawOffset ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

