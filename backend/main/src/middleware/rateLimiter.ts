// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// General rate limiter for all auth routes
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per IP
    message: {
        success: false,
        error: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
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
    legacyHeaders: false
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
    legacyHeaders: false
});