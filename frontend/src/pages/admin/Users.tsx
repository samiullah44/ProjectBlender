// pages/admin/Users.tsx — New user management page
import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, Search, X, ShieldOff, ShieldCheck, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
}

const ROLES: Record<string, string> = {
    client:        'text-cyan-400    bg-cyan-500/10',
    node_provider: 'text-purple-400  bg-purple-500/10',
    admin:         'text-amber-400   bg-amber-500/10',
}

const AdminUsers: React.FC = () => {
    const [users, setUsers]         = useState<PlatformUser[]>([])
    const [total, setTotal]         = useState(0)
    const [page, setPage]           = useState(1)
    const [search, setSearch]       = useState('')
    const [loading, setLoading]     = useState(true)
    const [actionId, setActionId]   = useState<string | null>(null)
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
                        { label: 'Banned',      value: users.filter(u => u.isRevoked).length },
                        { label: 'Admins',      value: users.filter(u => u.roles?.includes('admin')).length },
                    ].map(s => (
                        <div key={s.label} className="rounded-xl border border-white/[0.07] bg-[#111118] p-4">
                            <p className="text-xl font-bold text-white">{s.value}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div className="rounded-2xl border border-white/[0.07] bg-[#111118] overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                        <span className="col-span-4">User</span>
                        <span className="col-span-2">Roles</span>
                        <span className="col-span-2 hidden md:block">Wallet</span>
                        <span className="col-span-2 hidden md:block">Joined</span>
                        <span className="col-span-2 text-right">Action</span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                        </div>
                    ) : users.length > 0 ? (
                        <div className="divide-y divide-white/[0.04]">
                            {users.map((u, i) => (
                                <motion.div key={u._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                                    className={`grid grid-cols-12 gap-3 px-5 py-3 items-center transition-colors ${u.isRevoked ? 'bg-red-500/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                                    {/* Name + email */}
                                    <div className="col-span-4 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${u.isRevoked ? 'bg-red-500/20 text-red-400' : 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-300'}`}>
                                                {(u.name || u.email || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm text-white/90 font-medium truncate">{u.name || '—'}</p>
                                                <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Roles */}
                                    <div className="col-span-2 flex flex-wrap gap-1">
                                        {(u.roles || [u.primaryRole]).map(r => (
                                            <span key={r} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${ROLES[r] || 'text-gray-400 bg-white/10'}`}>
                                                {r?.replace('_', ' ')}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Wallet */}
                                    <div className="col-span-2 hidden md:block text-[10px] text-gray-500 font-mono">
                                        {u.solanaSeed || u.payoutWallet ? (
                                            <p className="truncate" title={u.solanaSeed || u.payoutWallet}>
                                                {(u.solanaSeed || u.payoutWallet)?.slice(0, 4)}…{(u.solanaSeed || u.payoutWallet)?.slice(-4)}
                                            </p>
                                        ) : '—'}
                                    </div>

                                    {/* Joined */}
                                    <div className="col-span-2 hidden md:block">
                                        <p className="text-[11px] text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</p>
                                    </div>

                                    {/* Action */}
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        {u.isRevoked && (
                                            <span className="flex items-center gap-1 text-[10px] text-red-400">
                                                <AlertTriangle className="w-3 h-3" /> Banned
                                            </span>
                                        )}
                                        {!u.roles?.includes('admin') && (
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" 
                                                    onClick={() => impersonate({ id: u._id, name: u.name, username: u.email })}
                                                    className="h-7 text-[10px] px-2.5 border-white/10 hover:bg-white/5 text-gray-400">
                                                    <UserIcon className="w-3 h-3 mr-1" /> View As
                                                </Button>
                                                <Button size="sm" variant="outline" disabled={actionId === u._id}
                                                    onClick={() => handleBan(u._id, !!u.isRevoked)}
                                                    className={`h-7 text-[10px] px-2.5 ${u.isRevoked
                                                        ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                                                        : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}`}>
                                                    {actionId === u._id
                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                        : u.isRevoked
                                                            ? <><ShieldCheck className="w-3 h-3 mr-1" />Unban</>
                                                            : <><ShieldOff className="w-3 h-3 mr-1" />Ban</>
                                                    }
                                                </Button>
                                            </div>
                                        )}
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
