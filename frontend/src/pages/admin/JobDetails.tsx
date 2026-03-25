// pages/admin/JobDetails.tsx
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    Shield,
    CheckCircle,
    AlertCircle,
    Clock,
    Loader2,
    RefreshCw,
    Film,
    Users,
    Cpu,
    HardDrive,
    Timer,
    DollarSign,
    Trash2,
    FileText,
    Download,
    Layers,
    Settings
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { useNavigate, useParams } from 'react-router-dom'
import jobStore, { type Job } from '@/stores/jobStore'
import { toast } from 'react-hot-toast'

const AdminJobDetails: React.FC = () => {
    const navigate = useNavigate()
    const { jobId } = useParams<{ jobId: string }>()
    const {
        currentJob,
        isLoading,
        getJob,
        approveJob,
        cancelJob,
        clearCurrentJob
    } = jobStore()

    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        if (jobId) {
            loadJob()
        }
        return () => {
            clearCurrentJob()
        }
    }, [jobId])

    const loadJob = async () => {
        if (!jobId) return
        setRefreshing(true)
        try {
            await getJob(jobId)
        } catch (error) {
            toast.error('Failed to load job')
        } finally {
            setRefreshing(false)
        }
    }

    const handleApprove = async () => {
        if (!jobId) return
        const success = await approveJob(jobId)
        if (success) await loadJob()
    }

    const handleCancel = async () => {
        if (!jobId) return
        if (window.confirm('Are you sure you want to cancel this job?')) {
            const success = await cancelJob(jobId, false)
            if (success) await loadJob()
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            case 'processing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30'
            case 'cancelled': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
            default: return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        }
    }

    if (isLoading && !currentJob) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-amber-400 mx-auto mb-4" />
                    <p className="text-gray-400">Loading job details...</p>
                </div>
            </div>
        )
    }

    if (!currentJob) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-xl font-medium mb-2">Job Not Found</p>
                    <p className="text-gray-400 mb-4">The job you're looking for doesn't exist.</p>
                    <Button onClick={() => navigate('/admin/jobs')} className="bg-amber-600 hover:bg-amber-700">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Jobs
                    </Button>
                </div>
            </div>
        )
    }

    const job = currentJob
    const progress = job.progress || 0
    const totalFrames = job.frames?.total || 0
    const renderedFrames = job.outputUrls?.length || job.frames?.rendered?.length || 0
    const failedFrames = job.frames?.failed?.length || 0
    const assignedFrames = job.frames?.assigned?.length || 0
    const activeNodes = Object.keys(job.assignedNodes || {}).length
    const needsApproval = (job as any).requireApproval && !(job as any).approved

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white"
        >
            {/* Header */}
            <div className="border-b border-white/10">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/admin/jobs')}
                                className="border-white/20"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-2">
                                    <Shield className="w-6 h-6 text-amber-400" />
                                    {job.blendFileName}
                                </h1>
                                <p className="text-sm text-gray-400 font-mono mt-1">{job.jobId}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge className={`px-3 py-1.5 text-sm ${getStatusColor(job.status || 'pending')}`}>
                                {(job.status || 'pending').toUpperCase()}
                            </Badge>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadJob}
                                disabled={refreshing}
                                className="border-white/20"
                            >
                                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            </Button>
                            {needsApproval && (
                                <Button
                                    size="sm"
                                    onClick={handleApprove}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Approve
                                </Button>
                            )}
                            {(job.status === 'pending' || job.status === 'processing') && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancel}
                                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                {/* Progress Overview */}
                {(job.status === 'processing' || job.status === 'pending') && (
                    <Card className="bg-gray-900/50 border-white/10 mb-6">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-gray-400">Overall Progress</span>
                                <span className="text-lg font-bold text-blue-400">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-3 mb-3" />
                            <div className="flex items-center justify-between text-sm text-gray-400">
                                <span>{renderedFrames} / {totalFrames} frames rendered</span>
                                {failedFrames > 0 && (
                                    <span className="text-red-400">{failedFrames} failed</span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Job Info */}
                    <Card className="bg-gray-900/50 border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <FileText className="w-5 h-5 text-blue-400" />
                                Job Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <InfoRow label="Job ID" value={job.jobId} mono />
                                <InfoRow label="User ID" value={job.userId} mono />
                                <InfoRow label="Project ID" value={job.projectId} mono />
                                <InfoRow label="Type" value={job.type} />
                                <InfoRow label="Status" value={job.status} badge badgeColor={getStatusColor(job.status)} />
                                <InfoRow label="Created" value={new Date(job.createdAt).toLocaleString()} />
                                <InfoRow label="Updated" value={new Date(job.updatedAt).toLocaleString()} />
                                {job.completedAt && (
                                    <InfoRow label="Completed" value={new Date(job.completedAt).toLocaleString()} />
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Render Settings */}
                    <Card className="bg-gray-900/50 border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Settings className="w-5 h-5 text-purple-400" />
                                Render Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <InfoRow label="Engine" value={job.settings?.engine || 'N/A'} />
                                <InfoRow label="Device" value={job.settings?.device || 'N/A'} />
                                <InfoRow label="Samples" value={String(job.settings?.samples || 'N/A')} />
                                <InfoRow label="Resolution" value={`${job.settings?.resolutionX || 0} × ${job.settings?.resolutionY || 0}`} />
                                <InfoRow label="Tile Size" value={String(job.settings?.tileSize || 'N/A')} />
                                <InfoRow label="Output Format" value={job.settings?.outputFormat || 'N/A'} />
                                <InfoRow label="Denoiser" value={job.settings?.denoiser || 'None'} />
                                <InfoRow label="Credits/Frame" value={String(job.settings?.creditsPerFrame || 'N/A')} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Frame Info */}
                    <Card className="bg-gray-900/50 border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Film className="w-5 h-5 text-emerald-400" />
                                Frame Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <InfoRow label="Frame Range" value={`${job.frames?.start || 0} – ${job.frames?.end || 0}`} />
                                <InfoRow label="Total Frames" value={String(totalFrames)} />
                                <InfoRow label="Rendered" value={String(renderedFrames)} highlight="emerald" />
                                <InfoRow label="Failed" value={String(failedFrames)} highlight={failedFrames > 0 ? 'red' : undefined} />
                                <InfoRow label="Assigned" value={String(assignedFrames)} />
                                <InfoRow label="Active Nodes" value={String(activeNodes)} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Rendered Output */}
                    <Card className="bg-gray-900/50 border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Layers className="w-5 h-5 text-amber-400" />
                                Rendered Output ({job.outputUrls?.length || 0})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {job.outputUrls && job.outputUrls.length > 0 ? (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {job.outputUrls.map((output, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/10"
                                        >
                                            <div className="flex items-center gap-2 text-sm">
                                                <Film className="w-3 h-3 text-gray-400" />
                                                <span>Frame {output.frame}</span>
                                                <span className="text-xs text-gray-500">
                                                    {output.fileSize ? `${(output.fileSize / 1024).toFixed(1)} KB` : ''}
                                                </span>
                                            </div>
                                            <a
                                                href={output.freshUrl || output.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Download className="w-3 h-3" />
                                                Download
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No rendered frames yet</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Frame Assignments */}
                {job.frameAssignments && job.frameAssignments.length > 0 && (
                    <Card className="bg-gray-900/50 border-white/10 mt-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Cpu className="w-5 h-5 text-blue-400" />
                                Frame Assignments ({job.frameAssignments.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-400 border-b border-white/10">
                                            <th className="pb-2 pr-4">Frame</th>
                                            <th className="pb-2 pr-4">Node</th>
                                            <th className="pb-2 pr-4">Status</th>
                                            <th className="pb-2 pr-4">Assigned At</th>
                                            <th className="pb-2 pr-4">Completed At</th>
                                            <th className="pb-2">Render Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {job.frameAssignments.slice(0, 20).map((assignment, index) => (
                                            <tr key={index} className="border-b border-white/5">
                                                <td className="py-2 pr-4 font-mono">#{assignment.frame}</td>
                                                <td className="py-2 pr-4 font-mono text-xs">{assignment.nodeId?.slice(0, 12)}...</td>
                                                <td className="py-2 pr-4">
                                                    <Badge className={`text-xs ${assignment.status === 'rendered' ? 'bg-emerald-500/20 text-emerald-400' :
                                                        assignment.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                                            'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                        {assignment.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 pr-4 text-gray-400 text-xs">
                                                    {new Date(assignment.assignedAt).toLocaleString()}
                                                </td>
                                                <td className="py-2 pr-4 text-gray-400 text-xs">
                                                    {assignment.completedAt ? new Date(assignment.completedAt).toLocaleString() : '—'}
                                                </td>
                                                <td className="py-2 text-gray-400 text-xs">
                                                    {assignment.renderTime ? `${assignment.renderTime}s` : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </motion.div>
    )
}

// Reusable info row component
const InfoRow: React.FC<{
    label: string
    value: string
    mono?: boolean
    badge?: boolean
    badgeColor?: string
    highlight?: 'emerald' | 'red'
}> = ({ label, value, mono, badge, badgeColor, highlight }) => (
    <div className="flex items-center justify-between py-1">
        <span className="text-sm text-gray-400">{label}</span>
        {badge ? (
            <Badge className={`text-xs ${badgeColor}`}>{value}</Badge>
        ) : (
            <span className={`text-sm font-medium ${mono ? 'font-mono text-xs' : ''
                } ${highlight === 'emerald' ? 'text-emerald-400' :
                    highlight === 'red' ? 'text-red-400' : ''
                }`}>
                {value}
            </span>
        )}
    </div>
)

export default AdminJobDetails
