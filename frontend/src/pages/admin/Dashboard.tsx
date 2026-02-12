// pages/admin/Dashboard.tsx
import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
    BarChart3,
    Users,
    Cpu,
    DollarSign,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle,
    Loader2,
    RefreshCw,
    ArrowRight,
    Activity,
    Shield,
    Layers,
    Timer,
    Rocket
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { useNavigate } from 'react-router-dom'
import jobStore, { type Job } from '@/stores/jobStore'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'
import { websocketService } from '@/services/websocketService'

const AdminDashboard: React.FC = () => {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const {
        jobs,
        isLoading,
        getDashboardStats,
        refreshJobs,
        approveJob
    } = jobStore()

    const [applicationsCount, setApplicationsCount] = useState(0)
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        fetchData()

        // Subscribe to live updates
        const unsubscribe = websocketService.subscribeToSystem((data) => {
            console.log('📢 Admin Dashboard received live update:', data)
            if (data.type === 'application_new' || data.type === 'application_status_change' || data.type === 'system_stats') {
                fetchData()
            }
        })

        return () => {
            unsubscribe()
        }
    }, [])

    const fetchData = async () => {
        try {
            setRefreshing(true)
            await Promise.all([
                getDashboardStats(),
                refreshJobs(),
                import('@/services/authService').then(async ({ authService }) => {
                    const res = await authService.getApplications()
                    if (res.success && res.applications) setApplicationsCount(res.applications.length)
                })
            ])
        } catch (error) {
            console.error('Error fetching admin dashboard data:', error)
            toast.error('Failed to load admin dashboard')
        } finally {
            setRefreshing(false)
        }
    }

    // Computed stats
    const stats = useMemo(() => {
        const pending = jobs.filter(j => j.status === 'pending')
        const processing = jobs.filter(j => j.status === 'processing')
        const completed = jobs.filter(j => j.status === 'completed')
        const failed = jobs.filter(j => j.status === 'failed')

        return { pending, processing, completed, failed }
    }, [jobs])

    // Pending approval jobs
    const pendingApproval = useMemo(() => {
        return jobs.filter(j => (j as any).requireApproval && !(j as any).approved)
    }, [jobs])

    const handleApprove = async (jobId: string) => {
        const success = await approveJob(jobId)
        if (success) {
            await refreshJobs()
        }
    }

    const statCards = [
        {
            label: 'Total Jobs',
            value: jobs.length.toString(),
            icon: BarChart3,
            color: 'text-blue-400',
            bg: 'from-blue-500/20 to-cyan-500/20',
            description: 'All jobs in system'
        },
        {
            label: 'Active Jobs',
            value: (stats.pending.length + stats.processing.length).toString(),
            icon: Rocket,
            color: 'text-emerald-400',
            bg: 'from-emerald-500/20 to-green-500/20',
            description: 'Pending + Processing'
        },
        {
            label: 'Completed',
            value: stats.completed.length.toString(),
            icon: CheckCircle,
            color: 'text-purple-400',
            bg: 'from-purple-500/20 to-pink-500/20',
            description: 'Successfully completed'
        },
        {
            label: 'Failed',
            value: stats.failed.length.toString(),
            icon: AlertCircle,
            color: 'text-red-400',
            bg: 'from-red-500/20 to-orange-500/20',
            description: 'Failed jobs'
        },
        {
            label: 'Applications',
            value: applicationsCount.toString(),
            icon: Users,
            color: 'text-amber-400',
            bg: 'from-amber-500/20 to-yellow-500/20',
            description: 'Pending review',
            action: () => navigate('/admin/applications')
        }
    ]

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white"
        >
            {/* Header */}
            <div className="border-b border-white/10">
                <div className="container mx-auto px-4 py-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-4xl font-bold mb-2">
                                <Shield className="inline w-8 h-8 text-amber-400 mr-2" />
                                Admin <span className="text-amber-400">Dashboard</span>
                            </h1>
                            <p className="text-gray-400">
                                Overview of all jobs and system activity
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={fetchData}
                                disabled={refreshing}
                                className="border-white/20 hover:bg-white/5"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button
                                onClick={() => navigate('/admin/jobs')}
                                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                            >
                                <Layers className="w-4 h-4 mr-2" />
                                Manage Jobs
                            </Button>
                            <Button
                                onClick={() => navigate('/admin/applications')}
                                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                            >
                                <Users className="w-4 h-4 mr-2" />
                                Manage Applications
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {statCards.map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            onClick={(stat as any).action}
                            className={(stat as any).action ? 'cursor-pointer' : ''}
                        >
                            <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm hover:border-white/20 hover:bg-gray-900/70 transition-all duration-300 hover:scale-[1.02] group h-full">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm text-gray-400 mb-2">{stat.label}</p>
                                            <p className="text-3xl font-bold mb-1">{stat.value}</p>
                                            <p className="text-xs text-gray-400">{stat.description}</p>
                                        </div>
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.bg} group-hover:scale-110 transition-transform duration-300`}>
                                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Pending Approval */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-amber-400" />
                                    Pending Approval ({pendingApproval.length})
                                </CardTitle>
                                <CardDescription>Jobs waiting for admin approval</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {pendingApproval.length > 0 ? (
                                    <div className="space-y-3">
                                        {pendingApproval.slice(0, 5).map((job) => (
                                            <div
                                                key={job.jobId}
                                                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all duration-300"
                                            >
                                                <div className="flex-1 min-w-0 mr-3">
                                                    <div className="font-medium truncate">{job.blendFileName}</div>
                                                    <div className="text-sm text-gray-400">
                                                        {job.type} • {job.frames?.total || 0} frames • User: {job.userId?.slice(0, 8)}...
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleApprove(job.jobId)}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                                                    >
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => navigate(`/admin/jobs/${job.jobId}`)}
                                                        className="border-white/20 text-xs"
                                                    >
                                                        View
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-emerald-400" />
                                        <p>No jobs pending approval</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Recent Jobs */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-blue-400" />
                                    Recent Jobs
                                </CardTitle>
                                <CardDescription>Latest jobs across all users</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {jobs.length > 0 ? (
                                    <div className="space-y-3">
                                        {jobs.slice(0, 5).map((job) => (
                                            <div
                                                key={job.jobId}
                                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-all duration-300 group"
                                                onClick={() => navigate(`/admin/jobs/${job.jobId}`)}
                                            >
                                                <div className={`p-2 rounded-full ${job.status === 'completed' ? 'bg-emerald-500/20' :
                                                    job.status === 'processing' ? 'bg-blue-500/20' :
                                                        job.status === 'failed' ? 'bg-red-500/20' :
                                                            'bg-amber-500/20'
                                                    }`}>
                                                    {job.status === 'completed' ? (
                                                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                                                    ) : job.status === 'processing' ? (
                                                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                                    ) : job.status === 'failed' ? (
                                                        <AlertCircle className="w-4 h-4 text-red-400" />
                                                    ) : (
                                                        <Clock className="w-4 h-4 text-amber-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate text-sm">{job.blendFileName}</div>
                                                    <div className="text-xs text-gray-400">
                                                        <Badge className={`mr-2 text-xs px-1.5 py-0 ${job.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                                            job.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                                                                job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                                                    'bg-amber-500/20 text-amber-400'
                                                            }`}>
                                                            {job.status}
                                                        </Badge>
                                                        {job.type} • {new Date(job.createdAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        ))}
                                        <Button
                                            variant="ghost"
                                            className="w-full border-dashed border-white/20 hover:bg-white/5 mt-2"
                                            onClick={() => navigate('/admin/jobs')}
                                        >
                                            View All Jobs
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>No jobs found</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    )
}

export default AdminDashboard
