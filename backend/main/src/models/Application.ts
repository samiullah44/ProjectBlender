import { Schema, model, Document, Types } from 'mongoose'

export interface IApplication extends Document {
    userId: Types.ObjectId
    status: 'pending' | 'approved' | 'rejected'
    applicationData: {
        operatingSystem: string
        cpuModel: string
        gpuModel: string
        ramSize: number
        storageSize: number
        internetSpeed: number
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
            operatingSystem: {
                type: String,
                required: true
            },
            cpuModel: {
                type: String,
                required: true
            },
            gpuModel: {
                type: String,
                required: true
            },
            ramSize: {
                type: Number,
                required: true
            },
            storageSize: {
                type: Number,
                required: true
            },
            internetSpeed: {
                type: Number,
                required: true
            },
            country: {
                type: String,
                required: true
            },
            ipAddress: {
                type: String,
                required: true
            },
            additionalNotes: String
        },
        rejectionReason: String,
        submittedAt: {
            type: Date,
            default: Date.now,
            required: true
        },
        reviewedAt: Date,
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    {
        timestamps: true
    }
)

// Indexes for efficient querying
applicationSchema.index({ userId: 1, status: 1 })
applicationSchema.index({ status: 1, submittedAt: -1 })

export const Application = model<IApplication>('Application', applicationSchema)
