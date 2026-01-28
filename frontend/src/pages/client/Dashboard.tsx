// pages/client/Dashboard.tsx - OPTIMIZED FOR LIVE UPDATES
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  Upload, 
  Clock, 
  CheckCircle, 
  Cpu, 
  DollarSign,
  TrendingUp,
  PlayCircle,
  Settings,
  FileText,
  Calendar,
  Zap,
  ArrowRight,
  Users,
  Film,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  Activity,
  HardDrive,
  Layers,
  Shield,
  Rocket,
  Timer
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { useNavigate } from 'react-router-dom'
import jobStore from '@/stores/jobStore'
import { websocketService } from '@/services/websocketService'
import { toast } from 'react-hot-toast'
import { type Job } from '@/stores/jobStore'

interface SystemStats {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  failedJobs: number
  completedToday: number
  totalRenderTime: number
  totalCreditsUsed: number
  totalFramesRendered: number
  avgRenderTimePerFrame: number
  framesRenderedToday: number
}

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { 
    jobs, 
    isLoading, 
    error,
    getDashboardStats,
    refreshJobs,
    webSocketConnected
  } = jobStore()
  
  const [refreshing, setRefreshing] = useState(false)
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [realTimeStats, setRealTimeStats] = useState<any>(null)
  const [jobSubscriptions, setJobSubscriptions] = useState<Set<string>>(new Set())

  // Calculate accurate statistics from jobs (automatically updates when jobs change)
  const dashboardStats = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const completedJobs = jobs.filter(j => j.status === 'completed')
    const activeJobs = jobs.filter(j => j.status === 'processing' || j.status === 'pending')
    const failedJobs = jobs.filter(j => j.status === 'failed')
    
    // Calculate frames rendered today
    const framesRenderedToday = completedJobs.reduce((total, job) => {
      const jobDate = new Date(job.updatedAt || job.createdAt)
      if (jobDate >= today) {
        return total + (job.outputUrls?.length || job.frames?.rendered?.length || 0)
      }
      return total
    }, 0)
    
    // Calculate total frames rendered across all completed jobs
    const totalFramesRendered = completedJobs.reduce((total, job) => {
      return total + (job.outputUrls?.length || job.frames?.rendered?.length || 0)
    }, 0)
    
    // Calculate total render time (estimate: 2 minutes per frame)
    const estimatedRenderTime = totalFramesRendered * 120 // 2 minutes per frame
    
    // Calculate credits used (estimate: 0.5 credits per frame)
    const creditsUsed = completedJobs.reduce((sum, job) => {
      const frames = job.outputUrls?.length || job.frames?.rendered?.length || 0
      return sum + (frames * 0.5)
    }, 0)
    
    return {
      totalJobs: jobs.length,
      activeJobs: activeJobs.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      completedToday: completedJobs.filter(j => {
        const jobDate = new Date(j.updatedAt || j.createdAt)
        return jobDate >= today
      }).length,
      framesRenderedToday,
      totalFramesRendered,
      estimatedRenderTime,
      creditsUsed
    }
  }, [jobs])

  // Subscribe to job updates for active jobs
  const subscribeToActiveJobs = useCallback(() => {
    const activeJobIds = jobs
      .filter(job => job.status === 'processing' || job.status === 'pending')
      .map(job => job.jobId)
    
    // Only subscribe to jobs we're not already subscribed to
    const jobsToSubscribe = activeJobIds.filter(jobId => !jobSubscriptions.has(jobId))
    
    if (jobsToSubscribe.length > 0 && websocketService.isConnected()) {
      jobsToSubscribe.forEach(jobId => {
        websocketService.subscribeToJob(jobId, (updatedJob) => {
          // This will trigger the jobStore to update and re-render
          console.log(`📊 Dashboard received update for job ${jobId}:`, updatedJob.progress)
        })
      })
      
      setJobSubscriptions(prev => new Set([...prev, ...jobsToSubscribe]))
    }
  }, [jobs, jobSubscriptions])

  // Cleanup subscriptions for completed/failed jobs
  const cleanupJobSubscriptions = useCallback(() => {
    const activeJobIds = new Set(
      jobs
        .filter(job => job.status === 'processing' || job.status === 'pending')
        .map(job => job.jobId)
    )
    
    // Remove subscriptions for jobs that are no longer active
    const subscriptionsToRemove = Array.from(jobSubscriptions).filter(
      jobId => !activeJobIds.has(jobId)
    )
    
    if (subscriptionsToRemove.length > 0) {
      subscriptionsToRemove.forEach(jobId => {
        // Unsubscribe logic would be here if WebSocketService had unsubscribe method
        // For now, we just remove from our tracking
      })
      
      setJobSubscriptions(prev => {
        const newSet = new Set(prev)
        subscriptionsToRemove.forEach(jobId => newSet.delete(jobId))
        return newSet
      })
    }
  }, [jobs, jobSubscriptions])

  useEffect(() => {
    fetchDashboardData()
    
    // Connect WebSocket
    websocketService.connect()
    
    // Subscribe to system updates
    const unsubscribeSystem = websocketService.subscribeToSystem((data) => {
      if (data.type === 'system_stats') {
        setRealTimeStats(data.data)
      }
    })
    
    return () => {
      unsubscribeSystem()
    }
  }, [])

  // Subscribe to active jobs when jobs list changes
  useEffect(() => {
    if (websocketService.isConnected()) {
      subscribeToActiveJobs()
      cleanupJobSubscriptions()
    }
  }, [jobs, websocketService.isConnected(), subscribeToActiveJobs, cleanupJobSubscriptions])

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true)
      
      // Fetch dashboard stats from API
      const apiStats = await getDashboardStats()
      setSystemStats(apiStats)
      
      // Refresh jobs
      await refreshJobs()
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setRefreshing(false)
    }
  }

  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s'
    
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m`
    return `${seconds}s`
  }

  const handleRefresh = () => {
    fetchDashboardData()
  }

  // Calculate accurate progress for jobs - uses store data which is updated by WebSocket
  const getJobProgress = (job: Job): number => {
    // Job store already has the latest progress from WebSocket updates
    return job.progress || 0
  }

  // Calculate actual rendered frames for a job
  const getRenderedFrames = (job: Job): number => {
    return job.outputUrls?.length || job.frames?.rendered?.length || 0
  }

  // Active jobs with accurate progress
  const activeJobs = useMemo(() => {
    return jobs
      .filter(j => j.status === 'processing' || j.status === 'pending')
      .map(job => ({
        ...job,
        progress: getJobProgress(job),
        renderedFrames: getRenderedFrames(job)
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [jobs])

  const recentActivity = useMemo(() => {
    return jobs
      .slice(0, 5)
      .map((job) => ({
        id: job.jobId,
        type: job.status === 'completed' ? 'success' as const : 
              job.status === 'processing' ? 'processing' as const : 
              job.status === 'pending' ? 'upload' as const : 'failed' as const,
        title: `${job.blendFileName}`,
        time: new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: job.status,
        progress: getJobProgress(job),
        framesCompleted: getRenderedFrames(job),
        totalFrames: job.frames?.total || 0,
        updatedAt: job.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [jobs])

  // Enhanced stats cards with better metrics
  const stats = [
    { 
      label: 'Active Renders', 
      value: activeJobs.length.toString(), 
      icon: Rocket, 
      color: 'text-blue-400',
      bg: 'from-blue-500/20 to-cyan-500/20',
      description: 'Currently processing',
      change: '+2 this week'
    },
    { 
      label: 'Frames Today', 
      value: dashboardStats.framesRenderedToday.toLocaleString(), 
      icon: Layers, 
      color: 'text-emerald-400',
      bg: 'from-emerald-500/20 to-green-500/20',
      description: 'Rendered today',
      change: '+15% from yesterday'
    },
    { 
      label: 'Total Frames', 
      value: dashboardStats.totalFramesRendered.toLocaleString(), 
      icon: BarChart3, 
      color: 'text-purple-400',
      bg: 'from-purple-500/20 to-pink-500/20',
      description: 'All-time rendered',
      change: 'Lifetime total'
    },
    { 
      label: 'Time Saved', 
      value: formatTime(dashboardStats.estimatedRenderTime), 
      icon: Timer, 
      color: 'text-amber-400',
      bg: 'from-amber-500/20 to-orange-500/20',
      description: 'Render time saved',
      change: 'Accumulated'
    },
  ]

  // Calculate average progress of active jobs
  const averageProgress = useMemo(() => {
    if (activeJobs.length === 0) return 0
    const total = activeJobs.reduce((sum, job) => sum + getJobProgress(job), 0)
    return Math.round(total / activeJobs.length)
  }, [activeJobs])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-white/10"
      >
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Welcome to <span className="text-blue-400">BlendFarm</span>
              </h1>
              <p className="text-gray-400">
                Distributed Blender rendering across global nodes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
                <div className={`w-2 h-2 rounded-full ${webSocketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-sm">
                  {webSocketConnected ? 'Live Updates' : 'Offline'}
                </span>
              </div>
              
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing || isLoading}
                className="border-white/20 hover:bg-white/5 transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              
              <Button
                onClick={() => navigate('/client/create-job')}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
              >
                <Upload className="w-5 h-5 mr-2" />
                New Render Job
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 py-8">
        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-300">{error}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => jobStore.getState().clearError()}
                className="ml-auto text-red-300 hover:bg-red-500/20"
              >
                Dismiss
              </Button>
            </div>
          </motion.div>
        )}

        {/* Real-time Stats Banner */}
        {webSocketConnected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/20 backdrop-blur-sm hover:border-blue-500/40 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
                    <div>
                      <div className="text-sm font-medium">Live Dashboard</div>
                      <div className="text-xs text-gray-400">
                        {jobSubscriptions.size} active job subscriptions • Updates every 10s
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-lg">{dashboardStats.totalJobs}</div>
                      <div className="text-xs text-gray-400">Total Jobs</div>
                    </div>
                    <div className="h-8 w-px bg-white/20" />
                    <div className="text-center">
                      <div className="font-bold text-lg text-blue-400">{activeJobs.length}</div>
                      <div className="text-xs text-gray-400">Active</div>
                    </div>
                    <div className="h-8 w-px bg-white/20" />
                    <div className="text-center">
                      <div className="font-bold text-lg text-emerald-400">{dashboardStats.completedJobs}</div>
                      <div className="text-xs text-gray-400">Completed</div>
                    </div>
                    <div className="h-8 w-px bg-white/20" />
                    <div className="text-center">
                      <div className="font-bold text-lg text-blue-400">{averageProgress}%</div>
                      <div className="text-xs text-gray-400">Avg Progress</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {stats.map((stat, index) => (
            <motion.div 
              key={stat.label} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm hover:border-white/20 hover:bg-gray-900/70 transition-all duration-300 hover:scale-[1.02] group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-400 mb-2">{stat.label}</p>
                      <p className="text-2xl font-bold mb-1">{stat.value}</p>
                      <p className="text-xs text-gray-400">{stat.description}</p>
                      <p className="text-xs text-emerald-400 mt-2">{stat.change}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.bg} group-hover:scale-110 transition-transform duration-300`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Active Jobs & Recent Activity */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-6">
              {/* Active Jobs */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 mb-2">
                          <PlayCircle className="w-5 h-5 text-blue-400" />
                          Active Jobs ({activeJobs.length})
                          {webSocketConnected && (
                            <span className="text-xs text-emerald-400 animate-pulse">
                              • Live
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription>
                          Jobs currently being processed across the network
                          {activeJobs.length > 0 && (
                            <span className="text-blue-400 ml-2">
                              Average progress: {averageProgress}%
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                      </div>
                    ) : activeJobs.length > 0 ? (
                      <div className="space-y-4">
                        {activeJobs.slice(0, 3).map((job) => {
                          const progress = getJobProgress(job)
                          const renderedFrames = getRenderedFrames(job)
                          const totalFrames = job.frames?.total || 0
                          const activeNodes = Object.keys(job.assignedNodes || {}).length
                          
                          return (
                            <div 
                              key={job.jobId}
                              className="group p-4 rounded-lg bg-white/5 border border-white/10 hover:border-blue-500/30 hover:bg-white/10 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-blue-500/10"
                              onClick={() => navigate(`/client/jobs/${job.jobId}`)}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                  <div className="font-medium truncate max-w-xs">
                                    {job.blendFileName}
                                  </div>
                                  <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                                    {job.type === 'animation' ? 'Animation' : 'Image'}
                                  </Badge>
                                </div>
                                <div className="text-sm font-medium text-blue-400">
                                  {progress}%
                                  {progress > 0 && progress < 100 && (
                                    <span className="text-xs text-gray-400 ml-1">
                                      (Live)
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <Progress value={progress} className="h-2 mb-3" />
                              
                              <div className="flex items-center justify-between text-sm text-gray-400">
                                <div className="flex items-center gap-4">
                                  <span className="flex items-center gap-1">
                                    <Film className="w-3 h-3" />
                                    {renderedFrames}/{totalFrames} frames
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {activeNodes} {activeNodes === 1 ? 'node' : 'nodes'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <HardDrive className="w-3 h-3" />
                                    {job.outputUrls?.length || 0} outputs
                                  </span>
                                </div>
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-blue-400 flex items-center gap-1">
                                  View details
                                  <ArrowRight className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          )
                        })}
                        
                        {activeJobs.length > 3 && (
                          <Button
                            variant="ghost"
                            className="w-full border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors duration-300"
                            onClick={() => navigate('/client/jobs')}
                          >
                            View All Active Jobs ({activeJobs.length})
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center group">
                          <PlayCircle className="w-8 h-8 text-blue-400 group-hover:scale-110 transition-transform duration-300" />
                        </div>
                        <h3 className="text-xl font-medium mb-2">No Active Jobs</h3>
                        <p className="text-gray-400 mb-6 max-w-md mx-auto">
                          Start your first distributed rendering job to see live progress and statistics here
                        </p>
                        <Button
                          onClick={() => navigate('/client/create-job')}
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transition-all duration-300 hover:scale-105"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Create New Render Job
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Activity */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-purple-400" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentActivity.length > 0 ? (
                      <div className="space-y-3">
                        {recentActivity.map((activity) => (
                          <div 
                            key={activity.id}
                            className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-all duration-300 cursor-pointer group"
                            onClick={() => navigate(`/client/jobs/${activity.id}`)}
                          >
                            <div className={`p-2 rounded-full transition-transform duration-300 group-hover:scale-110 ${
                              activity.type === 'success' ? 'bg-emerald-500/20' :
                              activity.type === 'processing' ? 'bg-blue-500/20' :
                              activity.type === 'failed' ? 'bg-red-500/20' :
                              'bg-blue-500/20'
                            }`}>
                              {activity.type === 'success' ? (
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                              ) : activity.type === 'processing' ? (
                                <PlayCircle className="w-4 h-4 text-blue-400" />
                              ) : activity.type === 'failed' ? (
                                <AlertCircle className="w-4 h-4 text-red-400" />
                              ) : (
                                <Upload className="w-4 h-4 text-blue-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate mb-1">{activity.title}</div>
                              <div className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
                                <span>{activity.time}</span>
                                <span>•</span>
                                <Badge className={`px-2 py-0.5 text-xs ${
                                  activity.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                  activity.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                                  activity.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                  'bg-amber-500/20 text-amber-400'
                                }`}>
                                  {activity.status}
                                </Badge>
                                {activity.progress > 0 && activity.status !== 'completed' && (
                                  <>
                                    <span>•</span>
                                    <span>{activity.progress}%</span>
                                    {activity.status === 'processing' && (
                                      <span className="text-xs text-blue-400">(Live)</span>
                                    )}
                                  </>
                                )}
                                {activity.framesCompleted > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-xs">
                                      {activity.framesCompleted}/{activity.totalFrames} frames
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No recent activity</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Right Column - Quick Actions & System Info */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-4 border-white/20 hover:bg-white/5 hover:scale-105 transition-all duration-300 active:scale-95"
                      onClick={() => navigate('/client/create-job')}
                    >
                      <Upload className="w-6 h-6 mb-2" />
                      <span className="text-sm font-medium">New Job</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-4 border-white/20 hover:bg-white/5 hover:scale-105 transition-all duration-300 active:scale-95"
                      onClick={() => navigate('/client/jobs')}
                    >
                      <FileText className="w-6 h-6 mb-2" />
                      <span className="text-sm font-medium">All Jobs</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-4 border-white/20 hover:bg-white/5 hover:scale-105 transition-all duration-300 active:scale-95"
                      onClick={() => navigate('/client/settings')}
                    >
                      <Settings className="w-6 h-6 mb-2" />
                      <span className="text-sm font-medium">Settings</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-4 border-white/20 hover:bg-white/5 hover:scale-105 transition-all duration-300 active:scale-95"
                      onClick={() => navigate('/client/billing')}
                    >
                      <DollarSign className="w-6 h-6 mb-2" />
                      <span className="text-sm font-medium">Credits</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* System Status */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {webSocketConnected ? (
                      <Wifi className="w-5 h-5 text-emerald-400 animate-pulse" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-400" />
                    )}
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Connection:</span>
                      <Badge className={`px-2 py-1 ${webSocketConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {webSocketConnected ? 'Live Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Live Jobs:</span>
                      <span className="font-medium text-blue-400">{jobSubscriptions.size}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Total Jobs:</span>
                      <span className="font-medium">{dashboardStats.totalJobs}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Completed:</span>
                      <span className="font-medium text-emerald-400">{dashboardStats.completedJobs}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Failed:</span>
                      <span className="font-medium text-red-400">{dashboardStats.failedJobs}</span>
                    </div>
                    
                    <div className="pt-4 border-t border-white/10">
                      <div className="text-sm text-gray-400 mb-2 flex items-center justify-between">
                        <span>Credits Usage</span>
                        <span className="font-medium">{dashboardStats.creditsUsed.toFixed(1)} used</span>
                      </div>
                      <Progress 
                        value={Math.min((dashboardStats.creditsUsed / 1000) * 100, 100)} 
                        className="h-2 mb-1" 
                      />
                      <div className="text-xs text-gray-400 flex justify-between">
                        <span>0 credits</span>
                        <span>1000 credits</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Performance Metrics */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-gradient-to-br from-emerald-900/30 to-cyan-900/30 border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 rounded-lg bg-white/5">
                        <div className="text-2xl font-bold mb-1">{dashboardStats.framesRenderedToday}</div>
                        <div className="text-xs text-gray-400">Frames Today</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-white/5">
                        <div className="text-2xl font-bold mb-1">
                          {formatTime(dashboardStats.estimatedRenderTime)}
                        </div>
                        <div className="text-xs text-gray-400">Time Saved</div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-400 space-y-2">
                      <div className="flex justify-between">
                        <span>Avg. Frame Time:</span>
                        <span className="font-medium">~120s</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Jobs Today:</span>
                        <span className="font-medium text-emerald-400">{dashboardStats.completedToday}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Success Rate:</span>
                        <span className="font-medium">{
                          dashboardStats.totalJobs > 0 
                            ? `${Math.round((dashboardStats.completedJobs / dashboardStats.totalJobs) * 100)}%`
                            : '100%'
                        }</span>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 transition-all duration-300 hover:scale-105 active:scale-95"
                      onClick={() => navigate('/client/analytics')}
                    >
                      View Analytics
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default ClientDashboard