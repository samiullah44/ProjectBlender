// backend/src/models/Application.ts
import { Schema, model, Document, Types } from 'mongoose'

export interface IApplication extends Document {
    userId: Types.ObjectId
    status: 'pending' | 'approved' | 'rejected'
    applicationData: {
        operatingSystem: string
        cpuModel: string
        cpuCores: number              // ✅ ADDED
        gpuModel: string
        gpuVram: number                // ✅ ADDED
        gpuCount: number                // ✅ ADDED
        ramSize: number
        storageSize: number
        storageType: 'ssd' | 'hdd'     // ✅ ADDED
        internetSpeed: number           // Download speed
        uploadSpeed: number              // ✅ ADDED
        country: string
        ipAddress: string
        additionalNotes?: string
    }
    rejectionReason?: string
    submittedAt: Date
    reviewedAt?: Date
    reviewedBy?: Types.ObjectId
    createdAt: Date
    updatedAt: Date
}

const applicationSchema = new Schema<IApplication>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            required: true,
            index: true
        },
        applicationData: {
            operatingSystem: { type: String, required: true },
            cpuModel: { type: String, required: true },
            cpuCores: { type: Number, required: true, min: 1 },        // ✅ ADDED
            gpuModel: { type: String, required: true },
            gpuVram: { type: Number, required: true, min: 1 },          // ✅ ADDED
            gpuCount: { type: Number, default: 1, min: 1, max: 8 },     // ✅ ADDED
            ramSize: { type: Number, required: true, min: 1 },
            storageSize: { type: Number, required: true, min: 1 },
            storageType: {                                               // ✅ ADDED
                type: String,
                enum: ['ssd', 'hdd'],
                required: true,
                default: 'ssd'
            },
            internetSpeed: { type: Number, required: true, min: 0 },    // Download
            uploadSpeed: { type: Number, required: true, min: 0 },      // ✅ ADDED
            country: { type: String, required: true },
            ipAddress: { type: String, required: true },
            additionalNotes: String
        },
        rejectionReason: String,
        submittedAt: { type: Date, default: Date.now, required: true },
        reviewedAt: Date,
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
)

// Indexes
applicationSchema.index({ userId: 1, status: 1 })
applicationSchema.index({ status: 1, submittedAt: -1 })
applicationSchema.index({ 'applicationData.gpuVram': 1 })          // ✅ ADDED
applicationSchema.index({ 'applicationData.uploadSpeed': 1 })      // ✅ ADDED

export const Application = model<IApplication>('Application', applicationSchema)