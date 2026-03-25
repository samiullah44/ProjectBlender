// backend/src/services/OAuthService.ts
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { env } from '../config/env';

export interface OAuthProfile {
    email: string;
    name: string;
    picture?: string;
    provider: 'google' | 'github';
    providerId: string;
}

export class OAuthService {
    // Find or create user from OAuth profile
    async findOrCreateUser(profile: OAuthProfile, role: 'client' | 'node_provider' = 'client') {
        try {
            // Try to find existing user by email
            let user = await User.findOne({ email: profile.email });

            if (!user) {
                // Create new user
                user = new User({
                    email: profile.email,
                    username: this.generateUsername(profile.email),
                    name: profile.name,
                    provider: profile.provider,
                    providerId: profile.providerId,
                    role,
                    credits: role === 'node_provider' ? 0 : 1000,
                    isVerified: true, // OAuth users are automatically verified
                    stats: {
                        jobsCreated: 0,
                        framesRendered: 0,
                        totalSpent: 0,
                        totalEarned: 0
                    }
                });

                await user.save();
                console.log(`✅ New ${profile.provider} user created: ${user.email}`);
            } else if (!user.provider) {
                // Link existing account to OAuth provider
                user.provider = profile.provider;
                user.providerId = profile.providerId;
                user.isVerified = true;
                await user.save();
                console.log(`✅ Existing user linked to ${profile.provider}: ${user.email}`);
            }

            // Update last login
            user.lastLoginAt = new Date();
            await user.save();

            // Generate JWT token
            const token = this.generateToken(user);

            return {
                success: true,
                token,
                user: {
                    id: user._id.toString(),
                    email: user.email,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    credits: user.credits,
                    isVerified: user.isVerified,
                    provider: user.provider
                }
            };

        } catch (error: any) {
            console.error('OAuth user creation error:', error);
            return {
                success: false,
                error: error.message || 'Failed to authenticate with OAuth'
            };
        }
    }

    // Generate username from email
    private generateUsername(email: string): string {
        const username = email.split('@')[0] || '';
        return username.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    }

    private generateToken(user: any): string {
        return jwt.sign(
            {
                userId: user._id,
                email: user.email,
                role: user.role,
                username: user.username,
                name: user.name
            },
            env.jwtSecret!,
            { expiresIn: env.jwtExpiry as any }
        );
    }

    // Verify JWT token
    verifyToken(token: string): any {
        try {
            return jwt.verify(token, env.jwtSecret!);
        } catch (error) {
            return null;
        }
    }
}

export const oauthService = new OAuthService();