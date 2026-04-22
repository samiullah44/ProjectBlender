import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
    FileText, Search, X, CheckCircle, AlertCircle, Clock,
    Loader2, RefreshCw, ArrowRight, Shield, Film, Trash2,
    Layers, HardDrive, ChevronRight, User as UserIcon
} from 'lucide-react'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
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
        try { await listJobs({ limit: 100, adminView: true }) } catch { toast.error('Failed to load jobs') }
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
        if (await approveJob(jobId)) await refreshJobs(true)
    }
    const handleCancel = async (e: React.MouseEvent, jobId: string) => {
        e.stopPropagation()
        if (window.confirm('Cancel this job?')) if (await cancelJob(jobId)) await refreshJobs(true)
    }

    const filters = ['all', 'needs_approval', 'pending', 'processing', 'completed', 'failed', 'cancelled']

    const headerActions = (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadJobs} disabled={refreshing} className="border-white/10 hover:bg-white/5">
                <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </Button>
        </div>
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
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search jobs, IDs, or users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/30 transition-all font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 flex-wrap">
                        {filters.map(s => (
                            <button key={s} onClick={() => setFilter(s)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap border",
                                    filter === s
                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                                        : "bg-white/[0.02] text-gray-500 border-white/[0.05] hover:text-gray-300 hover:bg-white/[0.05]"
                                )}>
                                {s === 'all' ? 'All' : s}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === s ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-gray-500'}`}>
                                    {statusCounts[s as keyof typeof statusCounts]}
                                </span>
                            </button>
                        ))}
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
                            {filteredJobs.map((job, idx) => (
                                <motion.div 
                                    key={job.jobId} 
                                    initial={{ opacity: 0 }} 
                                    animate={{ opacity: 1 }} 
                                    transition={{ delay: idx * 0.02 }}
                                    onClick={() => navigate(`/admin/jobs/${job.jobId}`)}
                                    className="p-4 lg:p-5 hover:bg-white/[0.01] transition-all group border-b border-white/[0.04] last:border-0 cursor-pointer"
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            <div className={cn(
                                                "w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105",
                                                job.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                                job.status === 'failed' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                                job.status === 'processing' ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-500" :
                                                "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                            )}>
                                                <Layers className="w-5 h-5 lg:w-6 lg:h-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-white text-sm lg:text-base truncate">{job.blendFileName || 'Untitled Render'}</h3>
                                                    <Badge className={cn("text-[10px] uppercase px-1.5 py-0", STATUS_COLORS[job.status] || 'bg-gray-500/20')}>
                                                        {job.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 font-medium">
                                                    <span className="flex items-center gap-1.5 min-w-0 max-w-[150px] lg:max-w-none">
                                                        <UserIcon className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate">{(job as any).userName || job.userId?.slice(0, 10)}</span>
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <Film className="w-3.5 h-3.5 shrink-0" />
                                                        {job.frames?.rendered?.length || 0} / {job.frames?.total || 0}
                                                    </span>
                                                    <span className="hidden sm:inline text-white/20">•</span>
                                                    <span className="hidden sm:inline italic opacity-60">ID: {job.jobId}</span>
                                                </div>
                                                {job.status === 'processing' && (
                                                    <Progress value={job.progress || 0} className="h-1 mt-2 w-full lg:w-48 bg-white/5" />
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between lg:justify-end gap-6 pl-14 lg:pl-0 border-t lg:border-t-0 border-white/5 pt-3 lg:pt-0">
                                            <div className="text-right flex lg:block items-center gap-3">
                                                <div className="text-sm lg:text-base font-bold text-white">
                                                    {(job.escrow?.lockedAmount || job.totalCreditsDistributed || 0).toFixed(2)} <span className="text-[10px] text-amber-500 font-bold uppercase">RNDR</span>
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                                    {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-white/5 border border-white/5 group/btn">
                                                <ChevronRight className="w-4 h-4 text-gray-500 group-hover/btn:text-white transition-colors" />
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
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
