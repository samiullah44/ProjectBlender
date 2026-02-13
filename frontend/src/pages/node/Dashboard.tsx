import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Cpu,
    Zap,
    Activity,
    DollarSign,
    Plus,
    CheckCircle2,
    XCircle,
    Info,
    Download,
    ArrowUpRight,
    Search,
    Filter,
    MoreVertical,
    Settings,
    HardDrive,
    Globe,
    Lock,
    Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import axiosInstance from '@/lib/axios'

interface Node {
    id: string
    nodeId: string
    name: string
    status: 'online' | 'offline' | 'busy'
    hardware?: {
        gpuName?: string
        cpuCores?: number
        ramGB?: number
    }
    performance?: {
        framesRendered: number
        totalRenderTime: number
        avgFrameTime: number
        earnings?: number
    }
    lastHeartbeat?: string
}

const NodeDashboard: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [nodes, setNodes] = useState<Node[]>([])
    const [stats, setStats] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [nodesRes, statsRes] = await Promise.all([
                    axiosInstance.get('/nodes'),
                    axiosInstance.get('/nodes/statistics')
                ])

                if (nodesRes.data.success) {
                    setNodes(nodesRes.data.nodes || [])
                }

                if (statsRes.data) {
                    const s = [
                        {
                            label: 'Total Earnings',
                            value: statsRes.data.performance?.totalEarnings?.toFixed(2) || '0.00',
                            unit: 'credits',
                            icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
                            trend: 'Real-time',
                            trendUp: true
                        },
                        {
                            label: 'Active Nodes',
                            value: statsRes.data.byStatus?.online?.toString() || '0',
                            unit: 'online',
                            icon: <Activity className="w-5 h-5 text-purple-400" />,
                            trend: `${statsRes.data.total || 0} total`,
                            trendUp: true
                        },
                        {
                            label: 'Avg Frame Time',
                            value: statsRes.data.performance?.avgFrameTime || '0.00',
                            unit: 's',
                            icon: <Zap className="w-5 h-5 text-amber-400" />,
                            trend: 'Network avg',
                            trendUp: true
                        },
                        {
                            label: 'Total Rendered',
                            value: statsRes.data.performance?.totalJobsCompleted?.toLocaleString() || '0',
                            unit: 'jobs',
                            icon: <Cpu className="w-5 h-5 text-cyan-400" />,
                            trend: 'Historical',
                            trendUp: true
                        }
                    ]
                    setStats(s)
                }
            } catch (error) {
                console.error('Fetch dashboard data error:', error)
                toast.error('Failed to load dashboard data')
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [])

    const handleAddNode = () => {
        toast.success('Node registration wizard coming soon!')
    }

    const getStatusBadge = (status: Node['status']) => {
        switch (status) {
            case 'online':
                return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Online</Badge>
            case 'busy':
                return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Rendering</Badge>
            case 'offline':
                return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Offline</Badge>
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                <p className="text-gray-400 animate-pulse">Loading dashboard hardware data...</p>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        Provider Dashboard
                        <Badge variant="outline" className="text-purple-400 border-purple-500/30">Node Provider</Badge>
                    </h1>
                    <p className="text-gray-400">Manage your distributed rendering hardware and track earnings.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="text-purple-400 border-purple-500/30 hover:bg-cyan-500/10 hidden md:flex items-center"
                        onClick={() => toast.success('Beginning software download...')}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download Node Software
                        <span title="Download our dedicated rendering software to start contributing your local hardware.">
                            <Info className="w-3.5 h-3.5 ml-2 opacity-50 cursor-help" />
                        </span>
                    </Button>
                    <Button variant="outline" className="border-gray-800 hover:bg-white/5 text-gray-300">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                    </Button>
                    <Button
                        onClick={handleAddNode}
                        className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white shadow-xl shadow-purple-500/10"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Add New Node
                    </Button>
                </div>
            </div>

            {/* Stats Grid - Only show if stats exist */}
            {stats && stats.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    {stats.map((stat, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            <Card className="bg-gray-900/40 border-gray-800 backdrop-blur-sm hover:border-white/10 transition-colors">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-400">
                                        {stat.label}
                                    </CardTitle>
                                    <div className="p-2 rounded-lg bg-gray-800/50">
                                        {stat.icon}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-white">
                                        {stat.value}
                                        <span className="text-sm font-normal text-gray-500 ml-1.5">{stat.unit}</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className={cn(
                                            "text-xs font-medium",
                                            stat.trendUp ? "text-emerald-400" : "text-amber-400"
                                        )}>
                                            {stat.trend}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Nodes Section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    Registered Nodes
                    <span className="text-sm font-normal text-gray-500">({nodes.length})</span>
                </h2>
                {nodes.length > 0 && (
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Filter nodes..."
                                className="bg-gray-900 border-gray-800 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-purple-500/50 outline-none w-64"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="sm" className="border-gray-800 text-gray-400">
                            <Filter className="w-4 h-4 mr-2" />
                            Filter
                        </Button>
                    </div>
                )}
            </div>

            {/* Nodes Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {nodes.length > 0 ? nodes.map((node, idx) => (
                    <motion.div
                        key={node.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + idx * 0.05 }}
                    >
                        <Card className="bg-gray-900/40 border-gray-800 hover:border-purple-500/30 transition-all group">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="bg-purple-500/10 p-2 rounded-xl">
                                        <HardDrive className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(node.status)}
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 group-hover:text-white">
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <CardTitle className="text-lg text-white group-hover:text-purple-400 transition-colors">
                                    {node.name}
                                </CardTitle>
                                <CardDescription className="text-xs font-mono text-gray-500">
                                    {node.nodeId}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-500 text-xs mb-1">GPU Info</p>
                                        <p className="text-gray-300 font-medium truncate">{node.hardware?.gpuName || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs mb-1">CPU Info</p>
                                        <p className="text-gray-300 font-medium truncate">{node.hardware?.cpuCores ? `${node.hardware.cpuCores} Cores` : 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs mb-1">Earnings</p>
                                        <p className="text-emerald-400 font-semibold">{node.performance?.earnings?.toFixed(2) || '0.00'} CR</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs mb-1">Last seen</p>
                                        <p className="text-gray-300 font-medium">
                                            {node.lastHeartbeat ? new Date(node.lastHeartbeat).toLocaleTimeString() : 'Never'}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <div className="flex items-center justify-between text-xs mb-2">
                                        <span className="text-gray-500">Utilization</span>
                                        <span className="text-emerald-400 font-medium">
                                            {node.status === 'busy' ? '100%' : '0%'}
                                        </span>
                                    </div>
                                    <Progress value={node.status === 'busy' ? 100 : 0} className="h-1.5 bg-gray-800" indicatorClassName={cn(
                                        node.status === 'busy' ? "bg-purple-500" : "bg-emerald-500"
                                    )} />
                                </div>

                                <div className="flex items-center gap-4 pt-2">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <Globe className="w-3.5 h-3.5" />
                                        Remote Node
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <Lock className="w-3.5 h-3.5" />
                                        Encrypted
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )) : (
                    <div className="lg:col-span-3 text-center py-20 bg-gray-900/20 rounded-2xl border border-dashed border-gray-800">
                        <HardDrive className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                        <h3 className="text-gray-400 font-medium">No nodes registered yet</h3>
                        <p className="text-gray-600 text-sm mt-1">Connect your hardware to start earning credits.</p>
                    </div>
                )}

                {/* Placeholder Card for Adding */}
                <motion.button
                    onClick={handleAddNode}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="border-2 border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center p-8 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group min-h-[300px]"
                >
                    <div className="p-4 rounded-full bg-gray-900 group-hover:bg-purple-500/10 transition-colors mb-4 border border-gray-800 group-hover:border-purple-500/30">
                        <Plus className="w-8 h-8 text-gray-600 group-hover:text-purple-400" />
                    </div>
                    <span className="text-gray-400 font-medium group-hover:text-white transition-colors">Register New Hardware</span>
                    <span className="text-xs text-gray-600 mt-2">Maximum 10 nodes per provider</span>
                </motion.button>
            </div>

            {/* Notification / Info Footer */}
            <div className="mt-12 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10 flex items-start gap-3">
                <Info className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                <div>
                    <h4 className="text-sm font-semibold text-cyan-400">Automated Payouts</h4>
                    <p className="text-xs text-gray-400 leading-relaxed mt-1">
                        Earnings are calculated per frame and credited to your balance instantly.
                        A service fee of 5% is applied to all provider earnings to maintain the network infrastructure.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default NodeDashboard
