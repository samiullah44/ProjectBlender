import { create } from 'zustand'
import { notificationService } from '@/services/notificationService'
import type { Notification } from '@/services/notificationService'

interface NotificationState {
    notifications: Notification[]
    unreadCount: number
    isLoading: boolean
    error: string | null

    // Actions
    fetchNotifications: (limit?: number, skip?: number) => Promise<void>
    fetchUnreadCount: () => Promise<void>
    addNotification: (notification: Notification) => void
    markAsRead: (id: string) => Promise<void>
    markAllAsRead: () => Promise<void>
    deleteNotification: (id: string) => Promise<void>
    clearError: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,

    fetchNotifications: async (limit = 20, skip = 0) => {
        set({ isLoading: true, error: null })
        const response = await notificationService.getNotifications(limit, skip)
        if (response.success && response.notifications) {
            set({
                notifications: skip === 0 ? response.notifications : [...get().notifications, ...response.notifications],
                isLoading: false
            })
        } else {
            set({ error: response.error || 'Failed to fetch notifications', isLoading: false })
        }
    },

    fetchUnreadCount: async () => {
        const response = await notificationService.getUnreadCount()
        if (response.success) {
            set({ unreadCount: response.count })
        }
    },

    addNotification: (notification: Notification) => {
        set((state) => ({
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + 1
        }))
    },

    markAsRead: async (id: string) => {
        const response = await notificationService.markAsRead(id)
        if (response.success) {
            set((state) => ({
                notifications: state.notifications.map((n) =>
                    n._id === id ? { ...n, read: true } : n
                ),
                unreadCount: Math.max(0, state.unreadCount - 1)
            }))
        }
    },

    markAllAsRead: async () => {
        const response = await notificationService.markAllAsRead()
        if (response.success) {
            set((state) => ({
                notifications: state.notifications.map((n) => ({ ...n, read: true })),
                unreadCount: 0
            }))
        }
    },

    deleteNotification: async (id: string) => {
        const response = await notificationService.deleteNotification(id)
        if (response.success) {
            set((state) => {
                const notification = state.notifications.find(n => n._id === id)
                const newUnreadCount = notification && !notification.read
                    ? Math.max(0, state.unreadCount - 1)
                    : state.unreadCount

                return {
                    notifications: state.notifications.filter((n) => n._id !== id),
                    unreadCount: newUnreadCount
                }
            })
        }
    },

    clearError: () => set({ error: null })
}))
