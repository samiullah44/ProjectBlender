import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Bell, 
    Search, 
    Filter, 
    Trash2, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    MoreVertical,
    Check,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Inbox
} from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

type FilterType = 'all' | 'unread' | 'read' | 'system' | 'job_update' | 'application'

export const NotificationsPage: React.FC = () => {
    const { 
        notifications, 
        isLoading, 
        fetchNotifications, 
        markAsRead, 
        markAllAsRead, 
        deleteNotification 
    } = useNotificationStore()

    const [activeFilter, setActiveFilter] = useState<FilterType>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    useEffect(() => {
        fetchNotifications(100) // Fetch a good amount for client-side filtering/pagination
    }, [fetchNotifications])

    const filteredNotifications = notifications.filter(n => {
        const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             n.message.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesFilter = 
            activeFilter === 'all' ? true :
            activeFilter === 'unread' ? !n.read :
            activeFilter === 'read' ? n.read :
            activeFilter === 'system' ? n.type === 'system' :
            activeFilter === 'job_update' ? n.type === 'job_update' :
            activeFilter === 'application' ? (n.type === 'application_approved' || n.type === 'application_rejected') :
            true
            
        return matchesSearch && matchesFilter
    })

    const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage)
    const paginatedNotifications = filteredNotifications.slice(
        (currentPage - 1) * itemsPerPage, 
        currentPage * itemsPerPage
    )

    const getIcon = (type: string) => {
        switch (type) {
            case 'application_approved':
                return <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            case 'application_rejected':
                return <XCircle className="w-6 h-6 text-red-400" />
            case 'system':
                return <AlertCircle className="w-6 h-6 text-blue-400" />
            case 'job_update':
                return <Clock className="w-6 h-6 text-purple-400" />
            default:
                return <Bell className="w-6 h-6 text-gray-400" />
        }
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-6">
            <div className="max-w-5xl mx-auto">
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Notifications</h1>
                        <p className="text-gray-400">Stay updated with your rendering activity and system alerts</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => markAllAsRead()}
                            className="bg-white/5 border-white/10 hover:bg-white/10"
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Mark all as read
                        </Button>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-6 flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input 
                            type="text"
                            placeholder="Search notifications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/20 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
                        {(['all', 'unread', 'system', 'job_update', 'application'] as const).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => {
                                    setActiveFilter(filter)
                                    setCurrentPage(1)
                                }}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                                    activeFilter === filter 
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                        : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                                )}
                            >
                                {filter.charAt(0).toUpperCase() + filter.slice(1).replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notifications List */}
                <div className="space-y-4 min-h-[400px]">
                    <AnimatePresence mode="popLayout">
                        {paginatedNotifications.length > 0 ? (
                            paginatedNotifications.map((n) => (
                                <motion.div
                                    key={n._id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={cn(
                                        "group relative bg-gray-900/40 border border-white/5 rounded-2xl p-6 transition-all hover:border-white/10 hover:bg-gray-900/60",
                                        !n.read && "border-emerald-500/20 bg-emerald-500/[0.02]"
                                    )}
                                    onClick={() => !n.read && markAsRead(n._id)}
                                >
                                    {!n.read && (
                                        <div className="absolute left-0 top-6 bottom-6 w-1 bg-emerald-500 rounded-r-full" />
                                    )}
                                    
                                    <div className="flex gap-6">
                                        <div className="flex-shrink-0">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                                {getIcon(n.type)}
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <h3 className={cn(
                                                        "text-lg font-semibold text-white",
                                                        !n.read ? "opacity-100" : "opacity-70"
                                                    )}>
                                                        {n.title}
                                                    </h3>
                                                    <span className="text-xs text-gray-500">
                                                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        deleteNotification(n._id)
                                                    }}
                                                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <p className={cn(
                                                "text-gray-300 leading-relaxed whitespace-pre-wrap",
                                                !n.read ? "font-medium" : "font-normal opacity-80"
                                            )}>
                                                {n.message}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                    <Inbox className="w-10 h-10 text-gray-600" />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">No notifications found</h3>
                                <p className="text-gray-500 max-w-xs">
                                    {searchQuery ? `No results for "${searchQuery}"` : "You're all caught up! Check back later for updates."}
                                </p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-12">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="bg-white/5 border-white/10"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Previous
                        </Button>
                        <span className="text-sm text-gray-400">
                            Page <span className="text-white font-medium">{currentPage}</span> of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="bg-white/5 border-white/10"
                        >
                            Next
                            <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default NotificationsPage
