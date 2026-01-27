// pages/client/Dashboard.tsx - UPDATED
import React, { useState, useEffect } from 'react'
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
  Activity
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { useNavigate } from 'react-router-dom'
import jobStore from '@/stores/jobStore'
import { websocketService } from '@/services/websocketService'
import { toast } from 'react-hot-toast'

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
  
  const [activeTab, setActiveTab] = useState('overview')
  const [refreshing, setRefreshing] = useState(false)
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [realTimeStats, setRealTimeStats] = useState<any>(null)

  useEffect(() => {
    fetchDashboardData()
    
    // Connect WebSocket
    websocketService.connect()
    
    // Subscribe to system updates
    const unsubscribe = websocketService.subscribeToSystem((data) => {
      if (data.type === 'system_stats') {
        setRealTimeStats(data.data)
      }
    })
    
    return () => {
      unsubscribe()
    }
  }, [])

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true)
      
      // Fetch dashboard stats
      const stats = await getDashboardStats()
      setSystemStats(stats)
      
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
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
    return `${Math.floor(seconds / 86400)}d`
  }

  const handleRefresh = () => {
    fetchDashboardData()
  }

  // Calculate stats from jobs
  const activeJobs = jobs.filter(j => j.status === 'processing' || j.status === 'pending')
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const failedJobs = jobs.filter(j => j.status === 'failed')

  const stats = [
    { 
      label: 'Active Jobs', 
      value: activeJobs.length.toString(), 
      icon: PlayCircle, 
      color: 'text-blue-400',
      bg: 'from-blue-500/20 to-cyan-500/20'
    },
    { 
      label: 'Completed Today', 
      value: (systemStats?.completedToday || 0).toString(), 
      icon: CheckCircle, 
      color: 'text-emerald-400',
      bg: 'from-emerald-500/20 to-green-500/20'
    },
    { 
      label: 'Total Frames', 
      value: (systemStats?.totalFramesRendered || 0).toLocaleString(), 
      icon: BarChart3, 
      color: 'text-purple-400',
      bg: 'from-purple-500/20 to-pink-500/20'
    },
    { 
      label: 'Time Saved', 
      value: formatTime(systemStats?.totalRenderTime || 0), 
      icon: Clock, 
      color: 'text-amber-400',
      bg: 'from-amber-500/20 to-orange-500/20'
    },
  ]

  const recentActivity = jobs
    .slice(0, 5)
    .map((job) => ({
      id: job.jobId,
      type: job.status === 'completed' ? 'success' as const : 
            job.status === 'processing' ? 'processing' as const : 'upload' as const,
      title: `${job.blendFileName}`,
      time: new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: job.status,
      progress: job.progress
    }))

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
                  {webSocketConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
                className="border-white/20 hover:bg-white/5"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              
              <Button
                onClick={() => navigate('/client/create-job')}
                className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
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
            className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-300">{error}</span>
            </div>
          </motion.div>
        )}

        {/* Real-time Stats Banner */}
        {realTimeStats && webSocketConnected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/20 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
                    <div>
                      <div className="text-sm font-medium">Live System Status</div>
                      <div className="text-xs text-gray-400">
                        {realTimeStats.activeNodes || 0} active nodes • {realTimeStats.connectedClients || 0} clients
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-bold">{realTimeStats.totalJobs || 0}</div>
                      <div className="text-xs text-gray-400">Total Jobs</div>
                    </div>
                    <div className="h-4 w-px bg-white/20" />
                    <div className="text-center">
                      <div className="font-bold">{realTimeStats.activeJobs || 0}</div>
                      <div className="text-xs text-gray-400">Active</div>
                    </div>
                    <div className="h-4 w-px bg-white/20" />
                    <div className="text-center">
                      <div className="font-bold">{realTimeStats.completedJobs || 0}</div>
                      <div className="text-xs text-gray-400">Completed</div>
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
              <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400 mb-2">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.bg}`}>
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
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <PlayCircle className="w-5 h-5 text-blue-400" />
                        Active Jobs ({activeJobs.length})
                      </CardTitle>
                      {webSocketConnected && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-gray-400">Live Updates</span>
                        </div>
                      )}
                    </div>
                    <CardDescription>
                      Jobs currently being processed across the network
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                      </div>
                    ) : activeJobs.length > 0 ? (
                      <div className="space-y-4">
                        {activeJobs.slice(0, 3).map((job) => (
                          <div 
                            key={job.jobId}
                            className="group p-4 rounded-lg bg-white/5 border border-white/10 hover:border-blue-500/30 hover:bg-white/10 transition-all duration-300 cursor-pointer"
                            onClick={() => navigate(`/client/jobs/${job.jobId}`)}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                <div className="font-medium truncate max-w-xs">
                                  {job.blendFileName}
                                </div>
                              </div>
                              <div className="text-sm font-medium text-blue-400">
                                {job.progress}%
                              </div>
                            </div>
                            
                            <Progress value={job.progress} className="h-2 mb-3" />
                            
                            <div className="flex items-center justify-between text-sm text-gray-400">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Film className="w-3 h-3" />
                                  {job.frames.rendered.length}/{job.frames.total} frames
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {Object.keys(job.assignedNodes || {}).length} nodes
                                </span>
                              </div>
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                View →
                              </span>
                            </div>
                          </div>
                        ))}
                        
                        {activeJobs.length > 3 && (
                          <Button
                            variant="ghost"
                            className="w-full border-dashed border-white/20 hover:border-white/40 hover:bg-white/5"
                            onClick={() => setActiveTab('jobs')}
                          >
                            View All Active Jobs ({activeJobs.length})
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                          <PlayCircle className="w-8 h-8 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-medium mb-2">No Active Jobs</h3>
                        <p className="text-gray-400 mb-6">
                          Start your first rendering job to see live progress here
                        </p>
                        <Button
                          onClick={() => navigate('/client/create-job')}
                          className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Create New Job
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
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
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
                            className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                            onClick={() => navigate(`/client/jobs/${activity.id}`)}
                          >
                            <div className={`p-2 rounded-full ${
                              activity.type === 'success' ? 'bg-emerald-500/20' :
                              activity.type === 'processing' ? 'bg-blue-500/20' :
                              'bg-blue-500/20'
                            }`}>
                              {activity.type === 'success' ? (
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                              ) : activity.type === 'processing' ? (
                                <PlayCircle className="w-4 h-4 text-blue-400" />
                              ) : (
                                <Upload className="w-4 h-4 text-blue-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{activity.title}</div>
                              <div className="text-sm text-gray-400 flex items-center gap-2">
                                <span>{activity.time}</span>
                                <span>•</span>
                                <span className="capitalize">{activity.status}</span>
                                {activity.progress > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>{activity.progress}%</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        No recent activity
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
              <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-white/10 backdrop-blur-sm">
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
                      className="flex-col h-auto py-4 border-white/20 hover:bg-white/5"
                      onClick={() => navigate('/client/create-job')}
                    >
                      <Upload className="w-6 h-6 mb-2" />
                      <span className="text-sm">New Job</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-4 border-white/20 hover:bg-white/5"
                      onClick={() => navigate('/client/jobs')}
                    >
                      <FileText className="w-6 h-6 mb-2" />
                      <span className="text-sm">All Jobs</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-4 border-white/20 hover:bg-white/5"
                      onClick={() => navigate('/client/settings')}
                    >
                      <Settings className="w-6 h-6 mb-2" />
                      <span className="text-sm">Settings</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-4 border-white/20 hover:bg-white/5"
                      onClick={() => navigate('/client/billing')}
                    >
                      <DollarSign className="w-6 h-6 mb-2" />
                      <span className="text-sm">Credits</span>
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
              <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {webSocketConnected ? (
                      <Wifi className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-400" />
                    )}
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">WebSocket:</span>
                      <Badge className={webSocketConnected ? 'bg-emerald-500' : 'bg-red-500'}>
                        {webSocketConnected ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Total Jobs:</span>
                      <span className="font-medium">{systemStats?.totalJobs || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Completed:</span>
                      <span className="font-medium">{systemStats?.completedJobs || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Failed:</span>
                      <span className="font-medium">{systemStats?.failedJobs || 0}</span>
                    </div>
                    <div className="pt-4 border-t border-white/10">
                      <div className="text-sm text-gray-400 mb-2">Credits Used</div>
                      <div className="flex items-center justify-between">
                        <span>Total:</span>
                        <span className="font-medium">{systemStats?.totalCreditsUsed || 0}</span>
                      </div>
                      <Progress 
                        value={Math.min(((systemStats?.totalCreditsUsed || 0) / 10000) * 100, 100)} 
                        className="h-1 mt-2" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Credits Balance */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-gradient-to-br from-emerald-900/30 to-cyan-900/30 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    Credits Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold mb-2">1,250</div>
                      <div className="text-sm text-gray-400">Available Credits</div>
                    </div>
                    <Button 
                      className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                      onClick={() => navigate('/client/billing')}
                    >
                      <DollarSign className="w-5 h-5 mr-2" />
                      Add Credits
                    </Button>
                    <div className="text-xs text-gray-400 text-center">
                      ~{Math.floor(1250 / 100)} average jobs remaining
                    </div>
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