// backend/src/config/passport.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { User } from '../models/User';
import { env } from './env';
import fetch from 'node-fetch';

// Serialize/Deserialize user
passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: env.googleClientId,
    clientSecret: env.googleClientSecret,
    callbackURL: `${env.backendUrl}/api/auth/google/callback`,
    passReqToCallback: true
},
    async (req: any, accessToken: string, refreshToken: string, params: any, profile: any, done: any) => {
        try {
            console.log('🔐 Google OAuth - Profile:', profile.id);

            // Extract state from query
            let stateData = { siteId: 'blenderfarm', redirectUrl: env.frontendUrl };
            if (req.query.state) {
                try {
                    stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
                } catch (e) {
                    console.warn('Could not parse state:', (e as Error).message);
                }
            }

            // Get user email
            const email = profile.emails[0].value;

            // Find or create user
            let user = await User.findOne({ email });

            if (!user) {
                user = new User({
                    email,
                    username: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').substring(0, 20),
                    name: profile.displayName,
                    provider: 'google',
                    providerId: profile.id,
                    role: 'client',
                    credits: 1000,
                    isVerified: true,
                    stats: {
                        jobsCreated: 0,
                        framesRendered: 0,
                        totalSpent: 0,
                        totalEarned: 0
                    }
                });

                await user.save();
                console.log('✅ New Google user created:', user.email);
            } else if (!user.provider) {
                user.provider = 'google';
                user.providerId = profile.id;
                user.isVerified = true;
                await user.save();
                console.log('✅ Existing user linked to Google:', user.email);
            }

            // Update last login
            user.lastLoginAt = new Date();
            await user.save();

            // Attach state data to user object for callback
            user._oauthState = stateData;

            return done(null, user);
        } catch (err) {
            console.error('❌ Google OAuth error:', err);
            return done(err);
        }
    }
));

// GitHub Strategy
passport.use(new GitHubStrategy({
    clientID: env.githubClientId,
    clientSecret: env.githubClientSecret,
    callbackURL: `${env.backendUrl}/api/auth/github/callback`,
    scope: ['user:email'],
    passReqToCallback: true
},
    async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
            console.log('🔐 GitHub OAuth - Profile:', profile.username);

            // Extract state from session
            const siteId = req.session?.siteId || 'blenderfarm';
            const redirectUrl = req.session?.redirectUrl || env.frontendUrl;

            // Get user email
            let email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

            if (!email) {
                // Fetch email from GitHub API
                const response = await fetch('https://api.github.com/user/emails', {
                    headers: {
                        'Authorization': `token ${accessToken}`,
                        'User-Agent': 'Node.js'
                    }
                });

                const emails = await response.json() as any[];
                const primaryEmail = emails.find(e => e.primary && e.verified);
                email = primaryEmail ? primaryEmail.email : null;
            }

            if (!email) {
                return done(new Error('No email provided by GitHub'));
            }

            // Find or create user
            let user = await User.findOne({ email });

            if (!user) {
                user = new User({
                    email,
                    username: profile.username || email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').substring(0, 20),
                    name: profile.displayName || profile.username,
                    provider: 'github',
                    providerId: profile.id,
                    role: 'client',
                    credits: 1000,
                    isVerified: true,
                    stats: {
                        jobsCreated: 0,
                        framesRendered: 0,
                        totalSpent: 0,
                        totalEarned: 0
                    }
                });

                await user.save();
                console.log('✅ New GitHub user created:', user.email);
            } else if (!user.provider) {
                user.provider = 'github';
                user.providerId = profile.id;
                user.isVerified = true;
                await user.save();
                console.log('✅ Existing user linked to GitHub:', user.email);
            }

            // Update last login
            user.lastLoginAt = new Date();
            await user.save();

            // Attach redirect URL to user object
            user._oauthState = { siteId, redirectUrl };

            return done(null, user);
        } catch (err) {
            console.error('❌ GitHub OAuth error:', err);
            return done(err);
        }
    }
));

export default passport;