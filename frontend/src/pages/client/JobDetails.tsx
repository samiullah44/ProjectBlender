// pages/client/JobDetails.tsx - UPDATED VERSION
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Download,
  Play,
  Pause,
  RefreshCw,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Cpu,
  Users,
  Settings,
  ExternalLink,
  Image as ImageIcon,
  Film,
  File,
  Zap,
  Layers,
  Eye,
  Grid,
  List,
  Maximize2,
  Loader2,
  BarChart3,
  Timer,
  Rocket,
  Archive
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { toast } from 'react-hot-toast'
import { websocketService } from '@/services/websocketService'
import { axiosInstance } from '@/lib/axios'
import { useQueryClient } from '@tanstack/react-query'
import { jobKeys, useJob, useCancelJob } from '@/hooks/useJobs'
import jobStore from '@/stores/jobStore'
import FrameGrid from '@/components/dashboard/FrameGrid'
import SmartImage from '@/components/ui/SmartImage'

interface FrameImage {
  frame: number
  url: string
  freshUrl?: string
  s3Key: string
  fileSize: number
  uploadedAt: string
}

const JobDetails: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('overview')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [isZipDownloading, setIsZipDownloading] = useState(false)
  const [zipBytesLoaded, setZipBytesLoaded] = useState(0)
  const [zipBytesTotal, setZipBytesTotal] = useState<number | null>(null)
  const [isRerenderModalOpen, setIsRerenderModalOpen] = useState(false)
  const [selectedRerenderFrames, setSelectedRerenderFrames] = useState<number[]>([])

  // Use TanStack Query as the single source of truth
  const {
    data: job,
    isLoading,
    error,
    refetch
  } = useJob(jobId)

  const cancelJobMutation = useCancelJob()

  // Memoized version of frames for the gallery and distribution grid
  const cachedFrames = useMemo(() => {
    if (!job?.outputUrls) return []
    return [...job.outputUrls]
      .filter(f => f && f.frame !== undefined && f.url)
      .sort((a, b) => a.frame - b.frame)
  }, [job?.outputUrls])

  // Mapping of frame number to URL for hover previews
  const frameImageMap = useMemo(() => {
    const map: Record<number, string> = {};
    cachedFrames.forEach((f: any) => {
      if (f.frame !== undefined && (f.freshUrl || f.url)) {
        map[f.frame] = f.freshUrl || f.url;
      }
    });
    return map;
  }, [cachedFrames])

  // Force refresh function that bypasses TanStack Query stale time
  const forceRefresh = useCallback(() => {
    if (jobId) {
      console.log('🔄 Force refreshing job data:', jobId)
      refetch()
    }
  }, [jobId, refetch])

  // Helper function to merge frames without duplicates and filter invalid frames
  const mergeFrames = (existingFrames: FrameImage[], newFrames: FrameImage[]): FrameImage[] => {
    const frameMap = new Map<number, FrameImage>()

    // Add existing
    existingFrames.forEach(frame => {
      if (frame && frame.frame !== undefined) frameMap.set(frame.frame, frame)
    })

    // Merge new (preserve existing fields like freshUrl when new payload is partial)
    newFrames.forEach(frame => {
      if (frame && frame.frame !== undefined) {
        const existing = frameMap.get(frame.frame)
        frameMap.set(frame.frame, existing ? { ...existing, ...frame } : frame)
      }
    })

    return Array.from(frameMap.values()).sort((a, b) => a.frame - b.frame)
  }

  // Subscribe to WebSocket updates and update Query cache directly
  useEffect(() => {
    if (!jobId) return

    const unsubscribe = websocketService.subscribeToJob(jobId, (updatedFields) => {
      console.log('📡 WebSocket update received:', updatedFields)

      // Update the TanStack Query cache directly
      queryClient.setQueryData(jobKeys.detail(jobId), (oldData: any) => {
        if (!oldData) return updatedFields

        // Intelligently merge updates
        const newData = { ...oldData, ...updatedFields }

        // Handle nested merges like frames and outputUrls
        if (updatedFields.frames) {
          newData.frames = { ...oldData.frames, ...updatedFields.frames }
        }

        if (updatedFields.outputUrls && updatedFields.outputUrls.length > 0) {
          newData.outputUrls = mergeFrames(oldData.outputUrls || [], updatedFields.outputUrls)
        }

        return newData
      })

      // Update global job store too
      jobStore.getState().updateJobProgress(jobId, updatedFields)
    })

    return () => unsubscribe()
  }, [jobId, queryClient])

  // Toast on completion
  useEffect(() => {
    if (job?.status === 'completed') {
      toast.success('Job completed successfully!');
    }
  }, [job?.status]);

  // Auto-refresh interval
  useEffect(() => {
    if (!jobId || !autoRefresh || job?.status !== 'processing') return

    const interval = setInterval(() => {
      refetch()
    }, 30000)

    return () => clearInterval(interval)
  }, [jobId, autoRefresh, job?.status, refetch])

  const handleCancelJob = async () => {
    if (!jobId) return

    if (window.confirm('Are you sure you want to cancel this job?')) {
      try {
        await cancelJobMutation.mutateAsync({ jobId, cleanupS3: false })
        toast.success('Job cancelled successfully')
        navigate('/client/dashboard')
      } catch (error) {
        toast.error('Failed to cancel job')
      }
    }
  }

  const handleDownloadFrame = useCallback(async (frame: FrameImage) => {
    try {
      const imageUrl = frame.freshUrl || frame.url
      if (!imageUrl) {
        toast.error('No download URL available')
        return
      }

      // Create a temporary link to trigger download
      const response = await fetch(imageUrl, {
        mode: 'cors',
        credentials: 'omit'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch image')
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)

      const getExtension = (key: string) => {
        if (!key) return 'png';
        const parts = key.split('.');
        return parts.length > 1 ? parts.pop()?.toLowerCase() : 'png';
      };

      const extension = getExtension(frame.s3Key);
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `frame_${String(frame.frame).padStart(3, '0')}.${extension}`
      link.style.display = 'none'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl)

      toast.success(`Frame ${frame.frame} downloaded`)
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download frame')
    }
  }, [])

  const handleDownloadAll = useCallback(async () => {
    // Always refetch just before download to get fresh pre-signed URLs
    const latest = await refetch()
    const latestJob = latest.data as any
    const frames: FrameImage[] = (latestJob?.outputUrls || cachedFrames || []) as FrameImage[]

    if (!frames?.length) {
      toast.error('No frames to download')
      return
    }

    const toastId = toast.loading(`Downloading ${cachedFrames.length} frames...`)

    try {
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i]
        const imageUrl = frame.freshUrl || frame.url

        if (imageUrl) {
          try {
            const response = await fetch(imageUrl, {
              mode: 'cors',
              credentials: 'omit'
            })

            if (response.ok) {
              const blob = await response.blob()
              const blobUrl = window.URL.createObjectURL(blob)

              const getExtension = (key: string) => {
                if (!key) return 'png';
                const parts = key.split('.');
                return parts.length > 1 ? parts.pop()?.toLowerCase() : 'png';
              };

              const extension = getExtension(frame.s3Key);
              const link = document.createElement('a')
              link.href = blobUrl
              link.download = `frame_${String(frame.frame).padStart(3, '0')}.${extension}`
              link.style.display = 'none'
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)

              window.URL.revokeObjectURL(blobUrl)

              // Small delay between downloads
              await new Promise(resolve => setTimeout(resolve, 200))
            }
          } catch (error) {
            console.error(`Failed to download frame ${frame.frame}:`, error)
          }
        }
      }

      toast.dismiss(toastId)
      toast.success(`Downloaded ${frames.length} frames`)
    } catch (error) {
      console.error('Bulk download error:', error)
      toast.dismiss(toastId)
      toast.error('Failed to download frames')
    }
  }, [cachedFrames, refetch])

  const handleDownloadZip = useCallback(async () => {
    if (!jobId) {
      toast.error('Missing job ID')
      return
    }

    const toastId = toast.loading('Preparing ZIP to Download...')
    setIsZipDownloading(true)
    setZipBytesLoaded(0)
    setZipBytesTotal(null)

    try {
      const response = await axiosInstance.get(`/jobs/${jobId}/frames/zip`, {
        responseType: 'blob',
        // ZIP streaming for many frames can take a long time
        timeout: 0,
        onDownloadProgress: (progressEvent: any) => {
          const loaded = typeof progressEvent?.loaded === 'number' ? progressEvent.loaded : 0
          const total = typeof progressEvent?.total === 'number' && progressEvent.total > 0 ? progressEvent.total : null
          setZipBytesLoaded(loaded)
          setZipBytesTotal(total)
        }
      })

      const blob = new Blob([response.data], { type: 'application/zip' })
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `job_${jobId}_frames.zip`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)

      toast.dismiss(toastId)
      toast.success('ZIP download started')
    } catch (error: any) {
      console.error('ZIP download error:', error)
      toast.dismiss(toastId)
      const message =
        error?.response?.data?.error ||
        (error instanceof Error ? error.message : 'Failed to download ZIP')
      toast.error(message)
    } finally {
      setIsZipDownloading(false)
    }
  }, [jobId])

  const userRerenderCount = (job as any)?.userRerenderCount ?? 0
  const userRerenderMax = (job as any)?.userRerenderMax ?? 2
  const canRerender = job?.status === 'completed' && userRerenderCount < userRerenderMax
  const isFinalized = !!(job as any)?.approved || (job?.status === 'completed' && !canRerender)

  const toggleFrameSelection = useCallback((frameNumber: number) => {
    setSelectedRerenderFrames(prev => (
      prev.includes(frameNumber)
        ? prev.filter(f => f !== frameNumber)
        : [...prev, frameNumber]
    ))
  }, [])

  const handleSubmitRerender = useCallback(async () => {
    if (!jobId) {
      toast.error('Missing job ID')
      return
    }
    if (!selectedRerenderFrames.length) {
      toast.error('Select at least one frame to re-render')
      return
    }

    const toastId = toast.loading('Queuing selected frames for re-render...')
    try {
      await axiosInstance.post(`/jobs/${jobId}/rerender`, {
        frames: selectedRerenderFrames
      })
      toast.dismiss(toastId)
      toast.success('Frames queued for re-render')
      setIsRerenderModalOpen(false)
      setSelectedRerenderFrames([])
      await refetch()
    } catch (error: any) {
      console.error('Re-render error:', error)
      toast.dismiss(toastId)
      const message =
        error?.response?.data?.error ||
        (error instanceof Error ? error.message : 'Failed to queue re-render')
      toast.error(message)
    }
  }, [jobId, selectedRerenderFrames, refetch])

  const handleApproveJob = useCallback(async () => {
    if (!jobId) {
      toast.error('Missing job ID')
      return
    }

    const toastId = toast.loading('Finalizing job...')
    try {
      const response = await axiosInstance.post(`/jobs/${jobId}/approve`)
      toast.dismiss(toastId)
      if (response.data?.success) {
        toast.success('Job approved and finalized. Thank you for trusting the render.')
        await refetch()
      } else {
        toast.error(response.data?.error || 'Failed to approve job')
      }
    } catch (error: any) {
      toast.dismiss(toastId)
      const message =
        error?.response?.data?.error ||
        (error instanceof Error ? error.message : 'Failed to approve job')
      toast.error(message)
    }
  }, [jobId, refetch])

  const formatFileSize = useCallback((bytes: number) => {
    if (!bytes || bytes === 0 || isNaN(bytes)) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }, [])

  const formatTime = useCallback((dateString: string) => {
    try {
      if (!dateString || dateString === 'Invalid date') return ''
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return ''
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return ''
    }
  }, [])

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500'
      case 'processing': return 'bg-blue-500'
      case 'pending': return 'bg-amber-500'
      case 'failed': return 'bg-red-500'
      case 'cancelled': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }, [])

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'completed': return CheckCircle
      case 'processing': return RefreshCw
      case 'pending': return Clock
      case 'failed': return AlertCircle
      case 'cancelled': return X
      default: return Clock
    }
  }, [])

  // Calculate derived data from job
  const frameStats = useMemo(() => {
    if (!job) return {
      totalFrames: 0,
      renderedFrames: 0,
      failedFrames: 0,
      assignedFrames: 0,
      pendingFrames: 0
    }

    const totalFrames = job.frames?.total || 0
    // Only count valid rendered frames
    const validRenderedFrames = cachedFrames.filter(frame =>
      frame && frame.frame > 0 && frame.url
    ).length
    const renderedFrames = validRenderedFrames || job.frames?.rendered?.length || 0
    const failedFrames = job.frames?.failed?.length || 0
    const assignedFrames = job.frames?.assigned?.length || 0
    const pendingFrames = Math.max(0, totalFrames - renderedFrames - failedFrames)

    return {
      totalFrames,
      renderedFrames,
      failedFrames,
      assignedFrames,
      pendingFrames
    }
  }, [job, cachedFrames])

  const progress = useMemo(() => {
    if (!job) return 0

    // Use WebSocket progress if available, otherwise calculate from frames
    if (job.progress !== undefined && job.status === 'processing') {
      return Math.min(Math.max(job.progress, 0), 100)
    }

    if (frameStats.totalFrames === 0) return 0
    const calculatedProgress = Math.round((frameStats.renderedFrames / frameStats.totalFrames) * 100)
    return Math.min(Math.max(calculatedProgress, 0), 100)
  }, [job, frameStats])

  const activeNodes = useMemo(() => {
    if (!job?.assignedNodes) return 0
    return Object.keys(job.assignedNodes).length
  }, [job])

  const totalRenderSize = useMemo(() => {
    if (!cachedFrames.length) return 0
    return cachedFrames.reduce((sum: number, frame: FrameImage) => sum + (frame.fileSize || 0), 0)
  }, [cachedFrames])

  const recentActivity = useMemo(() => {
    if (!cachedFrames.length) return []

    return cachedFrames
      .filter(frame => frame.frame > 0 && frame.uploadedAt && frame.fileSize > 0) // Filter out invalid frames
      .slice(-10)
      .reverse()
      .map((frame: FrameImage) => ({
        frame: frame.frame || 0,
        url: frame.freshUrl || frame.url,
        uploadedAt: frame.uploadedAt,
        fileSize: frame.fileSize || 0
      }))
  }, [cachedFrames])

  // Get frames sorted in ascending order - only valid frames
  const sortedFrames = useMemo(() => {
    return cachedFrames.filter(frame =>
      frame && frame.frame > 0 && frame.url
    ).sort((a, b) => a.frame - b.frame)
  }, [cachedFrames])

  const StatusIcon = job ? getStatusIcon(job.status) : Clock

  if (isLoading && !job) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading job details...</p>
        </div>
      </div>
    )
  }

  if (error && !job) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-medium mb-2">Job Not Found</h2>
          <p className="text-gray-400 mb-6">The job you're looking for doesn't exist or failed to load</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/client/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading job details...</p>
        </div>
      </div>
    )
  }

  const {
    jobId: id = '',
    name,
    blendFileName = 'Job',
    type = 'animation',
    status = 'pending',
    settings = {} as any,
    assignedNodes = {},
    createdAt,
    updatedAt,
    startedAt,
    completedAt,
    blendFileUrl,
    blendFileKey
  } = job

  const displayName = name || blendFileName || 'Unnamed Job'
  const startTime = startedAt || createdAt

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white"
    >
      {/* Fullscreen Image Viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={() => setFullscreenImage(null)}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              onClick={() => setFullscreenImage(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={fullscreenImage}
              alt="Fullscreen preview"
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="border-b border-white/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/client/dashboard')}
                className="hover:bg-white/5"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold truncate max-w-2xl">{displayName}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <Badge className={`${getStatusColor(status || 'pending')}`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {(status || 'pending').toUpperCase()}
                  </Badge>
                  {isFinalized && (
                    <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-500/40 text-[11px] font-semibold">
                      Finalized
                    </Badge>
                  )}
                  <span className="text-sm text-gray-400">Job ID: {id ? id.substring(0, 8) : '...'}</span>
                  <span className="text-sm text-gray-400">
                    Created: {createdAt ? new Date(createdAt).toLocaleDateString() : '...'}
                  </span>
                  {status === 'processing' && (
                    <span className="text-xs text-blue-400">
                      Updated: {formatTime(updatedAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                {status === 'processing' && (
                  <Button
                    variant="outline"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className="border-white/20 hover:bg-white/5"
                  >
                    {autoRefresh ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Updates
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Resume Updates
                      </>
                    )}
                  </Button>
                )}

                {status === 'processing' && (
                  <Button
                    variant="outline"
                    onClick={handleCancelJob}
                    disabled={cancelJobMutation.isPending}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                  >
                    {cancelJobMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Cancel Job'
                    )}
                  </Button>
                )}

                {status === 'completed' && !isFinalized && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={!!(job as any)?.approved}
                      onClick={handleApproveJob}
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {(job as any)?.approved ? 'Approved' : 'Approve'}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!canRerender}
                      onClick={() => setIsRerenderModalOpen(true)}
                      className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/70"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {canRerender ? 'Re-render Frames' : 'Re-render Limit Reached'}
                    </Button>
                    <span className="text-[11px] text-gray-500">
                      Attempts used: {userRerenderCount}/{userRerenderMax}
                    </span>
                  </div>
                )}

                {status === 'completed' && cachedFrames.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={handleDownloadZip}
                        disabled={isZipDownloading}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        {isZipDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Preparing ZIP...
                          </>
                        ) : (
                          <>
                            <Archive className="w-4 h-4 mr-2" />
                            Download ZIP ({cachedFrames.length})
                          </>
                        )}
                      </Button>

                      {isZipDownloading && (
                        <div className="w-[260px]">
                          <Progress value={zipBytesTotal ? Math.min(100, (zipBytesLoaded / zipBytesTotal) * 100) : 35} />
                          <div className="mt-1 text-[10px] text-gray-400 tabular-nums flex justify-between">
                            <span>
                              Downloaded {(zipBytesLoaded / (1024 * 1024)).toFixed(1)} MB
                            </span>
                            <span>
                              {zipBytesTotal
                                ? `${Math.round((zipBytesLoaded / zipBytesTotal) * 100)}%`
                                : 'Streaming...'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleDownloadAll}
                      className="border-white/20 hover:bg-white/5"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Individual Frames
                    </Button>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={forceRefresh}
                  disabled={isLoading}
                  className="border-white/20 hover:bg-white/5"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Progress Banner */}
        {status === 'processing' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/20 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(status)} ${status === 'processing' ? 'animate-pulse' : ''}`} />
                        <span className="font-medium">Rendering in progress</span>
                        {websocketService.isConnected() && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                            Live
                          </Badge>
                        )}
                      </div>
                      <span className="font-bold text-xl">{progress}%</span>
                    </div>
                    {/* High-fidelity frame detail for Grid Visualization */}
                    {(() => {
                      const frameDetail = {
                        rendered: Array.from(new Set([
                          ...(Array.isArray(job.frameAssignments) ? job.frameAssignments.filter((a: any) => a.status === 'rendered').map((a: any) => a.frame) : []),
                          ...(Array.isArray(job.frames?.rendered) ? job.frames.rendered : [])
                        ])),
                        failed: Array.from(new Set([
                          ...(Array.isArray(job.frameAssignments) ? job.frameAssignments.filter((a: any) => a.status === 'failed').map((a: any) => a.frame) : []),
                          ...(Array.isArray(job.frames?.failed) ? job.frames.failed : [])
                        ])),
                        assigned: Array.from(new Set([
                          ...(Array.isArray(job.frameAssignments) ? job.frameAssignments.filter((a: any) => a.status === 'assigned').map((a: any) => a.frame) : []),
                          ...(Array.isArray(job.frames?.assigned) ? job.frames.assigned : []),
                          ...Object.values(job.assignedNodes || {}).flat() as number[]
                        ]))
                      };

                      // Detect re-rendering frames:
                      // The backend sets frames.selected to the re-queued frames and increments userRerenderCount.
                      // A frame is "re-rendering" when it is assigned AND was explicitly queued for re-render.
                      const rerenderedFrames = (() => {
                        const isRerender = (job.userRerenderCount ?? 0) > 0;
                        if (!isRerender) return [];
                        // Primary: frames.selected explicitly tracks what was re-queued
                        const selectedSet = new Set<number>(
                          Array.isArray(job.frames?.selected)
                            ? job.frames.selected.map((f: any) => Number(f))
                            : []
                        );
                        // Fallback: outputUrls has frames that were previously rendered
                        const prevOutputSet = new Set<number>(
                          Array.isArray(job.outputUrls)
                            ? job.outputUrls.map((o: any) => Number(o.frame))
                            : []
                        );
                        return frameDetail.assigned.filter((f: number) =>
                          selectedSet.has(Number(f)) || prevOutputSet.has(Number(f))
                        );
                      })();

                      return (
                        <div className="mt-4">
                          <FrameGrid
                            totalFrames={frameStats.totalFrames}
                            renderedFrames={frameDetail.rendered}
                            failedFrames={frameDetail.failed}
                            assignedFrames={frameDetail.assigned}
                            rerenderedFrames={rerenderedFrames}
                            rerenderedHistory={job.rerenderedHistory}
                            startFrame={job.frames?.start || 1}
                            frameImages={frameImageMap}
                          />
                        </div>
                      );
                    })()}
                    <div className="flex justify-between text-sm text-gray-400 mt-2">
                      <span>
                        {frameStats.renderedFrames} of {frameStats.totalFrames} frames rendered
                      </span>
                      <span>
                        {frameStats.pendingFrames} pending • {frameStats.failedFrames} failed
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{activeNodes}</div>
                      <div className="text-xs text-gray-400">Active Nodes</div>
                    </div>
                    <div className="h-8 w-px bg-white/20" />
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {Math.ceil(frameStats.pendingFrames * 0.5)}m
                      </div>
                      <div className="text-xs text-gray-400">Est. Time Left</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Job Info & Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid grid-cols-4 bg-gray-900/50 border border-white/10">
                <TabsTrigger value="overview">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="frames">
                  <Film className="w-4 h-4 mr-2" />
                  Frames ({frameStats.renderedFrames})
                </TabsTrigger>
                <TabsTrigger value="nodes">
                  <Users className="w-4 h-4 mr-2" />
                  Nodes ({activeNodes})
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Job Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">{frameStats.renderedFrames}</div>
                        <div className="text-xs text-gray-400">Frames Rendered</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">{frameStats.pendingFrames}</div>
                        <div className="text-xs text-gray-400">Pending Frames</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">
                          {formatFileSize(totalRenderSize)}
                        </div>
                        <div className="text-xs text-gray-400">Total Size</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">{activeNodes}</div>
                        <div className="text-xs text-gray-400">Active Nodes</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Frame Distribution */}
                {type === 'animation' && frameStats.totalFrames > 1 && (
                  <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-blue-400" />
                        Frame Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Total frames to render:</span>
                          <span className="font-medium">{frameStats.totalFrames}</span>
                        </div>

                        {/* Live Render Grid Visualization */}
                        {(() => {
                          const frameDetail = {
                            rendered: Array.from(new Set([
                              ...(Array.isArray(job.frameAssignments) ? job.frameAssignments.filter((a: any) => a.status === 'rendered').map((a: any) => a.frame) : []),
                              ...(Array.isArray(job.frames?.rendered) ? job.frames.rendered : [])
                            ])),
                            failed: Array.from(new Set([
                              ...(Array.isArray(job.frameAssignments) ? job.frameAssignments.filter((a: any) => a.status === 'failed').map((a: any) => a.frame) : []),
                              ...(Array.isArray(job.frames?.failed) ? job.frames.failed : [])
                            ])),
                            assigned: Array.from(new Set([
                              ...(Array.isArray(job.frameAssignments) ? job.frameAssignments.filter((a: any) => a.status === 'assigned').map((a: any) => a.frame) : []),
                              ...(Array.isArray(job.frames?.assigned) ? job.frames.assigned : []),
                              ...Object.values(job.assignedNodes || {}).flat() as number[]
                            ]))
                          };

                          // Detect re-rendering frames same logic
                          const rerenderedFrames2 = (() => {
                            const isRerender = (job.userRerenderCount ?? 0) > 0;
                            if (!isRerender) return [];
                            const selectedSet2 = new Set<number>(
                              Array.isArray(job.frames?.selected)
                                ? job.frames.selected.map((f: any) => Number(f))
                                : []
                            );
                            const prevOutputSet2 = new Set<number>(
                              Array.isArray(job.outputUrls)
                                ? job.outputUrls.map((o: any) => Number(o.frame))
                                : []
                            );
                            return frameDetail.assigned.filter((f: number) =>
                              selectedSet2.has(Number(f)) || prevOutputSet2.has(Number(f))
                            );
                          })();

                          return (
                            <FrameGrid
                              totalFrames={frameStats.totalFrames}
                              renderedFrames={frameDetail.rendered}
                              failedFrames={frameDetail.failed}
                              assignedFrames={frameDetail.assigned}
                              rerenderedFrames={rerenderedFrames2}
                              rerenderedHistory={job.rerenderedHistory}
                              startFrame={job.frames?.start || 1}
                              frameImages={frameImageMap}
                            />
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Activity */}
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="w-5 h-5 text-amber-400" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentActivity.length > 0 ? (
                      <div className="space-y-3">
                        {recentActivity.map((frame: any, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                            <div className="p-2 rounded-full bg-emerald-500/20">
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">
                                Frame {String(frame.frame).padStart(3, '0')} completed
                              </div>
                              <div className="text-sm text-gray-400">
                                {frame.uploadedAt && formatTime(frame.uploadedAt)}
                                {frame.uploadedAt && frame.fileSize > 0 && ' • '}
                                {frame.fileSize > 0 && formatFileSize(frame.fileSize)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <Timer className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No frames rendered yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="frames" className="space-y-6">
                {/* Frame Gallery Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Film className="w-5 h-5 text-blue-400" />
                      Rendered Frames
                    </h3>
                    <p className="text-sm text-gray-400">
                      {frameStats.renderedFrames} of {frameStats.totalFrames} frames completed
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="border-white/20"
                    >
                      <Grid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="border-white/20"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Frame Gallery */}
                {sortedFrames.length > 0 ? (
                  viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {sortedFrames.map((frame: FrameImage) => (
                        <div
                          key={frame.frame}
                          className="group relative overflow-hidden rounded-lg bg-white/5 border border-white/10 hover:border-blue-500/50 transition-all duration-300"
                        >
                          <div className="aspect-square relative overflow-hidden">
                            <SmartImage
                              src={frame.freshUrl || frame.url}
                              alt={`Frame ${String(frame.frame).padStart(3, '0')}`}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                              onError={(e) => {
                                console.error('Gallery image error:', e);
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                            <div className="absolute top-2 right-2">
                              <Badge className="bg-black/50 backdrop-blur-sm">
                                {String(frame.frame).padStart(3, '0')}
                              </Badge>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-300">
                                  {formatFileSize(frame.fileSize)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 hover:bg-white/20"
                                    onClick={() => setFullscreenImage(frame.freshUrl || frame.url || null)}
                                  >
                                    <Maximize2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-3">
                            <div className="text-sm font-medium truncate">
                              Frame {String(frame.frame).padStart(3, '0')}
                            </div>
                            <div className="text-xs text-gray-400 truncate">
                              {formatTime(frame.uploadedAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sortedFrames.map((frame: FrameImage) => (
                        <div
                          key={frame.frame}
                          className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                          <div className="w-20 h-20 rounded overflow-hidden flex-shrink-0">
                            <img
                              src={frame.freshUrl || frame.url}
                              alt={`Frame ${String(frame.frame).padStart(3, '0')}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x300/1f2937/9ca3af?text=No+Preview'
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">
                              Frame {String(frame.frame).padStart(3, '0')}
                            </div>
                            <div className="text-sm text-gray-400">
                              {frame.uploadedAt && formatTime(frame.uploadedAt)}
                              {frame.uploadedAt && frame.fileSize > 0 && ' • '}
                              {frame.fileSize > 0 && formatFileSize(frame.fileSize)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setFullscreenImage(frame.freshUrl || frame.url || null)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-medium mb-2">No Frames Rendered Yet</h3>
                    <p className="text-gray-400 mb-6">
                      Rendered frames will appear here as they are completed
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="nodes" className="space-y-6">
                {/* Node Distribution */}
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-400" />
                      Active Nodes ({activeNodes})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeNodes > 0 ? (
                      <div className="space-y-4">
                        {Object.entries(assignedNodes).map(([nodeId, nodeFrames]: [string, any], index) => (
                          <div key={index} className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-blue-400" />
                                <span className="font-medium">{nodeId}</span>
                              </div>
                              <Badge>{Array.isArray(nodeFrames) ? nodeFrames.length : 0} frames</Badge>
                            </div>
                            {Array.isArray(nodeFrames) && nodeFrames.length > 0 && (
                              <div className="text-sm text-gray-400">
                                Frames: {nodeFrames.sort((a, b) => a - b).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        No active nodes assigned to this job
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                {/* Render Settings */}
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-purple-400" />
                      Render Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm text-gray-400">Render Type</label>
                          <div className="font-medium capitalize">{type}</div>
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Engine</label>
                          <div className="font-medium">{settings.engine || 'CYCLES'}</div>
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Device</label>
                          <div className="font-medium">{settings.device || 'GPU'}</div>
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Samples</label>
                          <div className="font-medium">{settings.samples || 128}</div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm text-gray-400">Resolution</label>
                          <div className="font-medium">
                            {settings.resolutionX || 1920} × {settings.resolutionY || 1080}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Output Format</label>
                          <div className="font-medium">
                            {settings.outputFormat || 'PNG'} ({settings.colorMode || 'RGBA'} {settings.colorDepth || '8'}-bit)
                          </div>
                        </div>
                        {settings.compression !== undefined && (
                          <div>
                            <label className="text-sm text-gray-400">
                              {settings.outputFormat === 'JPEG' ? 'Quality' : 'Compression'}
                            </label>
                            <div className="font-medium">{settings.compression}%</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* File Information */}
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <File className="w-5 h-5 text-blue-400" />
                      File Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Blend File:</span>
                        {blendFileUrl ? (
                          <a
                            href={blendFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                          >
                            {blendFileName}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span>{blendFileName}</span>
                        )}
                      </div>
                      {blendFileKey && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">S3 Key:</span>
                          <code className="text-sm text-gray-400 font-mono truncate max-w-xs">
                            {blendFileKey}
                          </code>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-400">Created:</span>
                        <span>{new Date(createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Last Updated:</span>
                        <span>{new Date(updatedAt).toLocaleString()}</span>
                      </div>
                      {completedAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Completed:</span>
                          <span>{new Date(completedAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Job Summary & Actions */}
          <div className="space-y-6">
            {/* Job Summary */}
            <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Job Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <Badge className={getStatusColor(status || 'pending')}>
                      {(status || 'pending').toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Progress:</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Frames:</span>
                    <span className="font-medium">
                      {frameStats.renderedFrames}/{frameStats.totalFrames}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type:</span>
                    <span className="font-medium capitalize">{type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Size:</span>
                    <span className="font-medium">
                      {formatFileSize(totalRenderSize)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-white/20 hover:bg-white/5"
                    onClick={forceRefresh}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Status
                  </Button>

                  {status === 'completed' && cachedFrames.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        className="w-full justify-start border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50"
                        onClick={handleDownloadZip}
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        Download as ZIP
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start border-white/20 hover:bg-white/5"
                        onClick={handleDownloadAll}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Individual Frames
                      </Button>
                    </>
                  )}

                  <Button
                    variant="outline"
                    className="w-full justify-start border-white/20 hover:bg-white/5"
                    onClick={() => navigate('/client/create-job')}
                  >
                    <Film className="w-4 h-4 mr-2" />
                    Create New Job
                  </Button>

                  {status === 'processing' && (
                    <Button
                      variant="outline"
                      className="w-full justify-start border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                      onClick={handleCancelJob}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel Job
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* WebSocket Status */}
            <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${websocketService.isConnected() ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <div>
                    <div className="text-sm font-medium">
                      {websocketService.isConnected() ? 'Live Updates Active' : 'Updates Disconnected'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {websocketService.isConnected() ? 'Receiving real-time updates' : 'Reconnecting...'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Time Tracking */}
            <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Time Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Started:</span>
                    <span>{startTime ? new Date(startTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' }) : '...'}</span>
                  </div>
                  {status === 'completed' && completedAt ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Completed:</span>
                        <span>{new Date(completedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })}</span>
                      </div>
                      <div className="flex justify-between font-bold text-blue-400">
                        <span className="text-gray-400">Duration:</span>
                        <span>
                          {(() => {
                            // PRIORITIZE: backend-accumulated compute time (Session Model)
                            const accumulatedMs = (job as any)?.renderTime || 0;
                            const isFinal = ['completed', 'failed', 'cancelled'].includes(job.status || '');
                            
                            if (isFinal && accumulatedMs > 0) {
                              const mins = Math.floor(accumulatedMs / 60000);
                              const secs = Math.floor((accumulatedMs % 60000) / 1000);
                              return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                            }

                            // FALLBACK: Calculation for older jobs or those just starting
                            const startDate = startTime || createdAt;
                            const endDate = completedAt;

                            if (!startDate || !endDate) return '...';

                            const start = new Date(startDate).getTime();
                            const end = new Date(endDate).getTime();

                            if (isNaN(start) || isNaN(end)) return '...';

                            const diffMs = Math.max(0, end - start);
                            const minutes = Math.floor(diffMs / 60000);
                            const seconds = Math.floor((diffMs % 60000) / 1000);
                            return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                          })()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Elapsed:</span>
                      <span>
                        {(() => {
                          // SESSION ACCUMULATION MODEL: sum of previous sessions + current session duration
                          const accumulatedMs = (job as any)?.renderTime || 0;
                          const startDate = startTime || createdAt;
                          if (!startDate) return '0 minutes';
                          const start = new Date(startDate).getTime();
                          if (isNaN(start)) return '0 minutes';
                          
                          // If currently processing, add the time since current session started
                          const isProcessing = job.status === 'processing';
                          const currentSessionMs = isProcessing ? Math.max(0, Date.now() - start) : 0;
                          const totalMs = accumulatedMs + currentSessionMs;

                          const minutes = Math.floor(totalMs / 60000);
                          const seconds = Math.floor((totalMs % 60000) / 1000);
                          
                          if (minutes > 0) return `${minutes}m ${seconds}s`;
                          return `${seconds}s`;
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Re-render modal */}
      <AnimatePresence>
        {isRerenderModalOpen && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-3xl rounded-2xl bg-[#020617] border border-white/10 p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    Select Frames to Re-render
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Choose any completed frames you’d like to send back to the render farm.
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setIsRerenderModalOpen(false)} className="text-gray-400 hover:text-white hover:bg-white/5">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="border border-white/10 rounded-xl max-h-[360px] overflow-y-auto p-3 bg-black/40">
                {cachedFrames.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 text-sm">
                    No rendered frames available to re-render.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {cachedFrames.map((frame) => {
                      const isSelected = selectedRerenderFrames.includes(frame.frame)
                      return (
                        <button
                          key={frame.frame}
                          type="button"
                          onClick={() => toggleFrameSelection(frame.frame)}
                          className={`group relative rounded-xl border text-left overflow-hidden transition-all ${isSelected
                            ? 'border-amber-400 bg-amber-500/10'
                            : 'border-white/10 bg-black/40 hover:border-white/30'
                            }`}
                        >
                          <div className="aspect-video bg-gray-900/60 flex items-center justify-center overflow-hidden">
                            <SmartImage
                              src={frame.freshUrl || frame.url}
                              alt={`Frame ${frame.frame}`}
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                            />
                          </div>
                          <div className="px-3 py-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-white tabular-nums">
                              #{String(frame.frame).padStart(4, '0')}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-400' : 'bg-gray-500'}`} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  Selected {selectedRerenderFrames.length} frame{selectedRerenderFrames.length === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedRerenderFrames([])
                      setIsRerenderModalOpen(false)
                    }}
                    className="text-gray-400 hover:text-white hover:bg-white/5"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitRerender}
                    disabled={selectedRerenderFrames.length === 0}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  >
                    Queue Re-render
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default JobDetails