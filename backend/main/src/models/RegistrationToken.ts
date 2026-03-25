// backend/src/models/RegistrationToken.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import crypto from 'crypto';

export interface IRegistrationToken extends Document {
    token: string;
    userId: Types.ObjectId;
    label?: string;           // optional user-given label, e.g. "Gaming PC"
    expiresAt: Date;
    used: boolean;
    usedAt?: Date;
    usedByNodeId?: string;
    maxUses: number;
    useCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const registrationTokenSchema = new Schema<IRegistrationToken>(
    {
        token: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        label: {
            type: String,
            trim: true,
            maxlength: 64,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        used: {
            type: Boolean,
            default: false,
            index: true,
        },
        usedAt: Date,
        usedByNodeId: String,
        maxUses: {
            type: Number,
            default: 1,
            min: 1,
            max: 1, // single-use only for security
        },
        useCount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// TTL index: MongoDB will automatically remove expired tokens after 1 hour grace period
registrationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

// Static helper to generate a cryptographically secure token string
registrationTokenSchema.statics.generateTokenString = (): string => {
    // Format: BFXXX-XXXXX-XXXXX-XXXXX (easy to read / paste)
    const part = () => crypto.randomBytes(3).toString('hex').toUpperCase();
    return `BF${part()}-${part()}-${part()}-${part()}`;
};

export const RegistrationToken = mongoose.model<IRegistrationToken>(
    'RegistrationToken',
    registrationTokenSchema
);
