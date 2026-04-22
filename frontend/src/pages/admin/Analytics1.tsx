// pages/admin/Analytics.tsx — Comprehensive analytics hub
import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line,
    PieChart, Pie, Cell, XAxis, YAxis, Tooltip as RTooltip,
    ResponsiveContainer, Legend, CartesianGrid
} from 'recharts'
import {
    TrendingUp, DollarSign, Film, Users, Cpu, CheckCircle,
    XCircle, Clock, AlertCircle, RefreshCw, Medal, Award, Trophy
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from 'react-hot-toast'
import axiosInstance from '@/lib/axios'
import AdminLayout from '@/components/admin/AdminLayout'
import { formatGraphDate, cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────
type Period = 'daily' | 'weekly' | 'monthly' | '3months' | 'yearly' | 'all'
const PERIODS: { label: string; value: Period }[] = [
    { label: '24h',    value: 'daily' },
    { label: '7d',     value: 'weekly' },
    { label: '30d',    value: 'monthly' },
    { label: '3mo',    value: '3months' },
    { label: '1yr',    value: 'yearly' },
    { label: 'All',    value: 'all' },
]

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#8b5cf6']

// ── Reusable section card ──────────────────────────────────────────
const Section: React.FC<{
    title: string;
    sub?: string;
    children: React.ReactNode;
    className?: string;
    actions?: React.ReactNode;
}> = ({ title, sub, children, className = '', actions }) => (
    <div className={`rounded-2xl border border-white/[0.07] bg-[#111118] p-5 ${className}`}>
        <div className="flex items-start justify-between mb-4">
            <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
            </div>
            {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
        {children}
    </div>
)

// ── KPI mini card ──────────────────────────────────────────────────
const MiniStat: React.FC<{ label: string; value: string | number; color: string; icon: React.ElementType }> = ({ label, value, color, icon: Icon }) => (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.05]">
        <div className={`p-2 rounded-lg bg-opacity-20 ${color.replace('text-', 'bg-').replace('-400', '-500/15')}`}>
            <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div>
            <p className="text-lg font-bold text-white leading-none">{value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
        </div>
    </div>
)

// ── Ranked row ─────────────────────────────────────────────────────
const RankRow: React.FC<{ rank: number; name: string; sub: string; value: string; valueLabel: string }> = ({ rank, name, sub, value, valueLabel }) => {
    const rankIcon = rank === 1 ? Trophy : rank === 2 ? Award : rank === 3 ? Medal : null
    const rankColor = rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-gray-600'
    const RankIcon = rankIcon
    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
            <div className={`w-7 text-center font-bold text-sm ${rankColor}`}>
                {RankIcon ? <RankIcon className="w-4 h-4 inline" /> : `#${rank}`}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-white/90 font-medium truncate">{name}</p>
                <p className="text-[10px] text-gray-500 truncate">{sub}</p>
            </div>
            <div className="text-right">
                <p className="text-sm font-semibold text-white">{value}</p>
                <p className="text-[10px] text-gray-500">{valueLabel}</p>
            </div>
        </div>
    )
}

// ── Custom tooltip ─────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-[#18181f] border border-white/[0.08] rounded-xl p-3 text-xs shadow-2xl">
            <p className="text-gray-400 mb-2">{formatGraphDate(label)}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.color }} className="mb-0.5">
                    <span className="font-semibold">{p.name}:</span> {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
                </p>
            ))}
        </div>
    )
}

