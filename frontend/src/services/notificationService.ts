import { axiosInstance } from '@/lib/axios'

export interface Notification {
    _id: string
    userId: string
    type: 'application_approved' | 'application_rejected' | 'system' | 'job_update'
    title: string
    message: string
    read: boolean
    metadata?: {
        applicationId?: string
        jobId?: string
        [key: string]: any
    }
    createdAt: string
    updatedAt: string
}

export interface NotificationResponse {
    success: boolean
    notifications?: Notification[]
    count?: number
    message?: string
    error?: string
}

export const notificationService = {
    // Get user notifications
    async getNotifications(limit: number = 20, skip: number = 0): Promise<NotificationResponse> {
        try {
            const response = await axiosInstance.get(`/notifications?limit=${limit}&skip=${skip}`)
            return response.data
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to fetch notifications'
            }
        }
    },

    // Get unread count
    async getUnreadCount(): Promise<{ success: boolean; count: number }> {
        try {
            const response = await axiosInstance.get('/notifications/unread-count')
            return response.data
        } catch (error: any) {
            return {
                success: false,
                count: 0
            }
        }
    },

    // Mark notification as read
    async markAsRead(id: string): Promise<NotificationResponse> {
        try {
            const response = await axiosInstance.put(`/notifications/${id}/read`)
            return response.data
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to mark notification as read'
            }
        }
    },

    // Mark all as read
    async markAllAsRead(): Promise<NotificationResponse> {
        try {
            const response = await axiosInstance.put('/notifications/read-all')
            return response.data
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to mark all as read'
            }
        }
    },

    // Delete notification
    async deleteNotification(id: string): Promise<NotificationResponse> {
        try {
            const response = await axiosInstance.delete(`/notifications/${id}`)
            return response.data
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to delete notification'
            }
        }
    }
}
