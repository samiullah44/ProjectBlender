// pages/client/JobDetails.tsx - CORRECTED VERSION
import React, { useState, useEffect } from 'react'
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
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { toast } from 'react-hot-toast'
import jobStore from '@/stores/jobStore'
import { websocketService } from '@/services/websocketService'

interface FrameImage {
  frame: number
  url: string
  freshUrl: string
  s3Key: string
  fileSize: number
  uploadedAt: string
}

interface JobFrame {
  start: number
  end: number
  total: number
  selected: number[]
  rendered: number[]
  failed: number[]
  assigned: number[]
}

interface Job {
  jobId: string
  blendFileName: string
  type: 'image' | 'animation'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  frames: JobFrame
  settings: any
  outputUrls: FrameImage[]
  assignedNodes: Record<string, number[]>
  createdAt: string
  updatedAt: string
  completedAt?: string
  blendFileUrl?: string
  blendFileKey?: string
}

const JobDetails: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { getJob, cancelJob, currentJob, updateJobProgress } = jobStore()
  
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    if (jobId) {
      loadJob()
      
      // Subscribe to WebSocket updates
      const unsubscribe = websocketService.subscribeToJob(jobId, (updatedJob) => {
        console.log('WebSocket job update received:', updatedJob)
        updateJobProgress(jobId, updatedJob)
        
        // If job just completed, show toast
        if (updatedJob.status === 'completed' && currentJob?.status !== 'completed') {
          toast.success('🎉 Job completed! All frames rendered.')
        }
      })
      
      // Auto-refresh interval
      let interval: number
      if (autoRefresh && currentJob?.status === 'processing') {
        interval = window.setInterval(() => {
          loadJob(false)
        }, 10000) // Refresh every 10 seconds
      }
      
      return () => {
        unsubscribe()
        if (interval) clearInterval(interval)
      }
    }
  }, [jobId, autoRefresh])

  const loadJob = async (showLoading = true) => {
    if (!jobId) return
    
    if (showLoading) setIsLoading(true)
    try {
      await getJob(jobId)
    } catch (error) {
      console.error('Error loading job:', error)
      toast.error('Failed to load job details')
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  const handleCancelJob = async () => {
    if (!jobId) return
    
    if (window.confirm('Are you sure you want to cancel this job?')) {
      try {
        const success = await jobStore.getState().cancelJob(jobId, false)
        if (success) {
          toast.success('Job cancelled successfully')
          navigate('/client/dashboard')
        }
      } catch (error) {
        toast.error('Failed to cancel job')
      }
    }
  }

  const handleDownloadFrame = async (frame: FrameImage) => {
    try {
      const link = document.createElement('a')
      link.href = frame.freshUrl || frame.url
      link.download = `frame_${frame.frame.toString().padStart(4, '0')}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Frame downloaded')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download frame')
    }
  }

  const handleDownloadAll = async () => {
    if (!currentJob?.outputUrls?.length) {
      toast.error('No frames to download')
      return
    }
    
    toast.loading('Preparing download...', { id: 'download' })
    
    // Download each frame individually
    currentJob.outputUrls.forEach((frame, index) => {
      setTimeout(() => {
        if (frame.freshUrl || frame.url) {
          const link = document.createElement('a')
          link.href = frame.freshUrl || frame.url
          link.download = `frame_${frame.frame.toString().padStart(4, '0')}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      }, index * 500)
    })
    
    setTimeout(() => {
      toast.dismiss('download')
      toast.success('Download started in background')
    }, 1000)
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } catch {
      return 'Invalid date'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500'
      case 'processing': return 'bg-blue-500 animate-pulse'
      case 'pending': return 'bg-amber-500'
      case 'failed': return 'bg-red-500'
      case 'cancelled': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle
      case 'processing': return RefreshCw
      case 'pending': return Clock
      case 'failed': return AlertCircle
      case 'cancelled': return X
      default: return Clock
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading job details...</p>
        </div>
      </div>
    )
  }

  if (!currentJob) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-medium mb-2">Job Not Found</h2>
          <p className="text-gray-400 mb-6">The job you're looking for doesn't exist or failed to load</p>
          <Button onClick={() => navigate('/client/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const {
    jobId: id,
    blendFileName = 'Unnamed Job',
    type = 'animation',
    status = 'pending',
    progress = 0,
    frames = { start: 1, end: 1, total: 0, selected: [], rendered: [], failed: [], assigned: [] },
    settings = {},
    outputUrls = [],
    assignedNodes = {},
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
    completedAt,
    blendFileUrl,
    blendFileKey
  } = currentJob as Job

  const StatusIcon = getStatusIcon(status)

  const totalFrames = frames?.total || 0
  const renderedFrames = frames?.rendered?.length || 0
  const failedFrames = frames?.failed?.length || 0
  const assignedFrames = frames?.assigned?.length || 0
  const pendingFrames = Math.max(0, totalFrames - renderedFrames - failedFrames)

  const activeNodes = Object.keys(assignedNodes || {}).length
  const totalRenderTime = (outputUrls || []).reduce((sum, frame) => sum + (frame.fileSize || 0), 0)

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
                <h1 className="text-2xl font-bold truncate max-w-2xl">{blendFileName}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <Badge className={`${getStatusColor(status)}`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {status.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-gray-400">Job ID: {id?.substring(0, 8)}...</span>
                  <span className="text-sm text-gray-400">
                    Created: {new Date(createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
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
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                >
                  Cancel Job
                </Button>
              )}
              
              {status === 'completed' && outputUrls.length > 0 && (
                <Button
                  onClick={handleDownloadAll}
                  className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={() => loadJob()}
                className="border-white/20 hover:bg-white/5"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
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
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(status)} animate-pulse`} />
                        <span className="font-medium">Rendering in progress</span>
                      </div>
                      <span className="font-bold text-xl">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-sm text-gray-400 mt-2">
                      <span>
                        {renderedFrames} of {totalFrames} frames rendered
                      </span>
                      <span>
                        {pendingFrames} pending • {failedFrames} failed
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
                        {Math.ceil(pendingFrames * 0.5)}m
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
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="frames">Frames ({renderedFrames})</TabsTrigger>
                <TabsTrigger value="nodes">Nodes ({activeNodes})</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Job Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">{renderedFrames}</div>
                        <div className="text-xs text-gray-400">Frames Rendered</div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">{pendingFrames}</div>
                        <div className="text-xs text-gray-400">Pending Frames</div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">
                          {formatFileSize(totalRenderTime)}
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
                {type === 'animation' && totalFrames > 1 && (
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
                          <span className="font-medium">{totalFrames}</span>
                        </div>
                        
                        {renderedFrames > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-emerald-400">Rendered ({renderedFrames})</span>
                              <span className="text-sm">
                                {Math.round((renderedFrames / totalFrames) * 100)}%
                              </span>
                            </div>
                            <Progress value={(renderedFrames / totalFrames) * 100} className="h-2" />
                          </div>
                        )}
                        
                        {assignedFrames > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-400">Assigned ({assignedFrames})</span>
                              <span className="text-sm">
                                {Math.round((assignedFrames / totalFrames) * 100)}%
                              </span>
                            </div>
                            <Progress value={(assignedFrames / totalFrames) * 100} className="h-2" />
                          </div>
                        )}
                        
                        {pendingFrames > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-amber-400">Pending ({pendingFrames})</span>
                              <span className="text-sm">
                                {Math.round((pendingFrames / totalFrames) * 100)}%
                              </span>
                            </div>
                            <Progress value={(pendingFrames / totalFrames) * 100} className="h-2" />
                          </div>
                        )}
                        
                        {failedFrames > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-red-400">Failed ({failedFrames})</span>
                              <span className="text-sm">
                                {Math.round((failedFrames / totalFrames) * 100)}%
                              </span>
                            </div>
                            <Progress value={(failedFrames / totalFrames) * 100} className="h-2" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Activity */}
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-400" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {outputUrls.length > 0 ? (
                      <div className="space-y-3">
                        {outputUrls.slice(-5).reverse().map((frame, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                            <div className="p-2 rounded-full bg-emerald-500/20">
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">
                                Frame {frame.frame} completed
                              </div>
                              <div className="text-sm text-gray-400">
                                {formatTime(frame.uploadedAt)} • {formatFileSize(frame.fileSize)}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadFrame(frame)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        No frames rendered yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="frames" className="space-y-6">
                {/* Frame Gallery Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Rendered Frames</h3>
                    <p className="text-sm text-gray-400">
                      {renderedFrames} of {totalFrames} frames completed
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
                {outputUrls.length > 0 ? (
                  viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {outputUrls.map((frame, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="group relative overflow-hidden rounded-lg bg-white/5 border border-white/10 hover:border-blue-500/50 transition-all duration-300"
                        >
                          <div className="aspect-square relative overflow-hidden">
                            <img
                              src={frame.freshUrl || frame.url}
                              alt={`Frame ${frame.frame}`}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x300/1f2937/9ca3af?text=No+Preview'
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            
                            <div className="absolute top-2 right-2">
                              <Badge className="bg-black/50 backdrop-blur-sm">
                                {frame.frame}
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
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 hover:bg-white/20"
                                    onClick={() => handleDownloadFrame(frame)}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-3">
                            <div className="text-sm font-medium truncate">
                              Frame {frame.toString().padStart(4, '0')}
                            </div>
                            <div className="text-xs text-gray-400 truncate">
                              {formatTime(frame.uploadedAt)}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {outputUrls.map((frame, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                          <div className="w-20 h-20 rounded overflow-hidden flex-shrink-0">
                            <img
                              src={frame.freshUrl || frame.url}
                              alt={`Frame ${frame.frame}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x300/1f2937/9ca3af?text=No+Preview'
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">
                              Frame {frame.frame.toString().padStart(4, '0')}
                            </div>
                            <div className="text-sm text-gray-400">
                              {formatTime(frame.uploadedAt)} • {formatFileSize(frame.fileSize)}
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadFrame(frame)}
                            >
                              <Download className="w-4 h-4" />
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
                      Rendered frames will appear here
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
                        {Object.entries(assignedNodes).map(([nodeId, nodeFrames], index) => (
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
                          <div className="font-medium">{settings.outputFormat || 'PNG'}</div>
                        </div>
                        {settings.denoiser && (
                          <div>
                            <label className="text-sm text-gray-400">Denoiser</label>
                            <div className="font-medium">{settings.denoiser}</div>
                          </div>
                        )}
                        {settings.tileSize && (
                          <div>
                            <label className="text-sm text-gray-400">Tile Size</label>
                            <div className="font-medium">{settings.tileSize}</div>
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
                    <Badge className={getStatusColor(status)}>
                      {status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Progress:</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Frames:</span>
                    <span className="font-medium">
                      {renderedFrames}/{totalFrames}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type:</span>
                    <span className="font-medium capitalize">{type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Size:</span>
                    <span className="font-medium">
                      {formatFileSize(totalRenderTime)}
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
                    onClick={() => loadJob()}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Status
                  </Button>
                  
                  {status === 'completed' && outputUrls.length > 0 && (
                    <Button
                      variant="outline"
                      className="w-full justify-start border-white/20 hover:bg-white/5"
                      onClick={handleDownloadAll}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download All Frames
                    </Button>
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
                  <div className={`w-3 h-3 rounded-full ${websocketService.isConnected() ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
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
                    <span>{new Date(createdAt).toLocaleTimeString()}</span>
                  </div>
                  {status === 'completed' && completedAt ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Completed:</span>
                        <span>{new Date(completedAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duration:</span>
                        <span>
                          {Math.round((new Date(completedAt).getTime() - new Date(createdAt).getTime()) / 60000)} minutes
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Elapsed:</span>
                      <span>
                        {Math.round((Date.now() - new Date(createdAt).getTime()) / 60000)} minutes
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg. Frame Time:</span>
                    <span>~30 seconds</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default JobDetails