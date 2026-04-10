// pages/admin/Jobs.tsx — Redesigned with AdminLayout
import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
    FileText, Search, X, CheckCircle, AlertCircle, Clock,
    Loader2, RefreshCw, ArrowRight, Shield, Film, Trash2
} from 'lucide-react'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Input } from '@/components/ui/Input'
import { useNavigate, useLocation } from 'react-router-dom'
import jobStore, { type Job } from '@/stores/jobStore'
import { toast } from 'react-hot-toast'
import AdminLayout from '@/components/admin/AdminLayout'

const STATUS_COLORS: Record<string, string> = {
    completed:       'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    processing:      'text-blue-400   bg-blue-500/10   border-blue-500/20',
    failed:          'text-red-400    bg-red-500/10    border-red-500/20',
    cancelled:       'text-gray-400   bg-gray-500/10   border-gray-500/20',
    pending:         'text-amber-400  bg-amber-500/10  border-amber-500/20',
    pending_payment: 'text-amber-400  bg-amber-500/10  border-amber-500/20',
}

const DOT_COLOR: Record<string, string> = {
    completed:       'bg-emerald-400',
    processing:      'bg-blue-400 animate-pulse',
    failed:          'bg-red-400',
    cancelled:       'bg-gray-500',
    pending:         'bg-amber-400',
    pending_payment: 'bg-amber-400',
}

