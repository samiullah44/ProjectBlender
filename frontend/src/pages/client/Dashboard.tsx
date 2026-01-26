// pages/client/Dashboard.tsx
import React, { useState } from 'react'
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
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Progress } from '@/components/ui/Progress'
import { useNavigate } from 'react-router-dom'

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

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
                Welcome to <span className="text-blue-400">RenderFarm</span>
              </h1>
              <p className="text-gray-400">
                Distribute your 3D rendering across our global network
              </p>
            </div>
            <Button
              onClick={() => navigate('/client/create-job')}
              className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
            >
              <Upload className="w-5 h-5 mr-2" />
              New Render Job
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {stats.map((stat, index) => (
            <motion.div key={stat.label} variants={itemVariants}>
              <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm hover:bg-gray-900/70 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400 mb-2">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      {stat.trend && (
                        <p className={`text-xs mt-1 ${stat.trend.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>
                          {stat.trend}
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                      <stat.icon className="w-6 h-6 text-blue-400" />
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 bg-gray-900/50 border border-white/10">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="jobs">Active Jobs</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Active Jobs */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PlayCircle className="w-5 h-5 text-blue-400" />
                        Active Rendering Jobs
                      </CardTitle>
                      <CardDescription>
                        {activeJobs.length} jobs currently processing
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {activeJobs.map((job) => (
                          <div key={job.id} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{job.name}</div>
                                <div className="text-sm text-gray-400">
                                  {job.framesCompleted}/{job.totalFrames} frames • Started {job.started}
                                </div>
                              </div>
                              <div className="text-sm font-medium">{job.progress}%</div>
                            </div>
                            <Progress value={job.progress} className="h-2" />
                            <div className="flex items-center justify-between text-sm text-gray-400">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Cpu className="w-3 h-3" />
                                  {job.nodes} nodes
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {job.timeRemaining}
                                </span>
                              </div>
                              <Button variant="ghost" size="sm" className="text-xs">
                                View Details
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
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
                        <Clock className="w-5 h-5 text-purple-400" />
                        Recent Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {recentActivity.map((activity) => (
                          <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors">
                            <div className={`p-2 rounded-full ${activity.type === 'success' ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}>
                              {activity.type === 'success' ? (
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <FileText className="w-4 h-4 text-blue-400" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{activity.title}</div>
                              <div className="text-sm text-gray-400">{activity.time}</div>
                            </div>
                            {activity.credits && (
                              <div className="text-sm font-medium text-emerald-400">
                                {activity.credits} credits
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              <TabsContent value="jobs" className="space-y-6">
                {/* Active Jobs List */}
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                        <PlayCircle className="w-8 h-8 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-medium mb-2">Detailed Jobs View</h3>
                      <p className="text-gray-400">
                        Manage all your active rendering jobs from here
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-6">
                {/* History View */}
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                        <Calendar className="w-8 h-8 text-purple-400" />
                      </div>
                      <h3 className="text-xl font-medium mb-2">Rendering History</h3>
                      <p className="text-gray-400">
                        View past jobs, downloads, and usage history
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Quick Actions & Network Stats */}
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
                    >
                      <Settings className="w-6 h-6 mb-2" />
                      <span className="text-sm">Settings</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-4 border-white/20 hover:bg-white/5"
                    >
                      <FileText className="w-6 h-6 mb-2" />
                      <span className="text-sm">Reports</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-4 border-white/20 hover:bg-white/5"
                    >
                      <DollarSign className="w-6 h-6 mb-2" />
                      <span className="text-sm">Credits</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Network Status */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    Network Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Active Nodes</span>
                      <span className="font-medium">483</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Availability</span>
                      <span className="font-medium text-emerald-400">99.8%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Avg. Speed</span>
                      <span className="font-medium">12.5x faster</span>
                    </div>
                    <div className="pt-4 border-t border-white/10">
                      <div className="text-sm text-gray-400 mb-2">Global Distribution</div>
                      <div className="flex items-center gap-2">
                        {['US', 'EU', 'ASIA', 'AU'].map((region) => (
                          <div
                            key={region}
                            className="flex-1 text-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            <div className="text-xs font-medium">{region}</div>
                            <div className="text-xs text-gray-400">25%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Credits & Billing */}
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
                    <Button className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700">
                      <DollarSign className="w-5 h-5 mr-2" />
                      Add Credits
                    </Button>
                    <div className="text-sm text-gray-400 text-center">
                      Estimated for ~10 more jobs
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

const stats = [
  { label: 'Active Jobs', value: '3', icon: PlayCircle, trend: '+1 today' },
  { label: 'Completed Today', value: '12', icon: CheckCircle, trend: '+20%' },
  { label: 'Rendering Time Saved', value: '45h', icon: Clock, trend: '+15h' },
  { label: 'Credits Used', value: '245', icon: TrendingUp, trend: '-5%' },
]

const activeJobs = [
  { 
    id: '1', 
    name: 'Character Animation v3', 
    progress: 65, 
    framesCompleted: 130, 
    totalFrames: 200, 
    timeRemaining: '2h 15m',
    started: '3 hours ago',
    nodes: 8
  },
  { 
    id: '2', 
    name: 'Product Visualization', 
    progress: 30, 
    framesCompleted: 45, 
    totalFrames: 150, 
    timeRemaining: '5h 30m',
    started: '1 hour ago',
    nodes: 4
  },
  { 
    id: '3', 
    name: 'Architectural Walkthrough', 
    progress: 85, 
    framesCompleted: 170, 
    totalFrames: 200, 
    timeRemaining: '45m',
    started: '6 hours ago',
    nodes: 12
  },
]

const recentActivity = [
  { id: '1', type: 'success', title: 'Character Animation completed', time: '10 minutes ago', credits: 45 },
  { id: '2', type: 'upload', title: 'Product Visualization uploaded', time: '2 hours ago' },
  { id: '3', type: 'success', title: 'Architectural render finished', time: '5 hours ago', credits: 120 },
  { id: '4', type: 'upload', title: 'New animation sequence submitted', time: 'Yesterday' },
]

export default ClientDashboard