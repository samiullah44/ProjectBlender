import React, { useState, useEffect } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { 
    Search, 
    Filter, 
    Calendar,
    ArrowRight,
    User,
    Settings,
    Shield,
    Terminal,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react'
import axiosInstance from '@/lib/axios'
import { format } from 'date-fns'

interface IAuditLog {
    _id: string;
    adminId: {
        _id: string;
        name: string;
        email: string;
    };
    action: string;
    targetId?: string;
    targetType?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
}

const actionColors: Record<string, string> = {
    USER_BAN: 'text-red-400 bg-red-400/10',
    USER_UNBAN: 'text-green-400 bg-green-400/10',
    CONFIG_UPDATE: 'text-amber-400 bg-amber-400/10',
    APPLICATION_APPROVE: 'text-blue-400 bg-blue-400/10',
    APPLICATION_REJECT: 'text-orange-400 bg-orange-400/10',
}

const AuditLogs: React.FC = () => {
    const [logs, setLogs] = useState<IAuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)

    useEffect(() => {
        fetchLogs()
    }, [page, search])

    const fetchLogs = async () => {
        try {
            setLoading(true)
            const { data } = await axiosInstance.get('/admin/audit-logs', {
                params: { page, action: search || undefined }
            })
            if (data.success) {
                setLogs(data.logs)
                setTotalPages(data.pages)
            }
        } catch (error) {
            console.error('Failed to fetch audit logs:', error)
        } finally {
            setLoading(false)
        }
    }

    const getActionIcon = (action: string) => {
        if (action.includes('USER')) return <User className="w-4 h-4" />
        if (action.includes('CONFIG')) return <Settings className="w-4 h-4" />
        if (action.includes('APPLICATION')) return <Shield className="w-4 h-4" />
        return <Terminal className="w-4 h-4" />
    }

    return (
        <AdminLayout 
            title="Audit Logs" 
            subtitle="Administrative activity and security trail"
        >
            <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input 
                            placeholder="Filter by action (e.g. USER_BAN)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-white/5 border-white/10 pl-10 h-11"
                        />
                    </div>
                </div>

                {/* Logs Table */}
                <Card className="bg-[#0d0d15] border-white/[0.06]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/[0.02] border-b border-white/[0.06]">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Admin</th>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Target</th>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-5 h-16 bg-white/[0.01]" />
                                        </tr>
                                    ))
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            No audit logs found.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log._id} className="hover:bg-white/[0.01] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-300">
                                                    {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                                                </div>
                                                <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                                                    {log.ipAddress || 'Internal'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                        <User className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-white/90">{log.adminId?.name || 'System'}</div>
                                                        <div className="text-xs text-gray-500">{log.adminId?.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${actionColors[log.action] || 'text-gray-400 bg-gray-400/10'}`}>
                                                    {getActionIcon(log.action)}
                                                    {log.action.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-xs text-gray-400">
                                                    <span className="text-gray-600">{log.targetType}:</span> {log.targetId}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-gray-500 max-w-xs truncate" title={JSON.stringify(log.details)}>
                                                    {log.details ? JSON.stringify(log.details) : '—'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Page {page} of {totalPages}
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 disabled:opacity-50 hover:bg-white/10 transition-colors"
                            >
                                Previous
                            </button>
                            <button 
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 disabled:opacity-50 hover:bg-white/10 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}

export default AuditLogs
