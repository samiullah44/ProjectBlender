import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'

export const NotificationBell: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const {
        notifications,
        unreadCount,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification
    } = useNotificationStore()
    const { user } = useAuthStore()
    const navigate = useNavigate()

    const activeRole = user?.primaryRole || user?.role;
    const isProvider = activeRole === 'node_provider';

    useOnClickOutside(containerRef, () => {
        if (isOpen) setIsOpen(false)
    })

    useEffect(() => {
        fetchUnreadCount()
        fetchNotifications(5) // Get the 5 most recent for the bell
    }, [fetchNotifications, fetchUnreadCount])

    const handleToggle = () => setIsOpen(!isOpen)

    const handleNotificationClick = async (notification: any) => {
        if (!notification.read) {
            await markAsRead(notification._id)
        }

        setIsOpen(false)

        // Navigate based on type
        if (notification.type === 'application_approved') {
            navigate('/node/dashboard')
        } else if (notification.type === 'application_rejected') {
            navigate('/client/dashboard')
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'application_approved':
                return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            case 'application_rejected':
                return <XCircle className="w-5 h-5 text-red-400" />
            case 'system':
                return <Clock className="w-5 h-5 text-blue-400" />
            default:
                return <Bell className="w-5 h-5 text-gray-400" />
        }
    }

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={handleToggle}
                className="relative p-2 rounded-lg hover:bg-white/5 transition-colors group"
                aria-label="Notifications"
            >
                <Bell className={cn(
                    "w-5 h-5 text-gray-300 group-hover:text-white transition-colors",
                    isOpen && "text-white"
                )} />
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-gray-950"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop for mobile */}
                        <div
                            className="fixed inset-0 z-10 lg:hidden"
                            onClick={() => setIsOpen(false)}
                        />

                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute right-0 mt-2 w-[350px] sm:w-[400px] rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl z-20 overflow-hidden"
                        >
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <h3 className="font-semibold text-white">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={() => markAllAsRead()}
                                        className={cn(
                                            "text-xs transition-colors",
                                            isProvider ? "text-purple-400 hover:text-purple-300" : "text-emerald-400 hover:text-emerald-300"
                                        )}
                                    >
                                        Mark all as read
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                {notifications.length > 0 ? (
                                    <div className="divide-y divide-white/5">
                                        {notifications.slice(0, 5).map((n) => (
                                            <div
                                                key={n._id}
                                                className={cn(
                                                    "p-4 flex gap-4 hover:bg-white/5 transition-colors cursor-pointer relative group",
                                                    !n.read && "bg-white/[0.02]"
                                                )}
                                                onClick={() => handleNotificationClick(n)}
                                            >
                                                {!n.read && (
                                                    <div className={cn(
                                                        "absolute left-0 top-0 bottom-0 w-1",
                                                        isProvider ? "bg-purple-500" : "bg-emerald-500"
                                                    )} />
                                                )}
                                                <div className="flex-shrink-0 mt-1">
                                                    {getIcon(n.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={cn(
                                                            "text-sm font-medium text-white truncate",
                                                            !n.read ? "font-semibold" : "opacity-80"
                                                        )}>
                                                            {n.title}
                                                        </p>
                                                        <span className="text-[10px] text-gray-500 whitespace-nowrap mt-0.5">
                                                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    <p
                                                        className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed break-words"
                                                        title={n.message}
                                                    >
                                                        {n.message}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        deleteNotification(n._id)
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-all text-gray-500 hover:text-red-400 self-center"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-12 text-center">
                                        <Bell className="w-12 h-12 text-gray-700 mx-auto mb-3 opacity-20" />
                                        <p className="text-gray-500 text-sm">No notifications yet</p>
                                    </div>
                                )}
                            </div>

                            {notifications.length > 0 && (
                                <div className="p-3 border-t border-white/10 text-center">
                                    <button
                                        onClick={() => {
                                            navigate('/notifications')
                                            setIsOpen(false)
                                        }}
                                        className="text-xs text-gray-400 hover:text-white transition-colors"
                                    >
                                        View all notifications
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
