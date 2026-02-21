import { Schema, model, Document, Types } from 'mongoose'

export interface INotification extends Document {
    userId: Types.ObjectId
    type: 'application_approved' | 'application_rejected' | 'system' | 'job_update' | 'node_registered' | 'node_revoked'
    title: string
    message: string
    read: boolean
    metadata?: {
        applicationId?: Types.ObjectId
        jobId?: Types.ObjectId
        [key: string]: any
    }
    createdAt: Date
    updatedAt: Date
}

const notificationSchema = new Schema<INotification>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: ['application_approved', 'application_rejected', 'system', 'job_update', 'node_registered', 'node_revoked'],
            required: true
        },
        title: {
            type: String,
            required: true
        },
        message: {
            type: String,
            required: true
        },
        read: {
            type: Boolean,
            default: false,
            index: true
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
)

// Compound indexes for efficient querying
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, read: 1 })

export const Notification = model<INotification>('Notification', notificationSchema)