const AdminJobs: React.FC = () => {
    const navigate  = useNavigate()
    const location  = useLocation()
    const { jobs, isLoading, listJobs, approveJob, cancelJob, refreshJobs } = jobStore()
    const [filter, setFilter]           = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [refreshing, setRefreshing]   = useState(false)

    useEffect(() => { loadJobs() }, [])

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const status = params.get('status')
        if (status) setFilter(status)
    }, [location.search])

    const loadJobs = async () => {
        setRefreshing(true)
        try { await listJobs({ limit: 100 }) } catch { toast.error('Failed to load jobs') }
        finally { setRefreshing(false) }
    }

    const statusCounts = useMemo(() => ({
        all:       jobs.length,
        pending:   jobs.filter(j => j.status === 'pending' || j.status === 'pending_payment').length,
        processing:jobs.filter(j => j.status === 'processing').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed:    jobs.filter(j => j.status === 'failed').length,
        cancelled: jobs.filter(j => j.status === 'cancelled').length,
        needs_approval: jobs.filter(j => (j as any).requireApproval && !(j as any).approved).length,
    }), [jobs])

    const chartData = [
        { name: 'Pending',   value: statusCounts.pending,    fill: '#f59e0b' },
        { name: 'Active',    value: statusCounts.processing,  fill: '#3b82f6' },
        { name: 'Done',      value: statusCounts.completed,   fill: '#10b981' },
        { name: 'Failed',    value: statusCounts.failed,      fill: '#ef4444' },
        { name: 'Cancelled', value: statusCounts.cancelled,   fill: '#6b7280' },
    ]

    const filteredJobs = useMemo(() => {
        let list = filter === 'all' ? jobs : 
                  filter === 'needs_approval' ? jobs.filter(j => (j as any).requireApproval && !(j as any).approved) :
                  jobs.filter(j => j.status === filter || (filter === 'pending' && j.status === 'pending_payment'))
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            list = list.filter(j =>
                j.blendFileName?.toLowerCase().includes(q) ||
                j.jobId?.toLowerCase().includes(q) ||
                j.userId?.toLowerCase().includes(q)
            )
        }
        return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [jobs, filter, searchQuery])

    const handleApprove = async (e: React.MouseEvent, jobId: string) => {
        e.stopPropagation()
        if (await approveJob(jobId)) await refreshJobs()
    }
    const handleCancel = async (e: React.MouseEvent, jobId: string) => {
        e.stopPropagation()
        if (window.confirm('Cancel this job?')) if (await cancelJob(jobId)) await refreshJobs()
    }

    const filters = ['all', 'needs_approval', 'pending', 'processing', 'completed', 'failed', 'cancelled']

    const headerActions = (
        <Button variant="outline" size="sm" onClick={loadJobs} disabled={refreshing} className="border-white/15 hover:bg-white/5 text-gray-300">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
        </Button>
    )

    return (
        <AdminLayout title="Jobs" subtitle={`${jobs.length} total render jobs across all users`} actions={headerActions}>
            <div className="space-y-5 mt-4">
                {/* Mini bar chart */}
                <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
                    <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Status Overview</p>
                    <ResponsiveContainer width="100%" height={80}>
                        <BarChart data={chartData} barSize={36} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                            <RTooltip
                                contentStyle={{ background: '#18181f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
                                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Filters + Search */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-xl p-1 flex-wrap">
                        {filters.map(s => (
                            <button key={s} onClick={() => setFilter(s)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filter === s
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'text-gray-400 hover:text-white'}`}>
                                {s === 'all' ? 'All' : s}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === s ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-gray-500'}`}>
                                    {statusCounts[s as keyof typeof statusCounts]}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="relative ml-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <input
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by name, ID, user…"
                            className="bg-[#111118] border border-white/[0.07] text-white text-sm rounded-xl pl-9 pr-8 py-2 w-64 focus:outline-none focus:border-white/20"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Jobs table */}
                <div className="rounded-2xl border border-white/[0.07] bg-[#111118] overflow-hidden">
                    {(isLoading && !jobs.length) ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                        </div>
                    ) : filteredJobs.length > 0 ? (
                        <div className="divide-y divide-white/[0.05]">
                            {filteredJobs.map((job, idx) => {
                                const statusCls  = STATUS_COLORS[job.status] || STATUS_COLORS.pending
                                const dotCls     = DOT_COLOR[job.status]     || DOT_COLOR.pending
                                const needsOK    = (job as any).requireApproval && !(job as any).approved
                                const canCancel  = ['pending','pending_payment','processing'].includes(job.status) && !(job as any).escrow?.txSignature
                                const totalF     = job.frames?.total || 0
                                const renderedF  = job.frames?.rendered?.length || 0
                                const progress   = job.progress || 0

                                return (
                                    <motion.div key={job.jobId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                                        onClick={() => navigate(`/admin/jobs/${job.jobId}`)}
                                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] cursor-pointer transition-all group">
                                        {/* Status dot */}
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm font-medium text-white/90 truncate">{job.blendFileName}</span>
                                                {needsOK && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold shrink-0">Needs Approval</span>}
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                                <span className="uppercase font-mono">{job.type}</span>
                                                <span>·</span>
                                                <Film className="w-3 h-3" />{renderedF}/{totalF} frames
                                                <span>·</span>
                                                <span className="font-mono">{job.userId?.slice(0, 10)}…</span>
                                            </div>
                                            {job.status === 'processing' && (
                                                <Progress value={progress} className="h-1 mt-1.5 w-48" />
                                            )}
                                        </div>

                                        {/* Status badge */}
                                        <span className={`text-[10px] px-2 py-1 rounded-full border font-semibold capitalize shrink-0 ${statusCls}`}>
                                            {job.status.replace('_', ' ')}
                                        </span>

                                        {/* Date */}
                                        <span className="text-[11px] text-gray-600 hidden md:block shrink-0">
                                            {new Date(job.createdAt).toLocaleDateString()}
                                        </span>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                            {needsOK && (
                                                <Button size="sm" onClick={(e) => handleApprove(e, job.jobId)}
                                                    className="h-7 text-[10px] px-2.5 bg-emerald-600/80 hover:bg-emerald-600">
                                                    <CheckCircle className="w-3 h-3 mr-1" />OK
                                                </Button>
                                            )}
                                            {canCancel && (
                                                <Button size="sm" variant="outline" onClick={(e) => handleCancel(e, job.jobId)}
                                                    className="h-7 text-[10px] px-2.5 border-red-500/30 text-red-400 hover:bg-red-500/10">
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                        <ArrowRight className="w-3.5 h-3.5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </motion.div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <FileText className="w-10 h-10 mb-3 opacity-30" />
                            <p className="text-sm">No jobs found</p>
                            {searchQuery && <p className="text-xs mt-1">Try clearing your search</p>}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}

export default AdminJobs
