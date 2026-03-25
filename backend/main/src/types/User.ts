// backend/src/types/User.ts
import mongoose, { Types } from 'mongoose';

export interface IUser {
    _id: Types.ObjectId;
    email: string;
    username: string;
    name: string;
    password?: string;
    isVerified: boolean;
    role: 'client' | 'node_provider' | 'admin';
    credits: number;

    // OAuth fields
    provider?: 'google' | 'github' | 'local';
    providerId?: string;

    // OTP fields
    otp?: string;
    expiresAt?: Date;

    // Node provider specific fields
    nodeProvider?: {
        nodeId?: string;
        nodeName?: string;
        earnings: number;
    };

    // Preferences
    preferences?: {
        defaultProjectId?: string;
        notificationEnabled?: boolean;
    };

    // Stats
    stats?: {
        jobsCreated: number;
        framesRendered: number;
        totalSpent: number;
        totalEarned: number;
    };

    // Timestamps
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserMethods {
    comparePassword(password: string): Promise<boolean>;
    addCredits(amount: number): Promise<void>;
    deductCredits(amount: number): Promise<void>;
    addEarnings(amount: number): Promise<void>;
}

export interface IUserModel extends mongoose.Model<IUser, {}, IUserMethods> {
    findByEmail(email: string): Promise<IUser | null>;
    findByUsername(username: string): Promise<IUser | null>;
    countByRole(role: 'client' | 'node_provider' | 'admin'): Promise<number>;
}