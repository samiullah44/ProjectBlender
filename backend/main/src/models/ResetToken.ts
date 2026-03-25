// backend/src/models/ResetToken.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IResetToken extends Document {
    token: string;
    email: string;
    expiresAt: Date;
    createdAt: Date;
}

const resetTokenSchema = new Schema<IResetToken>({
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true,
        expires: 3600 // Auto-delete after 1 hour (3600 seconds)
    }
}, {
    timestamps: true
});

export const ResetToken = mongoose.model<IResetToken>('ResetToken', resetTokenSchema);