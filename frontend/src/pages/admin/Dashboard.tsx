// pages/admin/Dashboard.tsx — Redesigned
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    Layers, Users, Cpu, DollarSign, TrendingUp, CheckCircle,
    AlertCircle, Loader2, RefreshCw, ArrowRight, Activity,
    Shield, Timer, Rocket, Settings, BarChart3, Film,
    ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react'
import { AreaChart, Area, Tooltip as RTooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/Progress'
import { useNavigate as useNav } from 'react-router-dom'
import jobStore from '@/stores/jobStore'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'
import { websocketService } from '@/services/websocketService'
import { WithdrawProfitModal } from '@/components/ui/WithdrawProfitModal'
import { UpdateConfigModal } from '@/components/ui/UpdateConfigModal'
import axiosInstance from '@/lib/axios'
import AdminLayout from '@/components/admin/AdminLayout'
import { formatGraphDate } from '@/lib/utils'

// ── Small stat card (Compact Version) ─────────────────────────────────────────
const StatCard: React.FC<{
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    color: string;
    gradient: string;
    onClick?: () => void;
    trend?: number;
}> = ({ label, value, sub, icon: Icon, color, gradient, onClick, trend }) => (
    <motion.div
        whileHover={{ y: -2, scale: 1.01 }}
        className={`relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118] p-4 h-full flex flex-col ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
    >
        {/* Background gradient */}
        <div className={`absolute inset-0 opacity-[0.04] bg-gradient-to-br ${gradient} pointer-events-none`} />

        <div className="flex items-start justify-between h-full min-h-[75px]">
            <div className="flex flex-col h-full justify-between">
                <div>
                    {/* Label */}
                    <p className="text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wide">
                        {label}
                    </p>

                    {/* Value */}
                    <p className="text-2xl font-semibold text-white leading-tight tracking-tight">
                        {value}
                    </p>
                </div>

                {/* Sub text */}
                <div className="mt-auto">
                    {sub ? (
                        <p className="text-[10px] text-gray-500 mt-1.5">
                            {sub}
                        </p>
                    ) : (
                        <div className="h-3" />
                    )}
                </div>
            </div>

            {/* Icon */}
            <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} bg-opacity-10 shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
            </div>
        </div>

        {/* Trend */}
        {trend !== undefined && (
            <div
                className={`mt-2 flex items-center gap-1 text-[10px] ${trend > 0
                    ? 'text-emerald-400'
                    : trend < 0
                        ? 'text-red-400'
                        : 'text-gray-500'
                    }`}
            >
                {trend > 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                ) : trend < 0 ? (
                    <ArrowDownRight className="w-3 h-3" />
                ) : (
                    <Minus className="w-3 h-3" />
                )}
                {Math.abs(trend)}% vs last period
            </div>
        )}
    </motion.div>
);

// ── Sparkline chart (mini area) ────────────────────────────────────────────────
const SparkLine: React.FC<{ data: any[]; dataKey: string; color: string }> = ({ data, dataKey, color }) => (
    <ResponsiveContainer width="100%" height={48}>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
                <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <Area
                type="monotone" dataKey={dataKey}
                stroke={color} strokeWidth={1.5}
                fill={`url(#spark-${color.replace('#', '')})`}
                dot={false}
            />
        </AreaChart>
    </ResponsiveContainer>
)

// ─────────────────────────────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { jobs, isLoading, getDashboardStats, refreshJobs, approveJob } = jobStore()

    const [platformFees, setPlatformFees] = useState<any>(null)
    const [analytics, setAnalytics] = useState<any>(null)
    const [dashboardStats, setDashboardStats] = useState<any>(null)
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
    const [refreshing, setRefreshing] = useState(false)
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)

    useEffect(() => {
        fetchData(period)
        const unsub = websocketService.subscribeToSystem((data) => {
            if (['application_new', 'application_status_change', 'system_stats'].includes(data.type)) fetchData(period)
        })
        return () => unsub()
    }, [period])

    const fetchData = async (p = period) => {
        setRefreshing(true)
        try {
            const [statsRes] = await Promise.all([
                getDashboardStats(true),
                refreshJobs(true),
            ])
            
            setDashboardStats(statsRes)

            const [feesRes, analyticsRes] = await Promise.all([
                axiosInstance.get('/admin/platform-fees'),
                axiosInstance.get(`/admin/analytics?period=${p}`),
            ])

            if (feesRes.data?.success) setPlatformFees(feesRes.data.data)
            if (analyticsRes.data?.success) setAnalytics(analyticsRes.data.data)
        } catch (error) {
            console.error('Dashboard fetch error:', error)
            toast.error('Failed to refresh data')
        } finally {
            setRefreshing(false)
        }
    }

    const stats = useMemo(() => ({
        pending: jobs.filter(j => j.status === 'pending' || j.status === 'pending_payment').length,
        processing: jobs.filter(j => j.status === 'processing').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        cancelled: jobs.filter(j => j.status === 'cancelled').length,
    }), [jobs])

    const pendingApproval = useMemo(() => jobs.filter(j => (j as any).requireApproval && !(j as any).approved), [jobs])

    const handleApprove = async (jobId: string) => {
        if (await approveJob(jobId)) await refreshJobs()
    }

    const kpi = analytics?.kpi || {}
    const sparkData = analytics?.jobsOverTime?.slice(-14) || []

    const kpiCards = [
        {
            label: 'Total Jobs',
            value: dashboardStats?.totalJobs?.toLocaleString() ?? '—',
            sub: `${dashboardStats?.processingJobs ?? 0} processing now`,
            icon: Layers, color: 'text-blue-400', gradient: 'from-blue-500 to-cyan-500',
            onClick: () => navigate('/admin/jobs'),
        },
        {
            label: 'Completed',
            value: dashboardStats?.completedJobs?.toLocaleString() ?? '—',
            sub: kpi.successRate !== undefined ? `${kpi.successRate}% success rate (7d)` : '',
            icon: CheckCircle, color: 'text-emerald-400', gradient: 'from-emerald-500 to-green-500',
        },
        {
            label: 'Failed / Cancelled',
            value: `${dashboardStats?.failedJobs ?? 0} / ${dashboardStats?.cancelledJobs ?? 0}`,
            sub: 'All time',
            icon: AlertCircle, color: 'text-red-400', gradient: 'from-red-500 to-orange-500',
        },
        {
            label: 'Platform Balance',
            value: platformFees ? `${platformFees.balance.toFixed(4)} MRNDR` : '—',
            sub: platformFees ? `Fee: ${platformFees.platformFeeBps / 100}%` : '',
            icon: DollarSign, color: 'text-amber-400', gradient: 'from-amber-500 to-yellow-500',
            onClick: () => setIsWithdrawModalOpen(true),
        },
        {
            label: 'Online Nodes',
            value: `${kpi.onlineNodes ?? '—'} / ${kpi.totalNodes ?? '—'}`,
            sub: kpi.busyNodes !== undefined ? `${kpi.busyNodes} busy` : '',
            icon: Cpu, color: 'text-purple-400', gradient: 'from-purple-500 to-pink-500',
            onClick: () => navigate('/admin/nodes'),
        },
        {
            label: 'Total Users',
            value: (kpi.totalUsers ?? '—').toLocaleString?.() ?? '—',
            sub: 'Active platform members',
            icon: Users, color: 'text-cyan-400', gradient: 'from-cyan-500 to-teal-500',
            onClick: () => navigate('/admin/users'),
        },
    ]

    const headerActions = (
        <div className="flex items-center gap-1.5 lg:gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchData()} 
                disabled={refreshing} 
                className="border-white/10 hover:bg-white/5 text-gray-400 h-8 lg:h-9"
            >
                <RefreshCw className={cn("w-3.5 h-3.5 sm:mr-1.5", refreshing && "animate-spin")} />
                <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsConfigModalOpen(true)} 
                className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10 h-8 lg:h-9"
            >
                <Settings className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Settings</span>
            </Button>
            <Button 
                size="sm" 
                onClick={() => navigate('/admin/analytics')} 
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 h-8 lg:h-9"
            >
                <BarChart3 className="w-3.5 h-3.5 lg:mr-1.5" />
                <span className="hidden lg:inline">Analytics</span>
            </Button>
        </div>
    )

    return (
        <AdminLayout title="Dashboard" subtitle="Platform overview and quick controls" actions={headerActions}>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4 mt-4">
                {kpiCards.map((card, i) => (
                    <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="h-full">
                        <StatCard {...card} />
                    </motion.div>
                ))}
            </div>

            {/* Sparkline + Pending Approvals row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
                {/* Job volume sparkline */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="lg:col-span-3 rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-semibold text-white">Job Volume — Last 7 Days</p>
                            <p className="text-xs text-gray-500 mt-0.5">Total vs completed per day</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs text-gray-400 hover:text-white" onClick={() => navigate('/admin/analytics')}>
                            Full Analytics <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                        <AreaChart data={sparkData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }} tickFormatter={formatGraphDate} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                            <RTooltip
                                contentStyle={{ background: '#18181f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }}
                                labelStyle={{ color: '#9ca3af' }}
                                labelFormatter={formatGraphDate}
                            />
                            <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="url(#gradTotal)" dot={false} name="Total" />
                            <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} fill="url(#gradDone)" dot={false} name="Completed" />
                        </AreaChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2 h-2 rounded-full bg-blue-500" />Total</span>
                        <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2 h-2 rounded-full bg-emerald-500" />Completed</span>
                    </div>
                </motion.div>

                {/* Pending approvals */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                    className="lg:col-span-2 rounded-2xl border border-white/[0.07] bg-[#111118] p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-white flex items-center gap-2">
                            <Shield className="w-4 h-4 text-amber-400" />
                            Pending Approval
                            {pendingApproval.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-semibold">{pendingApproval.length}</span>
                            )}
                        </p>
                        <Button variant="ghost" size="sm" className="text-xs text-gray-400" onClick={() => navigate('/admin/jobs?status=needs_approval')}>
                            All <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto">
                        {pendingApproval.length > 0 ? pendingApproval.slice(0, 6).map(job => (
                            <div key={job.jobId} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-amber-500/20 transition-all">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white/90 truncate">{job.blendFileName}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{(job as any).frames?.total || 0} frames • {job.userId?.slice(0, 8)}…</p>
                                </div>
                                <Button size="sm" onClick={() => handleApprove(job.jobId)} className="h-7 text-[10px] px-2.5 bg-emerald-600/80 hover:bg-emerald-600">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    OK
                                </Button>
                            </div>
                        )) : (
                            <div className="flex-1 flex items-center justify-center py-8 text-center">
                                <div>
                                    <CheckCircle className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                                    <p className="text-xs text-gray-500">All clear — no pending jobs</p>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Recent jobs feed */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="mt-6 rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-400" />
                        Recent Activity
                    </p>
                    <Button variant="ghost" size="sm" className="text-xs text-gray-400" onClick={() => navigate('/admin/jobs')}>
                        View All <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                </div>
                <div className="space-y-1">
                    {jobs.slice(0, 8).map(job => {
                        const statusMap: Record<string, string> = {
                            completed: 'text-emerald-400 bg-emerald-500/10',
                            processing: 'text-blue-400 bg-blue-500/10',
                            failed: 'text-red-400 bg-red-500/10',
                            cancelled: 'text-gray-400 bg-gray-500/10',
                            pending: 'text-amber-400 bg-amber-500/10',
                            pending_payment: 'text-amber-400 bg-amber-500/10',
                        }
                        const cls = statusMap[job.status] || statusMap.pending
                        return (
                            <div key={job.jobId}
                                onClick={() => navigate(`/admin/jobs/${job.jobId}`)}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] cursor-pointer transition-all group">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${job.status === 'completed' ? 'bg-emerald-400' : job.status === 'processing' ? 'bg-blue-400 animate-pulse' : job.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'}`} />
                                <span className="text-sm text-white/80 truncate flex-1">{job.blendFileName}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>{job.status}</span>
                                <span className="text-[10px] text-gray-600">{new Date(job.createdAt).toLocaleDateString()}</span>
                                <ArrowRight className="w-3 h-3 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )
                    })}
                </div>
            </motion.div>

            {/* Modals */}
            {platformFees && (
                <>
                    <WithdrawProfitModal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)}
                        currentBalance={platformFees.balance} collectorWallet={platformFees.collectorWallet}
                        onSuccess={fetchData} onOpenConfig={() => setIsConfigModalOpen(true)} />
                    <UpdateConfigModal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)}
                        currentConfig={{ admin: platformFees.adminWallet, feeCollector: platformFees.collectorWallet, platformFeeBps: platformFees.platformFeeBps }}
                        onSuccess={fetchData} />
                </>
            )}
        </AdminLayout>
    )
}

export default AdminDashboard
