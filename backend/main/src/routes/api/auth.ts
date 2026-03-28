// backend/src/routes/api/auth.ts
import express from 'express';
import passport from 'passport';
import { AuthController } from '../../controllers/authController';
import { IUser } from '../../models/User';
import { authLimiter, strictAuthLimiter, oauthLimiter } from '../../middleware/rateLimiter';
import { authenticate, authorize } from '../../middleware/auth';
import { env } from '../../config/env';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Public routes
router.post('/register', strictAuthLimiter, AuthController.register);
router.post('/verify-otp', strictAuthLimiter, AuthController.verifyOTP);
router.post('/login', strictAuthLimiter, AuthController.login);
router.post('/forgot-password', authLimiter, AuthController.forgotPassword);
router.post('/reset-password', authLimiter, AuthController.resetPassword);
router.post('/resend-otp', authLimiter, AuthController.resendOTP);
router.get('/health', AuthController.healthCheck);

// OAuth routes
// Helper to encode state
const encodeState = (data: any): string => {
    return Buffer.from(JSON.stringify(data)).toString('base64');
};

// Helper to validate redirect URL
const validateRedirectUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        return env.allowedOrigins.includes(parsed.origin);
    } catch {
        return false;
    }
};

// Google OAuth
router.get('/google', oauthLimiter, (req, res, next) => {
    const redirectUrl = req.query.redirectUrl as string || env.frontendUrl;
    const finalRedirectUrl = validateRedirectUrl(redirectUrl) ? redirectUrl : env.frontendUrl;

    const state = encodeState({
        redirectUrl: finalRedirectUrl,
        timestamp: Date.now()
    });

    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state,
        prompt: 'select_account'
    })(req, res, next);
});

router.get('/google/callback', oauthLimiter, (req, res, next) => {
    passport.authenticate('google', { session: false }, (err: any, user: IUser | false | null, info: any) => {
        if (err || !user) {
            console.error('Google OAuth error:', err || 'No user');
            const redirectUrl = env.frontendUrl + '?auth=failed';
            return res.redirect(redirectUrl);
        }

        try {
            // Decode state
            let redirectUrl = env.frontendUrl;
            if (req.query.state) {
                const state = JSON.parse(Buffer.from(req.query.state as string, 'base64').toString());
                if (validateRedirectUrl(state.redirectUrl)) {
                    redirectUrl = state.redirectUrl;
                }
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    userId: user._id,
                    email: user.email,
                    role: user.role,
                    roles: user.roles || [user.role],
                    primaryRole: user.primaryRole,
                    username: user.username,
                    name: user.name
                },
                env.jwtSecret!,
                { expiresIn: env.jwtExpiry as any }
            );

            // Redirect with token
            const finalUrl = `${redirectUrl}?token=${token}&auth=success&provider=google`;
            res.redirect(finalUrl);
        } catch (error) {
            console.error('Google callback error:', error);
            res.redirect(env.frontendUrl + '?auth=error');
        }
    })(req, res, next);
});

// GitHub OAuth
router.get('/github', oauthLimiter, (req, res, next) => {
    const redirectUrl = req.query.redirectUrl as string || env.frontendUrl;

    // Store in session
    req.session.redirectUrl = validateRedirectUrl(redirectUrl) ? redirectUrl : env.frontendUrl;
    req.session.siteId = 'blenderfarm';

    passport.authenticate('github', {
        scope: ['user:email'],
        prompt: 'login'
    })(req, res, next);
});

router.get('/github/callback', oauthLimiter, (req, res, next) => {
    passport.authenticate('github', { session: false }, (err: any, user: IUser | false | null, info: any) => {
        if (err || !user) {
            console.error('GitHub OAuth error:', err || 'No user');
            const redirectUrl = env.frontendUrl + '?auth=failed';
            return res.redirect(redirectUrl);
        }

        try {
            // Get redirect URL from session
            let redirectUrl = req.session?.redirectUrl || env.frontendUrl;
            delete req.session.redirectUrl;
            delete req.session.siteId;

            // Generate JWT token
            const token = jwt.sign(
                {
                    userId: user._id,
                    email: user.email,
                    role: user.role,
                    roles: user.roles || [user.role],
                    primaryRole: user.primaryRole,
                    username: user.username,
                    name: user.name
                },
                env.jwtSecret!,
                { expiresIn: env.jwtExpiry as any }
            );

            // Redirect with token
            const finalUrl = `${redirectUrl}?token=${token}&auth=success&provider=github`;
            res.redirect(finalUrl);
        } catch (error) {
            console.error('GitHub callback error:', error);
            res.redirect(env.frontendUrl + '?auth=error');
        }
    })(req, res, next);
});

// Protected routes
router.get('/profile', authenticate, AuthController.getProfile);
router.put('/profile', authenticate, AuthController.updateProfile);
router.post('/apply-node-provider', authenticate, AuthController.applyAsNodeProvider);
router.put('/primary-role', authenticate, AuthController.updatePrimaryRole);
router.post('/sync-deposit', authenticate, AuthController.syncDeposit);

// Admin routes
router.post('/add-credits', authenticate, authorize('admin'), AuthController.addCredits);
router.get('/admin/applications', authenticate, authorize('admin'), AuthController.getApplications);
router.post('/admin/applications/:userId/approve', authenticate, authorize('admin'), AuthController.approveApplication);
router.post('/admin/applications/:userId/reject', authenticate, authorize('admin'), AuthController.rejectApplication);

export default router;