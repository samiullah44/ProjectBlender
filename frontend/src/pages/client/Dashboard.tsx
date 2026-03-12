// pages/client/Dashboard.tsx - OPTIMIZED FOR LIVE UPDATES WITH TABS
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
  Timer,
  Search,
  Filter,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { useNavigate } from 'react-router-dom'
import jobStore from '@/stores/jobStore'
import { websocketService } from '@/services/websocketService'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'
import { type Job } from '@/stores/jobStore'

interface SystemStats {
  totalJobs: number
  activeJobs: number
  processingJobs: number
  pendingJobs: number
  completedJobs: number
  failedJobs: number
  completedToday: number
  totalRenderTime: number
  totalCreditsUsed: number
  totalFramesRendered: number
  avgRenderTimePerFrame: number
  framesRenderedToday: number
}

const NodeProviderCard: React.FC = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  // If user is already a node provider, don't show the card
  if (!user || user.roles?.includes('node_provider')) {
    return null
  }

  const handleNavigateToForm = () => {
    navigate('/apply-node-provider')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <Card className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/30 backdrop-blur-sm">
        <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              Earn by Rendering
            </h3>
            <p className="text-gray-300 max-w-xl">
              Become a node provider and earn credits or money by contributing your GPU power to the network.
              Join our distributed rendering ecosystem today.
            </p>
            {user.nodeProviderStatus === 'rejected' && user.rejectionReason && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-300">
                  <strong>Application Rejected:</strong> {user.rejectionReason}
                </p>
              </div>
            )}
          </div>
          {user.nodeProviderStatus === 'pending' ? (
            <Button disabled variant="outline" className="border-purple-500/50 text-purple-300 bg-purple-500/10 dark:bg-purple-900/20 cursor-not-allowed opacity-80">
              <Clock className="w-4 h-4 mr-2" />
              Application Pending
            </Button>
          ) : (
            <div className="relative group">
              <Button
                onClick={handleNavigateToForm}
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 transition-all duration-300 hover:scale-105"
              >
                <Zap className="w-4 h-4 mr-2 fill-current" />
                {user.nodeProviderStatus === 'rejected' ? 'Reapply' : 'Apply as Node Provider'}
              </Button>
              {/* Hover Hint Tooltip */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-3 px-3 py-2 text-xs text-white bg-gray-900/90 border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 pointer-events-none shadow-xl">
                Start earning active income with your hardware
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900/90 border-t border-l border-white/10 rotate-45"></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Component sections
const StatsSection: React.FC<{ stats: any[], isLoading: boolean }> = ({ stats, isLoading }) => (
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
)

// Tabbed Content Components
const DashboardTab: React.FC<{
  activeJobs: any[],
  recentActivity: any[],
  navigate: any,
  isLoading: boolean,
  webSocketConnected: boolean,
  averageProgress: number
}> = ({
  activeJobs,
  recentActivity,
  navigate,
  isLoading,
  webSocketConnected,
  averageProgress
}) => (
    <div className="space-y-6">
      <ActiveJobsSection
        activeJobs={activeJobs}
        navigate={navigate}
        isLoading={isLoading}
        webSocketConnected={webSocketConnected}
        averageProgress={averageProgress}
      />
      <RecentActivitySection recentActivity={recentActivity} navigate={navigate} />
    </div>
  )

const AllJobsTab: React.FC<{
  jobs: Job[],
  pagination: { total: number, page: number, limit: number, pages: number },
  listJobs: (params: any) => Promise<any>,
  navigate: any,
  getJobProgress: (job: Job) => number,
  getRenderedFrames: (job: Job) => number,
  globalStats: any
}> = ({
  jobs,
  pagination,
  listJobs,
  navigate,
  getJobProgress,
  getRenderedFrames,
  globalStats
}) => {
    const [filter, setFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [localLoading, setLocalLoading] = useState(false)

    // Fetch jobs when filters or search change (reset to page 1)
    useEffect(() => {
      const fetchJobs = async () => {
        setLocalLoading(true)
        await listJobs({
          status: filter === 'all' ? undefined : filter,
          search: searchQuery || undefined,
          page: 1, // Reset to page 1 on filter/search change
          limit: pagination.limit
        })
        setLocalLoading(false)
      }

      const timer = setTimeout(() => {
        if (filter !== 'all' || searchQuery) {
          fetchJobs()
        }
      }, 300)

      return () => clearTimeout(timer)
    }, [filter, searchQuery]) // Only depend on filter/search for the "reset to 1" effect

    // Fetch jobs when page changes
    useEffect(() => {
      const fetchJobs = async () => {
        setLocalLoading(true)
        await listJobs({
          status: filter === 'all' ? undefined : filter,
          search: searchQuery || undefined,
          page: pagination.page,
          limit: pagination.limit
        })
        setLocalLoading(false)
      }

      // Avoid double fetch on initial mount or when page is already correctly set by the filter effect
      if (pagination.page !== 1 || (filter === 'all' && !searchQuery)) {
        fetchJobs()
      }
    }, [pagination.page])

    const handlePageChange = (newPage: number) => {
      if (newPage < 1 || newPage > pagination.pages) return
      listJobs({
        status: filter === 'all' ? undefined : filter,
        search: searchQuery || undefined,
        page: newPage,
        limit: pagination.limit
      })
    }

    const filteredJobs = jobs // Now handled by server-side listJobs

    const statusCounts = useMemo(() => {
      return {
        all: globalStats.totalJobs || pagination.total,
        completed: globalStats.completedJobs || 0,
        processing: globalStats.processingJobs || 0,
        pending: globalStats.pendingJobs || 0,
        failed: globalStats.failedJobs || 0
      }
    }, [globalStats, pagination.total])

    return (
      <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-amber-400" />
                All Jobs ({filteredJobs.length})
              </CardTitle>
              <CardDescription>
                View and manage all your render jobs
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/20 w-48"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="border-white/20"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            {['all', 'processing', 'completed', 'pending', 'failed'].map((status) => (
              <Button
                key={status}
                variant={filter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(status)}
                className="border-white/20 text-xs"
              >
                {status === 'all' ? 'All' : status}
                <Badge className={`ml-1 ${filter === status ? 'bg-white/20' :
                  status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                    status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                      status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                  }`}>
                  {statusCounts[status as keyof typeof statusCounts]}
                </Badge>
              </Button>
            ))}
          </div>

          {filteredJobs.length > 0 ? (
            <>
              <div className={`space-y-3 max-h-[500px] overflow-y-auto ${localLoading ? 'opacity-50' : ''}`}>
                {filteredJobs.map((job) => {
                  const progress = getJobProgress(job)
                  const renderedFrames = getRenderedFrames(job)
                  const totalFrames = job.frames?.total || 0

                  return (
                    <div
                      key={job.jobId}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-all duration-300 cursor-pointer group"
                      onClick={() => navigate(`/client/jobs/${job.jobId}`)}
                    >
                      <div className={`p-2 rounded-full transition-transform duration-300 group-hover:scale-110 ${job.status === 'completed' ? 'bg-emerald-500/20' :
                        job.status === 'processing' ? 'bg-blue-500/20' :
                          job.status === 'failed' ? 'bg-red-500/20' :
                            'bg-amber-500/20'
                        }`}>
                        {job.status === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : job.status === 'processing' ? (
                          <RefreshCw className="w-4 h-4 text-blue-400" />
                        ) : job.status === 'failed' ? (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate mb-1">{job.name || job.blendFileName}</div>
                        <div className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
                          <Badge className={`px-2 py-0.5 text-xs ${job.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                            job.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                              job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                'bg-amber-500/20 text-amber-400'
                            }`}>
                            {job.status}
                          </Badge>
                          <span>•</span>
                          <span>{job.type}</span>
                          <span>•</span>
                          <span>{totalFrames} frames</span>
                          {job.status === 'processing' && (
                            <>
                              <span>•</span>
                              <span>{progress}%</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  )
                })}
              </div>

              {/* Pagination Controls */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
                  <div className="text-sm text-gray-400">
                    Showing <span className="text-white">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                    <span className="text-white">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>{' '}
                    of <span className="text-white">{pagination.total}</span> jobs
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1 || localLoading}
                      className="border-white/20"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1 mx-2">
                      {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                        // Simple pagination logic for first 5 pages or current surroundings
                        let pageNum = i + 1;
                        if (pagination.pages > 5 && pagination.page > 3) {
                          pageNum = pagination.page - 2 + i;
                          if (pageNum > pagination.pages) pageNum = pagination.pages - (4 - i);
                        }
                        if (pageNum <= 0) return null;
                        if (pageNum > pagination.pages) return null;

                        return (
                          <Button
                            key={pageNum}
                            variant={pagination.page === pageNum ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            disabled={localLoading}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.pages || localLoading}
                      className="border-white/20"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              {localLoading ? (
                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin opacity-50" />
              ) : (
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              )}
              <p>{localLoading ? 'Loading jobs...' : 'No jobs found matching your criteria'}</p>
              {searchQuery && !localLoading && (
                <Button
                  variant="outline"
                  className="mt-4 border-white/20 hover:bg-white/5"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear search
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

// Existing ActiveJobsSection component (keep as is)
const ActiveJobsSection: React.FC<{ activeJobs: any[], navigate: any, isLoading: boolean, webSocketConnected: boolean, averageProgress: number }> = ({
  activeJobs, navigate, isLoading, webSocketConnected, averageProgress
}) => (
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
          <div className="space-y-4">
            {/* Skeleton Loaders */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10 animate-pulse">
                <div className="flex justify-between mb-3">
                  <div className="h-4 bg-white/10 rounded w-1/3"></div>
                  <div className="h-4 bg-white/10 rounded w-8"></div>
                </div>
                <div className="h-2 bg-white/10 rounded w-full mb-3"></div>
                <div className="flex gap-4">
                  <div className="h-3 bg-white/10 rounded w-16"></div>
                  <div className="h-3 bg-white/10 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activeJobs.length > 0 ? (
          <div className="space-y-4">
            {activeJobs.slice(0, 3).map((job) => {
              const progress = job.progress || 0
              const renderedFrames = job.renderedFrames || 0
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
                        {job.name || job.blendFileName}
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
)

// Existing RecentActivitySection component (keep as is)
const RecentActivitySection: React.FC<{ recentActivity: any[], navigate: any }> = ({ recentActivity, navigate }) => (
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
                <div className={`p-2 rounded-full transition-transform duration-300 group-hover:scale-110 ${activity.type === 'success' ? 'bg-emerald-500/20' :
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
                    <Badge className={`px-2 py-0.5 text-xs ${activity.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
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
)

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate()
  const {
    jobs,
    isLoading,
    error,
    getDashboardStats,
    refreshJobs,
    listJobs,
    pagination,
    webSocketConnected
  } = jobStore()

  const [refreshing, setRefreshing] = useState(false)
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [realTimeStats, setRealTimeStats] = useState<any>(null)
  const [jobSubscriptions, setJobSubscriptions] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('dashboard')

  // Calculate accurate statistics from jobs
  const dashboardStats = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const completedJobs = jobs.filter(j => j.status === 'completed')
    const activeJobs = jobs.filter(j => j.status === 'processing' || j.status === 'pending')
    const failedJobs = jobs.filter(j => j.status === 'failed')

    // Local fallback for today's stats (still useful for immediate feedback)
    const framesRenderedTodayLocal = completedJobs.reduce((total, job) => {
      const jobDate = new Date(job.updatedAt || job.createdAt)
      if (jobDate >= today) {
        return total + (job.outputUrls?.length || job.frames?.rendered?.length || 0)
      }
      return total
    }, 0)

    return {
      totalJobs: realTimeStats?.totalJobs || systemStats?.totalJobs || pagination.total || jobs.length,
      activeJobs: realTimeStats?.activeJobs || systemStats?.activeJobs || activeJobs.length,
      processingJobs: realTimeStats?.processingJobs || systemStats?.processingJobs || jobs.filter(j => j.status === 'processing').length,
      pendingJobs: realTimeStats?.pendingJobs || systemStats?.pendingJobs || jobs.filter(j => j.status === 'pending').length,
      completedJobs: realTimeStats?.completedJobs || systemStats?.completedJobs || completedJobs.length,
      failedJobs: realTimeStats?.failedJobs || systemStats?.failedJobs || failedJobs.length,
      completedToday: realTimeStats?.completedToday || systemStats?.completedToday || completedJobs.filter(j => {
        const jobDate = new Date(j.updatedAt || j.createdAt)
        return jobDate >= today
      }).length,
      framesRenderedToday: realTimeStats?.framesRenderedToday || systemStats?.framesRenderedToday || framesRenderedTodayLocal,
      totalFramesRendered: realTimeStats?.totalFramesRendered || systemStats?.totalFramesRendered || 0, // Should come from API
      estimatedRenderTime: realTimeStats?.totalRenderTime || systemStats?.totalRenderTime || (systemStats?.totalFramesRendered || 0) * 120,
      creditsUsed: realTimeStats?.totalCreditsUsed || systemStats?.totalCreditsUsed || (systemStats?.totalFramesRendered || 0) * 0.5
    }
  }, [jobs, systemStats, realTimeStats, pagination.total])

  const subscribeToActiveJobs = useCallback(() => {
    const activeJobIds = jobs
      .filter(job => job.status === 'processing' || job.status === 'pending')
      .map(job => job.jobId)

    const jobsToSubscribe = activeJobIds.filter(jobId => !jobSubscriptions.has(jobId))

    if (jobsToSubscribe.length > 0 && websocketService.isConnected()) {
      jobsToSubscribe.forEach(jobId => {
        websocketService.subscribeToJob(jobId, (updatedJob) => {
          console.log(`📊 Dashboard received update for job ${jobId}:`, updatedJob.progress)
        })
      })

      setJobSubscriptions(prev => new Set([...prev, ...jobsToSubscribe]))
    }
  }, [jobs, jobSubscriptions])

  const cleanupJobSubscriptions = useCallback(() => {
    const activeJobIds = new Set(
      jobs
        .filter(job => job.status === 'processing' || job.status === 'pending')
        .map(job => job.jobId)
    )

    const subscriptionsToRemove = Array.from(jobSubscriptions).filter(
      jobId => !activeJobIds.has(jobId)
    )

    if (subscriptionsToRemove.length > 0) {
      setJobSubscriptions(prev => {
        const newSet = new Set(prev)
        subscriptionsToRemove.forEach(jobId => newSet.delete(jobId))
        return newSet
      })
    }
  }, [jobs, jobSubscriptions])

  useEffect(() => {
    fetchDashboardData()
    websocketService.connect()

    const unsubscribeSystem = websocketService.subscribeToSystem((data) => {
      if (data.type === 'system_stats') {
        setRealTimeStats(data.data)
      }
    })

    return () => {
      unsubscribeSystem()
    }
  }, [])

  // Ensure dashboard shows latest jobs when switching back
  useEffect(() => {
    if (activeTab === 'dashboard') {
      refreshJobs()
    }
  }, [activeTab])

  useEffect(() => {
    if (websocketService.isConnected()) {
      subscribeToActiveJobs()
      cleanupJobSubscriptions()
    }
  }, [jobs, websocketService.isConnected(), subscribeToActiveJobs, cleanupJobSubscriptions])

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true)
      const apiStats = await getDashboardStats()
      setSystemStats(apiStats)
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

  const getJobProgress = (job: Job): number => {
    return job.progress || 0
  }

  const getRenderedFrames = (job: Job): number => {
    return job.outputUrls?.length || job.frames?.rendered?.length || 0
  }

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

  const averageProgress = useMemo(() => {
    if (activeJobs.length === 0) return 0
    const total = activeJobs.reduce((sum, job) => sum + getJobProgress(job), 0)
    return Math.round(total / activeJobs.length)
  }, [activeJobs])

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white"
    >
      {/* Header */}
      <div
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
              {/* <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
                <div className={`w-2 h-2 rounded-full ${webSocketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-sm">
                  {webSocketConnected ? 'Live Updates' : 'Offline'}
                </span>
              </div> */}

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
      </div>

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

        <NodeProviderCard />
        <StatsSection stats={stats} isLoading={isLoading} />

        {/* Main Content with Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-6" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 bg-gray-900/50 border border-white/10">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="all-jobs" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              All Jobs ({pagination.total})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Active Jobs & Recent Activity */}
              <div className="lg:col-span-2 space-y-6">
                <DashboardTab
                  activeJobs={activeJobs}
                  recentActivity={recentActivity}
                  navigate={navigate}
                  isLoading={isLoading}
                  webSocketConnected={webSocketConnected}
                  averageProgress={averageProgress}
                />
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
                        {/* {webSocketConnected ? (
                          <Wifi className="w-5 h-5 text-emerald-400 animate-pulse" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-red-400" />
                        )} */}
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
          </TabsContent>

          <TabsContent value="all-jobs">
            <AllJobsTab
              jobs={jobs}
              pagination={pagination}
              listJobs={listJobs}
              navigate={navigate}
              getJobProgress={getJobProgress}
              getRenderedFrames={getRenderedFrames}
              globalStats={dashboardStats}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default ClientDashboard