import { createResilientRateLimiter } from './createResilientRateLimiter.js';
import logger from '../../shared/utils/logger.js';

const email = (req) => (req.body?.email || '').trim().toLowerCase();
const skipInDev = () => process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH_RATE_LIMIT === 'true';

const getDualKey = (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
    return `auth:${ip}:${email(req)}`;
};

const DUAL_KEY_OPTIONS = {
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getDualKey,
    handler: (req, res) => {
        logger.warn('[RATE-LIMIT] Dual-key auth rate limit exceeded', {
            key: getDualKey(req), ip: req.ip, email: req.body?.email, path: req.path
        });
        res.status(429).json({
            status: 'fail',
            message: 'Too many login attempts for this IP and account. Please try again in 15 minutes.',
            retryAfter: 900
        });
    },
    skip: skipInDev,
};

// Account-only counter (IP-independent). Without this, the per-(IP,email) limit
// above is bypassable by rotating source IPs, leaving a single account
// effectively unbounded to credential stuffing. Keyed by email alone so every
// attempt against one account shares a counter regardless of origin IP.
// Threshold is deliberately generous (a legitimate user never makes 30 login
// attempts in 15 min) to cap distributed brute force while limiting the
// account-lockout-DoS window a spammer could impose on a victim's email.
// ponytail: fixed 30/15min per account; revisit if lockout abuse shows up.
const ACCOUNT_OPTIONS = {
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: email,
    handler: (req, res) => {
        logger.warn('[RATE-LIMIT] Account auth rate limit exceeded (IP-independent)', {
            email: req.body?.email, ip: req.ip, path: req.path
        });
        res.status(429).json({
            status: 'fail',
            message: 'Too many login attempts for this account. Please try again in 15 minutes.',
            retryAfter: 900
        });
    },
    // Only applies to requests that name an account; requests without an email
    // (e.g. refresh-token) are covered by the per-(IP,email) limiter only, and
    // must not all collide on one empty-string key.
    skip: (req) => skipInDev() || !email(req),
};

const dualKeyLimiter = createResilientRateLimiter('auth', DUAL_KEY_OPTIONS);
const accountLimiter = createResilientRateLimiter('auth-account', ACCOUNT_OPTIONS);

/**
 * Fail-open auth rate limiter. Runs two Redis-backed (fail-open to in-memory)
 * counters in sequence:
 *   1. per (IP, email) — blocks single-origin brute force (10 / 15 min)
 *   2. per account/email, IP-independent — blocks IP-rotating credential
 *      stuffing against one account (30 / 15 min)
 * The account counter runs only if the dual-key counter didn't already 429.
 * Every existing `authLimiter` route gets both layers with no route changes.
 */
export const authLimiter = (req, res, next) =>
    dualKeyLimiter(req, res, () => {
        if (res.headersSent) return; // dual-key limit already responded
        return accountLimiter(req, res, next);
    });