// ────────────────────────────────────────────────────────────────────
const AdminAnalytics: React.FC = () => {
    const [period, setPeriod] = useState<Period>('monthly')
    const [limit, setLimit] = useState<number>(10)
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const fetchAnalytics = useCallback(async (p: Period, l: number) => {
        setLoading(true)
        try {
            const res = await axiosInstance.get(`/admin/analytics?period=${p}&limit=${l}`)
            if (res.data.success) setData(res.data.data)
        } catch { toast.error('Failed to load analytics') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchAnalytics(period, limit) }, [period, limit])

    const kpi = data?.kpi || {}
    const jobsOverTime    = data?.jobsOverTime    || []
    const revenueOverTime = data?.revenueOverTime || []
    const topClients      = data?.topClients      || []
    const topNodes        = data?.topNodes        || []
    const jobTypeBreakdown = data?.jobTypeBreakdown || []

    // Pie data: job status breakdown
    const statusPieData = [
        { name: 'Completed', value: kpi.completedJobs || 0, color: '#10b981' },
        { name: 'Failed',    value: kpi.failedJobs    || 0, color: '#ef4444' },
        { name: 'Cancelled', value: kpi.cancelledJobs || 0, color: '#6b7280' },
        { name: 'Pending',   value: kpi.pendingJobs   || 0, color: '#f59e0b' },
        { name: 'Active',    value: kpi.processingJobs || 0, color: '#3b82f6' },
    ].filter(d => d.value > 0)

    // Node health pie
    const nodePieData = [
        { name: 'Online', value: kpi.onlineNodes || 0, color: '#10b981' },
        { name: 'Busy',   value: kpi.busyNodes   || 0, color: '#3b82f6' },
        { name: 'Offline',value: kpi.offlineNodes || 0, color: '#6b7280' },
    ].filter(d => d.value > 0)

    const headerActions = (
        <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-white/[0.05] border border-white/[0.08] rounded-lg p-0.5 gap-0.5">
                {PERIODS.map(p => (
                    <button key={p.value}
                        onClick={() => setPeriod(p.value)}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                            period === p.value ? "bg-amber-500/20 text-amber-300" : "text-gray-400 hover:text-white"
                        )}>
                        {p.label}
                    </button>
                ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchAnalytics(period, limit)} disabled={loading}
                className="border-white/10 hover:bg-white/5 text-gray-300 h-8 lg:h-9">
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </Button>
        </div>
    )

    const limitSelector = (
        <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
            {[3, 5, 10].map(l => (
                <button key={l}
                    onClick={() => setLimit(l)}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${limit === l
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/20'
                        : 'text-gray-500 hover:text-white border border-transparent'}`}>
                    Top {l}
                </button>
            ))}
        </div>
    )

    return (
        <AdminLayout title="Analytics" subtitle="Platform performance metrics" actions={headerActions}>
            <div className="space-y-4 lg:space-y-6 mt-4">
                {/* Mobile Period Selector */}
                <div className="sm:hidden flex items-center bg-[#111118]/60 border border-white/[0.08] rounded-xl p-1 gap-1 overflow-x-auto no-scrollbar">
                    {PERIODS.map(p => (
                        <button key={p.value}
                            onClick={() => setPeriod(p.value)}
                            className={cn(
                                "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                period === p.value ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm" : "text-gray-500 hover:text-gray-300"
                            )}>
                            {p.label}
                        </button>
                    ))}
                </div>

                {loading && !data ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-3" />
                            <p className="text-sm text-gray-400">Restoring session...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5 lg:space-y-6">

                        {/* ── KPI Strip ─────────────────────────────────────────── */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
                            {[
                                { label: 'Total Jobs',      value: (kpi.totalJobs || 0).toLocaleString(),     color: 'text-blue-400',    icon: Film },
                                { label: 'Completed',       value: (kpi.completedJobs || 0).toLocaleString(), color: 'text-emerald-400', icon: CheckCircle },
                                { label: 'Failed',          value: (kpi.failedJobs || 0).toLocaleString(),    color: 'text-red-400',     icon: XCircle },
                                { label: 'Success Rate',    value: `${kpi.successRate || 0}%`,                color: 'text-green-400',   icon: TrendingUp },
                                { label: 'Frames Rendered', value: (kpi.totalFramesRendered || 0).toLocaleString(), color: 'text-purple-400', icon: Cpu },
                                { label: 'Avg Render',      value: kpi.avgRenderTimeMs ? `${(kpi.avgRenderTimeMs/60000).toFixed(1)}m` : '—', color: 'text-cyan-400', icon: Clock },
                            ].map((s, i) => (
                            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                <MiniStat {...s} />
                            </motion.div>
                        ))}
                    </div>

                    {/* ── Job Volume Over Time ──────────────────────────────── */}
                    <Section title="Job Volume Over Time" sub="Total, completed, failed and cancelled jobs per day">
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={jobsOverTime} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <defs>
                                    {['#3b82f6','#10b981','#ef4444','#6b7280'].map((c, i) => (
                                        <linearGradient key={i} id={`vc${i}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={c} stopOpacity={0.25} />
                                            <stop offset="95%" stopColor={c} stopOpacity={0} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }} tickFormatter={formatGraphDate} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <RTooltip content={<CustomTooltip />} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                                <Area type="monotone" dataKey="total"     stroke="#3b82f6" strokeWidth={2} fill="url(#vc0)" dot={false} name="Total" />
                                <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} fill="url(#vc1)" dot={false} name="Completed" />
                                <Area type="monotone" dataKey="failed"    stroke="#ef4444" strokeWidth={1.5} fill="url(#vc2)" dot={false} name="Failed" />
                                <Area type="monotone" dataKey="cancelled" stroke="#6b7280" strokeWidth={1} fill="url(#vc3)" dot={false} name="Cancelled" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Section>

                    {/* ── Revenue + Pie row ─────────────────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
                        {/* Revenue over time */}
                        <Section title="Revenue Over Time" sub="Completed job earnings (credits)" className="lg:col-span-2">
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={revenueOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }} tickFormatter={formatGraphDate} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} />
                                    <RTooltip content={<CustomTooltip />} />
                                    <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#111118' }} name="Revenue (credits)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </Section>

                        {/* Job status donut */}
                        <Section title="Job Status Breakdown" sub="Status distribution">
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie data={statusPieData} cx="50%" cy="45%" innerRadius={60} outerRadius={85}
                                        dataKey="value" nameKey="name" paddingAngle={4}>
                                        {statusPieData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} stroke="transparent" />
                                        ))}
                                    </Pie>
                                    <RTooltip content={<CustomTooltip />} />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 20 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </Section>
                    </div>

                    {/* ── Rankings row ──────────────────────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Clients */}
                        <Section title="🏆 Top Clients by Spending" sub="High-value network participants" actions={limitSelector}>
                            <div>
                                {topClients.length > 0 ? topClients.slice(0, limit).map((c: any, i: number) => (
                                    <RankRow key={i} rank={i + 1}
                                        name={c.name || 'Unknown'}
                                        sub={c.email || c.userId?.slice(0, 16) + '…'}
                                        value={c.totalSpent?.toFixed?.(2) ?? '0'}
                                        valueLabel={`credits · ${c.totalJobs} jobs`}
                                    />
                                )) : (
                                    <p className="text-sm text-gray-500 text-center py-8">No data found for this period</p>
                                )}
                            </div>
                        </Section>

                        {/* Top Nodes */}
                        <Section title="⚡ Top Node Providers" sub="Highest performing hardware" actions={limitSelector}>
                            <div>
                                {topNodes.length > 0 ? topNodes.slice(0, limit).map((n: any, i: number) => (
                                    <RankRow key={i} rank={i + 1}
                                        name={n.name || n.nodeId?.slice(0, 14) + '…'}
                                        sub={n.ownerName || 'Unknown owner'}
                                        value={(n.totalFramesRendered || 0).toLocaleString()}
                                        valueLabel={`frames · ${(n.totalEarnings || 0).toFixed(2)} earned`}
                                    />
                                )) : (
                                    <p className="text-sm text-gray-500 text-center py-8">No data found for this period</p>
                                )}
                            </div>
                        </Section>
                    </div>

                    {/* ── Node health + Job types row ───────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Node health */}
                        <Section title="Network Health" sub="Live node status distribution">
                            <div className="flex items-center gap-6">
                                <ResponsiveContainer width="40%" height={150}>
                                    <PieChart>
                                        <Pie data={nodePieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>
                                            {nodePieData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} stroke="transparent" />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex-1 space-y-3">
                                    {nodePieData.map(d => (
                                        <div key={d.name} className="flex items-center justify-between">
                                            <span className="flex items-center gap-2 text-xs text-gray-400">
                                                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                                                {d.name}
                                            </span>
                                            <span className="text-sm font-semibold text-white">{d.value}</span>
                                        </div>
                                    ))}
                                    <div className="pt-2 border-t border-white/[0.06]">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-500">Total Nodes</span>
                                            <span className="text-white font-semibold">{kpi.totalNodes || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* Job type breakdown */}
                        <Section title="Job Type Breakdown" sub="Distribution by render type for selected period">
                            <ResponsiveContainer width="100%" height={150}>
                                <BarChart data={jobTypeBreakdown} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                                    <XAxis type="number" tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <YAxis type="category" dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
                                    <RTooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Jobs" radius={[0, 6, 6, 0]}>
                                        {jobTypeBreakdown.map((_: any, i: number) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </Section>
                    </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}

export default AdminAnalytics