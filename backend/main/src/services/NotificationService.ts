import { Notification, INotification } from '../models/Notification'
import { Types } from 'mongoose'

export class NotificationService {
    // Create a new notification
    async createNotification(
        userId: string | Types.ObjectId,
        type: 'application_approved' | 'application_rejected' | 'system' | 'job_update',
        title: string,
        message: string,
        metadata?: any
    ): Promise<INotification> {
        try {
            const notification = await Notification.create({
                userId,
                type,
                title,
                message,
                metadata: metadata || {}
            })

            return notification
        } catch (error) {
            console.error('Create notification error:', error)
            throw error
        }
    }

    // Get user notifications with pagination
    async getUserNotifications(
        userId: string,
        limit: number = 20,
        skip: number = 0
    ): Promise<INotification[]> {
        try {
            const notifications = await Notification.find({ userId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip)
                .lean()

            return notifications as any as INotification[]
        } catch (error) {
            console.error('Get user notifications error:', error)
            throw error
        }
    }

    // Get unread notification count
    async getUnreadCount(userId: string): Promise<number> {
        try {
            const count = await Notification.countDocuments({
                userId,
                read: false
            })

            return count
        } catch (error) {
            console.error('Get unread count error:', error)
            throw error
        }
    }

    // Mark notification as read
    async markAsRead(notificationId: string, userId: string): Promise<boolean> {
        try {
            const result = await Notification.updateOne(
                { _id: notificationId, userId },
                { $set: { read: true } }
            )

            return result.modifiedCount > 0
        } catch (error) {
            console.error('Mark as read error:', error)
            throw error
        }
    }

    // Mark all notifications as read
    async markAllAsRead(userId: string): Promise<number> {
        try {
            const result = await Notification.updateMany(
                { userId, read: false },
                { $set: { read: true } }
            )

            return result.modifiedCount
        } catch (error) {
            console.error('Mark all as read error:', error)
            throw error
        }
    }

    // Delete notification
    async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
        try {
            const result = await Notification.deleteOne({
                _id: notificationId,
                userId
            })

            return result.deletedCount > 0
        } catch (error) {
            console.error('Delete notification error:', error)
            throw error
        }
    }

    // Get recent notifications (for dropdown)
    async getRecentNotifications(userId: string, limit: number = 10): Promise<INotification[]> {
        return this.getUserNotifications(userId, limit, 0)
    }
}

export const notificationService = new NotificationService()
