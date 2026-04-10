// pages/admin/Applications.tsx — Redesigned with AdminLayout
import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users, Search, CheckCircle, XCircle, Clock,
    Shield, Loader2, Calendar, Cpu, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { authService, type Application } from '@/services/authService'
import { toast } from 'react-hot-toast'
import { websocketService } from '@/services/websocketService'
import AdminLayout from '@/components/admin/AdminLayout'

type TabId = 'all' | 'pending' | 'approved' | 'rejected'

const AdminApplications: React.FC = () => {
    const [applications, setApplications] = useState<Application[]>([])
    const [loading, setLoading]           = useState(true)
    const [search, setSearch]             = useState('')
    const [tab, setTab]                   = useState<TabId>('all')
    const [expandedId, setExpandedId]     = useState<string | null>(null)
    const [rejectId, setRejectId]         = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [actionId, setActionId]         = useState<string | null>(null)

    const fetchApplications = async () => {
        try {
            setLoading(true)
            const res = await authService.getApplications()
            if (res.success && res.applications) setApplications(res.applications)
        } catch { toast.error('Failed to load applications') }
        finally { setLoading(false) }
    }

    useEffect(() => {
        fetchApplications()
        const unsub = websocketService.subscribeToSystem(d => {
            if (['application_new','application_status_change'].includes(d.type)) fetchApplications()
        })
        return () => unsub()
    }, [])

    const handleApprove = async (userId: string) => {
        setActionId(userId)
        try {
            const res = await authService.approveApplication(userId)
            if (res.success) { toast.success('Application approved!'); await fetchApplications() }
            else toast.error(res.error || 'Failed')
        } catch { toast.error('Failed') }
        finally { setActionId(null) }
    }

    const handleReject = async (userId: string) => {
        if (!rejectReason.trim()) { toast.error('Please provide a reason'); return }
        setActionId(userId)
        try {
            const res = await authService.rejectApplication(userId, rejectReason)
            if (res.success) { toast.success('Rejected'); setRejectId(null); setRejectReason(''); await fetchApplications() }
            else toast.error(res.error || 'Failed')
        } catch { toast.error('Failed') }
        finally { setActionId(null) }
    }

    const counts = {
        all:      applications.length,
        pending:  applications.filter(a => a.status === 'pending').length,
        approved: applications.filter(a => a.status === 'approved').length,
        rejected: applications.filter(a => a.status === 'rejected').length,
    }

    const filtered = applications.filter(a => {
        const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase())
        const matchTab    = tab === 'all' || a.status === tab
        return matchSearch && matchTab
    })

    const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
        { id: 'all',      label: 'All',      icon: Shield },
        { id: 'pending',  label: 'Pending',  icon: Clock },
        { id: 'approved', label: 'Approved', icon: CheckCircle },
        { id: 'rejected', label: 'Rejected', icon: XCircle },
    ]

    const headerActions = (
        <div className="flex items-center gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
                    className="bg-[#111118] border border-white/[0.07] text-white text-sm rounded-xl pl-9 pr-3 py-2 w-52 focus:outline-none focus:border-white/20" />
            </div>
            <Button variant="outline" size="sm" onClick={fetchApplications} className="border-white/15 hover:bg-white/5 text-gray-300">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
    )

    return (
        <AdminLayout title="Applications" subtitle="Review node provider applications to join the render network" actions={headerActions}>
            <div className="space-y-5 mt-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-white/[0.07] bg-[#111118] p-4 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/10"><Clock className="w-4 h-4 text-amber-400" /></div>
                        <div><p className="text-xl font-bold text-white">{counts.pending}</p><p className="text-xs text-gray-500">Pending Review</p></div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#111118] p-4 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/10"><CheckCircle className="w-4 h-4 text-emerald-400" /></div>
                        <div><p className="text-xl font-bold text-white">{counts.approved}</p><p className="text-xs text-gray-500">Approved Total</p></div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#111118] p-4 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-500/10"><Shield className="w-4 h-4 text-purple-400" /></div>
                        <div><p className="text-xl font-bold text-white">{counts.all}</p><p className="text-xs text-gray-500">Total Received</p></div>
                    </div>
                </div>

                {/* Tab filter */}
                <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-xl p-1 w-fit">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setTab(id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === id ? 'bg-purple-500/20 text-purple-300' : 'text-gray-400 hover:text-white'}`}>
                            <Icon className="w-3.5 h-3.5" />{label}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === id ? 'bg-purple-500/20' : 'bg-white/10 text-gray-500'}`}>
                                {counts[id]}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Applications */}
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="space-y-2">
                        {filtered.map((app) => (
                            <motion.div key={app._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border border-white/[0.07] bg-[#111118] overflow-hidden">
                                {/* Row */}
                                <div className="flex items-center gap-4 p-4">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                        {app.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white/90">{app.name}</p>
                                        <p className="text-xs text-gray-500">{app.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {new Date(app.nodeProviderApplicationDate).toLocaleDateString()}
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${
                                        app.status === 'approved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                                        app.status === 'rejected' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                                        'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                                        {app.status}
                                    </span>
                                    <button onClick={() => setExpandedId(expandedId === app._id ? null : app._id)}
                                        className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition-all">
                                        {expandedId === app._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Expanded details */}
                                <AnimatePresence>
                                    {expandedId === app._id && app.nodeProviderApplication && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-white/[0.06]">
                                            <div className="p-5 space-y-4">
                                                {/* Hardware grid */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                                                    {[
                                                        { label: 'OS',          value: app.nodeProviderApplication.operatingSystem },
                                                        { label: 'CPU',         value: app.nodeProviderApplication.cpuModel?.slice(0,20) },
                                                        { label: 'Cores',       value: app.nodeProviderApplication.cpuCores || '—' },
                                                        { label: 'RAM',         value: `${app.nodeProviderApplication.ramSize} GB` },
                                                        { label: 'GPU',         value: app.nodeProviderApplication.gpuModel?.slice(0,20) },
                                                        { label: 'VRAM',        value: app.nodeProviderApplication.gpuVram ? `${app.nodeProviderApplication.gpuVram} GB` : '—' },
                                                        { label: 'Storage',     value: `${app.nodeProviderApplication.storageSize} GB ${app.nodeProviderApplication.storageType?.toUpperCase() || ''}` },
                                                        { label: 'Download',    value: `${app.nodeProviderApplication.internetSpeed} Mbps` },
                                                        { label: 'Upload',      value: `${app.nodeProviderApplication.uploadSpeed || '—'} Mbps` },
                                                        { label: 'Country',     value: app.nodeProviderApplication.country },
                                                        { label: 'IP',          value: app.nodeProviderApplication.ipAddress },
                                                    ].map(({ label, value }) => (
                                                        <div key={label} className="bg-white/[0.04] p-2.5 rounded-xl">
                                                            <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">{label}</p>
                                                            <p className="text-xs text-white/80 font-medium truncate" title={String(value)}>{value || '—'}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Rejection reason */}
                                                {app.status === 'rejected' && app.rejectionReason && (
                                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                                        <p className="text-xs text-red-400 font-semibold mb-1">Rejection Reason</p>
                                                        <p className="text-xs text-gray-300">{app.rejectionReason}</p>
                                                    </div>
                                                )}

                                                {/* Notes */}
                                                {app.nodeProviderApplication.additionalNotes && (
                                                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                                                        <p className="text-xs text-gray-500 font-semibold mb-1">Additional Notes</p>
                                                        <p className="text-xs text-gray-300 italic">"{app.nodeProviderApplication.additionalNotes}"</p>
                                                    </div>
                                                )}

                                                {/* Actions — pending only */}
                                                {app.status === 'pending' && (
                                                    <div className="space-y-3 pt-1">
                                                        <div className="flex gap-3">
                                                            <Button onClick={() => handleApprove(app.userId)} disabled={actionId === app.userId}
                                                                className="flex-1 bg-emerald-600/80 hover:bg-emerald-600 h-9 text-sm">
                                                                {actionId === app.userId ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                                                Approve
                                                            </Button>
                                                            <Button variant="outline" onClick={() => setRejectId(rejectId === app.userId ? null : app.userId)}
                                                                className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 h-9 text-sm">
                                                                <XCircle className="w-4 h-4 mr-1" />Reject
                                                            </Button>
                                                        </div>
                                                        <AnimatePresence>
                                                            {rejectId === app.userId && (
                                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                                                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                                                        placeholder="Rejection reason…"
                                                                        className="w-full px-3 py-2 bg-white/[0.04] border border-red-500/20 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/40 min-h-[70px]" />
                                                                    <div className="flex gap-2 mt-2">
                                                                        <Button onClick={() => handleReject(app.userId)} disabled={!rejectReason.trim() || actionId === app.userId}
                                                                            className="bg-red-600/80 hover:bg-red-600 h-8 text-xs">
                                                                            {actionId === app.userId ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                                                            Confirm Reject
                                                                        </Button>
                                                                        <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason('') }}
                                                                            className="border-white/15 h-8 text-xs">Cancel</Button>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <Users className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm">No {tab !== 'all' ? tab : ''} applications found</p>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}

export default AdminApplications
