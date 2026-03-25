// backend/src/models/OTP.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IOTP extends Document {
    email: string;
    otp: string;
    expiresAt: Date;
    createdAt: Date;
}

const otpSchema = new Schema<IOTP>({
    email: {
        type: String,
        required: true,
        index: true
    },
    otp: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true,
        expires: 600 // Auto-delete after 10 minutes (600 seconds)
    }
}, {
    timestamps: true
});

// Index for faster lookups
otpSchema.index({ email: 1, otp: 1 });

export const OTP = mongoose.model<IOTP>('OTP', otpSchema);