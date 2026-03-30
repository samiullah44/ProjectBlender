// pages/admin/Jobs.tsx
import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
    FileText,
    Search,
    X,
    CheckCircle,
    AlertCircle,
    Clock,
    Loader2,
    RefreshCw,
    ArrowRight,
    Shield,
    Filter,
    Layers,
    Film,
    Users,
    Trash2,
    ArrowLeft
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Input } from '@/components/ui/Input'
import { useNavigate } from 'react-router-dom'
import jobStore, { type Job } from '@/stores/jobStore'
import { toast } from 'react-hot-toast'

const AdminJobs: React.FC = () => {
    const navigate = useNavigate()
    const {
        jobs,
        isLoading,
        listJobs,
        approveJob,
        cancelJob,
        refreshJobs
    } = jobStore()

    const [filter, setFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        loadJobs()
    }, [])

    const loadJobs = async () => {
        setRefreshing(true)
        try {
            await listJobs({ limit: 100 })
        } catch (error) {
            toast.error('Failed to load jobs')
        } finally {
            setRefreshing(false)
        }
    }

    const filteredJobs = useMemo(() => {
        let result = jobs

        if (filter !== 'all') {
            result = result.filter(job => job.status === filter)
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            result = result.filter(job =>
                job.blendFileName?.toLowerCase().includes(query) ||
                job.jobId?.toLowerCase().includes(query) ||
                job.userId?.toLowerCase().includes(query) ||
                job.type?.toLowerCase().includes(query)
            )
        }

        return result.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    }, [jobs, filter, searchQuery])

    const statusCounts = useMemo(() => ({
        all: jobs.length,
        pending: jobs.filter(j => j.status === 'pending' || j.status === 'pending_payment').length,
        processing: jobs.filter(j => j.status === 'processing').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        cancelled: jobs.filter(j => j.status === 'cancelled').length
    }), [jobs])

    const handleApprove = async (e: React.MouseEvent, jobId: string) => {
        e.stopPropagation()
        const success = await approveJob(jobId)
        if (success) await refreshJobs()
    }

    const handleCancel = async (e: React.MouseEvent, jobId: string) => {
        e.stopPropagation()
        if (window.confirm('Are you sure you want to cancel this job?')) {
            const success = await cancelJob(jobId)
            if (success) await refreshJobs()
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-emerald-500/20 text-emerald-400'
            case 'processing': return 'bg-blue-500/20 text-blue-400'
            case 'failed': return 'bg-red-500/20 text-red-400'
            case 'cancelled': return 'bg-gray-500/20 text-gray-400'
            default: return 'bg-amber-500/20 text-amber-400'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle className="w-4 h-4 text-emerald-400" />
            case 'processing': return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            case 'failed': return <AlertCircle className="w-4 h-4 text-red-400" />
            case 'cancelled': return <X className="w-4 h-4 text-gray-400" />
            default: return <Clock className="w-4 h-4 text-amber-400" />
        }
    }

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
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/admin/dashboard')}
                                className="border-white/20"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold mb-1">
                                    <Shield className="inline w-7 h-7 text-amber-400 mr-2" />
                                    All Jobs
                                </h1>
                                <p className="text-gray-400">
                                    Manage all render jobs across every user
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={loadJobs}
                                disabled={refreshing}
                                className="border-white/20 hover:bg-white/5"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2 mb-2">
                                    <FileText className="w-5 h-5 text-amber-400" />
                                    Jobs ({filteredJobs.length})
                                </CardTitle>
                                <CardDescription>
                                    Filter and manage all render jobs
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        placeholder="Search by name, ID, user..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 bg-white/5 border-white/20 w-64"
                                    />
                                </div>
                                {searchQuery && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSearchQuery('')}
                                        className="border-white/20"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Status filter tabs */}
                        <div className="flex items-center gap-2 mb-6 flex-wrap">
                            {['all', 'pending', 'processing', 'completed', 'failed', 'cancelled'].map((status) => (
                                <Button
                                    key={status}
                                    variant={filter === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilter(status)}
                                    className={`border-white/20 text-xs capitalize ${filter === status ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                                >
                                    {status === 'all' ? 'All' : status}
                                    <Badge className={`ml-1.5 text-xs ${filter === status ? 'bg-white/20' : getStatusColor(status)
                                        }`}>
                                        {statusCounts[status as keyof typeof statusCounts]}
                                    </Badge>
                                </Button>
                            ))}
                        </div>

                        {/* Jobs List */}
                        {isLoading && jobs.length === 0 ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                            </div>
                        ) : filteredJobs.length > 0 ? (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                                {filteredJobs.map((job) => {
                                    const progress = job.progress || 0
                                    const totalFrames = job.frames?.total || 0
                                    const renderedFrames = job.outputUrls?.length || job.frames?.rendered?.length || 0
                                    const needsApproval = (job as any).requireApproval && !(job as any).approved

                                    return (
                                        <div
                                            key={job.jobId}
                                            className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10 hover:border-amber-500/30 hover:bg-white/8 transition-all duration-300 cursor-pointer group"
                                            onClick={() => navigate(`/admin/jobs/${job.jobId}`)}
                                        >
                                            <div className={`p-2.5 rounded-full ${getStatusColor(job.status)} bg-opacity-20`}>
                                                {getStatusIcon(job.status)}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium truncate">{job.blendFileName}</span>
                                                    {needsApproval && (
                                                        <Badge className="bg-amber-500/20 text-amber-400 text-xs">Needs Approval</Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
                                                    <Badge className={`px-2 py-0.5 text-xs ${getStatusColor(job.status)}`}>
                                                        {job.status}
                                                    </Badge>
                                                    <span>•</span>
                                                    <span>{job.type}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Film className="w-3 h-3" />
                                                        {renderedFrames}/{totalFrames} frames
                                                    </span>
                                                    <span>•</span>
                                                    <span className="text-xs font-mono">User: {job.userId?.slice(0, 12)}...</span>
                                                </div>
                                                {job.status === 'processing' && (
                                                    <Progress value={progress} className="h-1.5 mt-2" />
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-gray-400 hidden md:block">
                                                    {new Date(job.createdAt).toLocaleDateString()}
                                                </span>

                                                {needsApproval && (
                                                    <Button
                                                        size="sm"
                                                        onClick={(e) => handleApprove(e, job.jobId)}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                                                    >
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Approve
                                                    </Button>
                                                )}

                                                {(job.status === 'pending' || job.status === 'pending_payment' || job.status === 'processing') && !((job as any).escrow?.txSignature) && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={(e) => handleCancel(e, job.jobId)}
                                                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                                                    >
                                                        <Trash2 className="w-3 h-3 mr-1" />
                                                        Cancel
                                                    </Button>
                                                )}

                                                <ArrowRight className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-16 text-gray-400">
                                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg mb-2">No jobs found</p>
                                <p className="text-sm">
                                    {searchQuery ? 'Try clearing your search or changing filters.' : 'No jobs exist in the system yet.'}
                                </p>
                                {searchQuery && (
                                    <Button
                                        variant="outline"
                                        className="mt-4 border-white/20"
                                        onClick={() => { setSearchQuery(''); setFilter('all') }}
                                    >
                                        <X className="w-4 h-4 mr-2" />
                                        Clear Filters
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </motion.div>
    )
}

export default AdminJobs
