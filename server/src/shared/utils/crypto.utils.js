import crypto from 'node:crypto';

/**
 * Constant-time comparison of two strings or tokens.
 * Hashes both inputs with SHA-256 before crypto.timingSafeEqual to prevent
 * early length disclosure (length leaks) and ensure fixed 32-byte comparisons.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean} true if both values are strings and identically match
 */
export function timingSafeEqualString(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const aHash = crypto.createHash('sha256').update(a).digest();
    const bHash = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(aHash, bHash);
}

export default {
    timingSafeEqualString
};
