// backend/src/middleware/rateLimiter.ts
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// General rate limiter for all auth routes
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per IP
    message: {
        success: false,
        error: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }
});

// Stricter limiter for login/register
export const strictAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per IP
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }
});

// OAuth rate limiter
export const oauthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per IP
    message: {
        success: false,
        error: 'Too many OAuth attempts, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }
});

/**
 * Rate limiter for registration token verification.
 * Prevents brute-force token guessing: max 5 attempts / 15 min per IP.
 */
export const tokenVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many registration attempts from this IP. Locked out for 15 minutes.',
    },
    validate: { trustProxy: false }
});

/**
 * Rate limiter for token generation (node_provider dashboard).
 * Max 20 tokens generated per user per hour.
 */
export const tokenGenerateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => req.user?.userId || ipKeyGenerator(req.ip || ''),
    message: {
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Token generation limit reached (20 per hour).',
    },
    validate: { trustProxy: false }
});