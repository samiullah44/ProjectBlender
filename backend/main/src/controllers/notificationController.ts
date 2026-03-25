import { Request, Response } from 'express'
import { notificationService } from '../services/NotificationService'

// No custom interface needed, using standard Request with cast for user property


export class NotificationController {
    // Get user notifications
    static async getNotifications(req: Request, res: Response) {
        try {
            const userId = (req as any).user!.userId
            const limit = parseInt(req.query.limit as string) || 20
            const skip = parseInt(req.query.skip as string) || 0

            const notifications = await notificationService.getUserNotifications(userId, limit, skip)

            res.json({
                success: true,
                notifications
            })
        } catch (error: any) {
            console.error('Get notifications error:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to fetch notifications'
            })
        }
    }

    // Get unread count
    static async getUnreadCount(req: Request, res: Response) {
        try {
            const userId = (req as any).user!.userId
            const count = await notificationService.getUnreadCount(userId)

            res.json({
                success: true,
                count
            })
        } catch (error: any) {
            console.error('Get unread count error:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to fetch unread count'
            })
        }
    }

    // Mark notification as read
    static async markAsRead(req: Request, res: Response) {
        try {
            const userId = (req as any).user!.userId
            const id = req.params.id as string

            const success = await notificationService.markAsRead(id, userId)

            if (success) {
                res.json({
                    success: true,
                    message: 'Notification marked as read'
                })
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                })
            }
        } catch (error: any) {
            console.error('Mark as read error:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to mark notification as read'
            })
        }
    }

    // Mark all as read
    static async markAllAsRead(req: Request, res: Response) {
        try {
            const userId = (req as any).user!.userId
            const count = await notificationService.markAllAsRead(userId)

            res.json({
                success: true,
                message: `${count} notifications marked as read`
            })
        } catch (error: any) {
            console.error('Mark all as read error:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to mark all notifications as read'
            })
        }
    }

    // Delete notification
    static async deleteNotification(req: Request, res: Response) {
        try {
            const userId = (req as any).user!.userId
            const id = req.params.id as string

            const success = await notificationService.deleteNotification(id, userId)

            if (success) {
                res.json({
                    success: true,
                    message: 'Notification deleted'
                })
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                })
            }
        } catch (error: any) {
            console.error('Delete notification error:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to delete notification'
            })
        }
    }
}

export default NotificationController
