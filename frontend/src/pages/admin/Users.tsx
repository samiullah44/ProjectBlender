// pages/admin/Users.tsx — New user management page
import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, Search, X, ShieldOff, ShieldCheck, Loader2, RefreshCw, AlertTriangle, ShieldCheck as ShieldCheckIcon, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import axiosInstance from '@/lib/axios'
import AdminLayout from '@/components/admin/AdminLayout'
import { useAuthStore } from '@/stores/authStore'
import { User as UserIcon } from 'lucide-react'

interface PlatformUser {
    _id: string
    name: string
    email: string
    roles: string[]
    primaryRole: string
    walletAddress?: string
    isRevoked?: boolean
    suspicionTag?: string
    createdAt: string
    totalSpent?: number
    totalJobsSubmitted?: number
    solanaSeed?: string
    payoutWallet?: string
}

const ROLES: Record<string, string> = {
    client: 'text-cyan-400    bg-cyan-500/10',
    node_provider: 'text-purple-400  bg-purple-500/10',
    admin: 'text-amber-400   bg-amber-500/10',
}

const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<PlatformUser[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [actionId, setActionId] = useState<string | null>(null)
    const { impersonate } = useAuthStore()

    const fetchUsers = useCallback(async (p = page, q = search) => {
        setLoading(true)
        try {
            const res = await axiosInstance.get(`/admin/users?page=${p}&limit=30&search=${encodeURIComponent(q)}`)
            if (res.data.success) {
                setUsers(res.data.users)
                setTotal(res.data.total)
            }
        } catch { toast.error('Failed to load users') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchUsers(1, search) }, [search])
    useEffect(() => { fetchUsers(page, search) }, [page])

    const handleBan = async (userId: string, currentlyBanned: boolean) => {
        setActionId(userId)
        try {
            const endpoint = currentlyBanned ? `/admin/users/${userId}/unban` : `/admin/users/${userId}/ban`
            const res = await axiosInstance.post(endpoint, { reason: 'Admin action' })
            if (res.data.success) {
                toast.success(currentlyBanned ? 'User unbanned' : 'User banned')
                fetchUsers(page, search)
            }
        } catch { toast.error('Action failed') }
        finally { setActionId(null) }
    }

    const headerActions = (
        <div className="flex items-center gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
                    className="bg-[#111118] border border-white/[0.07] text-white text-sm rounded-xl pl-9 pr-8 py-2 w-56 focus:outline-none focus:border-white/20" />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchUsers(page, search)} disabled={loading}
                className="border-white/15 hover:bg-white/5 text-gray-300">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
    )

    return (
        <AdminLayout title="Users" subtitle={`${total} total platform members`} actions={headerActions}>
            <div className="space-y-4 mt-4">
                {/* Summary strip */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Total Users', value: total },
                        { label: 'Banned', value: users.filter(u => u.isRevoked).length },
                        { label: 'Admins', value: users.filter(u => u.roles?.includes('admin')).length },
                    ].map(s => (
                        <div key={s.label} className="rounded-xl border border-white/[0.07] bg-[#111118] p-4">
                            <p className="text-xl font-bold text-white">{s.value}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-[#111118] overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 lg:gap-3 px-3 lg:px-5 py-3 border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                        <span className="col-span-6 lg:col-span-4">User</span>
                        <span className="hidden lg:block lg:col-span-2">Roles</span>
                        <span className="col-span-3 lg:col-span-2 text-center lg:text-left">Credits</span>
                        <span className="col-span-3 lg:col-span-2 text-right lg:text-left">Jobs</span>
                        <span className="hidden lg:block lg:col-span-2 text-right">Actions</span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                        </div>
                    ) : users.length > 0 ? (
                        <div className="divide-y divide-white/[0.04]">
                            {users.map((u, i) => (
                                <motion.div 
                                    key={u._id} 
                                    initial={{ opacity: 0 }} 
                                    animate={{ opacity: 1 }} 
                                    transition={{ delay: i * 0.02 }}
                                    className={cn(
                                        "grid grid-cols-12 gap-2 lg:gap-3 px-3 lg:px-5 py-4 items-center transition-colors hover:bg-white/[0.02]",
                                        u.isRevoked ? 'bg-red-500/[0.04]' : ''
                                    )}
                                >
                                    <div className="col-span-6 lg:col-span-4 flex items-center gap-3">
                                        <div className={cn(
                                            "w-8 h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center font-bold text-xs lg:text-sm",
                                            u.isRevoked 
                                                ? "bg-red-500/20 text-red-400 border border-red-500/30" 
                                                : "bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-500 border border-amber-500/30"
                                        )}>
                                            {(u.name || u.email || '?').substring(0, 1).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs lg:text-sm font-medium text-white truncate">{u.name || '—'}</span>
                                            <span className="text-[10px] text-gray-500 truncate">{u.email}</span>
                                        </div>
                                    </div>

                                    <div className="hidden lg:flex col-span-2 items-center gap-1 flex-wrap">
                                        {(u.roles || [u.primaryRole]).map(role => (
                                            <Badge key={role} variant="outline" className={cn("text-[9px] uppercase px-1 py-0 h-auto", ROLES[role] || 'border-gray-500/20 text-gray-500 bg-gray-500/5')}>
                                                {role?.replace('_', ' ')}
                                            </Badge>
                                        ))}
                                    </div>

                                    <div className="col-span-3 lg:col-span-2 text-center lg:text-left">
                                        <div className="text-xs lg:text-sm font-semibold text-white">
                                            {typeof u.totalSpent === 'number' ? u.totalSpent.toFixed(1) : '0.0'}
                                        </div>
                                        <p className="lg:hidden text-[9px] text-gray-500 uppercase">Credits</p>
                                    </div>

                                    <div className="col-span-3 lg:col-span-2 text-right lg:text-left">
                                        <div className="text-xs lg:text-sm text-gray-400 font-medium">
                                            {u.totalJobsSubmitted || 0}
                                        </div>
                                        <p className="lg:hidden text-[9px] text-gray-500 uppercase">Jobs</p>
                                    </div>

                                    <div className="col-span-12 lg:col-span-2 flex items-center justify-end gap-2 mt-2 lg:mt-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/[0.05]">
                                        <span className="hidden md:block lg:hidden text-[10px] text-gray-500 uppercase mr-auto font-mono">
                                            {u.solanaSeed?.slice(0, 4)}...{u.solanaSeed?.slice(-4)}
                                        </span>
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            {u.isRevoked && (
                                                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] px-1.5">Banned</Badge>
                                            )}
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                disabled={actionId === u._id}
                                                onClick={() => handleBan(u._id, !!u.isRevoked)}
                                                className={cn(
                                                    "h-7 px-2.5 text-[10px] font-bold border flex items-center gap-1.5",
                                                    u.isRevoked 
                                                        ? "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10" 
                                                        : "border-red-500/20 text-red-400 hover:bg-red-500/10"
                                                )}
                                            >
                                                {actionId === u._id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : u.isRevoked ? (
                                                    <><ShieldCheckIcon className="w-3 h-3" /> Restore</>
                                                ) : (
                                                    <><ShieldOff className="w-3 h-3" /> Ban</>
                                                )}
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 w-7 p-0 text-gray-500 hover:text-white bg-white/5 border border-white/10"
                                            >
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                            <Users className="w-8 h-8 mb-2 opacity-30" />
                            <p className="text-sm">No users found</p>
                        </div>
                    )}

                    {/* Pagination */}
                    {total > 30 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.05]">
                            <p className="text-xs text-gray-500">
                                Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, total)} of {total}
                            </p>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    className="h-7 text-xs border-white/15">← Prev</Button>
                                <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page * 30 >= total}
                                    className="h-7 text-xs border-white/15">Next →</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}

export default AdminUsers
