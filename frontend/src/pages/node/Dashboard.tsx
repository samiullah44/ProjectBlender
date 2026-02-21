import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
    Copy,
    Trash2,
    HardDrive,
    Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import axiosInstance from '@/lib/axios'
import { websocketService } from '@/services/websocketService'
import { NodeCard } from './components/NodeCard'

interface Node {
    id: string
    nodeId: string
    name: string
    status: 'online' | 'offline' | 'busy'
    isRevoked?: boolean
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

    // Token Modal State
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
    const [isGeneratingToken, setIsGeneratingToken] = useState(false)
    const [tokenData, setTokenData] = useState<{ token: string, expiresAt: string, instructions: string } | null>(null)
    const [copied, setCopied] = useState(false)

    // Revoke Confirm State
    const [revokingNodeId, setRevokingNodeId] = useState<string | null>(null)

    const fetchData = async () => {
        try {
            const [nodesRes, statsRes] = await Promise.all([
                axiosInstance.get('/nodes'),
                axiosInstance.get('/nodes/statistics')
            ])

            if (nodesRes.data && nodesRes.data.nodes) {
                // Filter out revoked nodes from the main view
                const activeNodes = nodesRes.data.nodes.filter((n: Node) => !n.isRevoked)
                setNodes(activeNodes)
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

    useEffect(() => {
        fetchData()

        // Simple polling for real-time-ish stats updates
        const interval = setInterval(fetchData, 15000)

        // WebSockets for Real-time push updates for Node Linking
        const unsubscribeSystem = websocketService.subscribeToSystem((data) => {
            if (data.type === 'node_registered') {
                // The backend pushes this when a registration token is consumed!
                toast.success(`🎉 Hardware Node Connected: ${data.nodeName || 'New Node'}`, {
                    id: `node_reg_${data.nodeId}`, // prevents duplicate toasts
                    duration: 6000
                })
                // Auto-refresh the nodes list!
                fetchData()
            }
        })

        return () => {
            clearInterval(interval)
            unsubscribeSystem()
        }
    }, [])

    const handleAddNode = async () => {
        setIsGeneratingToken(true)
        try {
            const res = await axiosInstance.post('/nodes/tokens/generate', { label: 'New Node' })
            if (res.data.success) {
                setTokenData(res.data)
                setIsTokenModalOpen(true)
                setCopied(false)
            }
        } catch (error: any) {
            console.error('Generate token error:', error)
            if (error.response?.data?.error === 'NODE_LIMIT_REACHED') {
                toast.error(error.response.data.message || 'Node limit reached. You can have a maximum of 10 nodes.')
            } else {
                toast.error('Failed to generate registration token. Try again later.')
            }
        } finally {
            setIsGeneratingToken(false)
        }
    }

    const copyToClipboard = () => {
        if (!tokenData) return
        navigator.clipboard.writeText(tokenData.token)
        setCopied(true)
        toast.success('Token copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
    }

    const handleRevokeNode = async (nodeId: string, nodeName: string) => {
        if (!window.confirm(`Are you sure you want to completely revoke access for node "${nodeName}"? It will be disconnected permanently.`)) {
            return
        }

        setRevokingNodeId(nodeId)
        try {
            const res = await axiosInstance.post('/nodes/revoke', { nodeId, reason: 'Revoked by user from dashboard' })
            if (res.data.success) {
                toast.success('Node revoked successfully')
                // Remove from local list instantly
                setNodes(prev => prev.filter(n => n.nodeId !== nodeId))
            }
        } catch (error: any) {
            console.error('Revoke error:', error)
            toast.error(error.response?.data?.error || 'Failed to revoke node')
        } finally {
            setRevokingNodeId(null)
        }
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

    if (isLoading && nodes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                <p className="text-gray-400 animate-pulse">Loading dashboard hardware data...</p>
            </div>
        )
    }

    const filteredNodes = nodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()) || n.nodeId.toLowerCase().includes(searchQuery.toLowerCase()))

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl relative">
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
                        disabled={isGeneratingToken}
                        className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white shadow-xl shadow-purple-500/10 relative overflow-hidden"
                    >
                        {isGeneratingToken ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Plus className="w-5 h-5 mr-2" />}
                        {isGeneratingToken ? 'Generating...' : 'Add New Node'}
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
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
                    <span className="text-sm font-normal text-gray-500">({nodes.length}/10)</span>
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
                {filteredNodes.length > 0 ? filteredNodes.map((node, idx) => (
                    <NodeCard
                        key={node.id || node.nodeId}
                        node={node}
                        idx={idx}
                        revokingNodeId={revokingNodeId}
                        onRevoke={handleRevokeNode}
                    />
                )) : (
                    <>
                        {searchQuery === '' && nodes.length === 0 ? (
                            <div className="lg:col-span-3 text-center py-20 bg-gray-900/20 rounded-2xl border border-dashed border-gray-800">
                                <HardDrive className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <h3 className="text-gray-400 font-medium">No nodes registered yet</h3>
                                <p className="text-gray-600 text-sm mt-1 mb-4">You have 0 nodes out of your 10 limit.</p>
                                <Button
                                    onClick={handleAddNode}
                                    variant="outline"
                                    className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                                >
                                    Register Your First Node
                                </Button>
                            </div>
                        ) : (
                            <div className="lg:col-span-3 text-center py-20 bg-gray-900/20 rounded-2xl border border-dashed border-gray-800">
                                <Search className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <h3 className="text-gray-400 font-medium">No nodes match your filter</h3>
                                <p className="text-gray-600 text-sm mt-1">Try adjusting your search query.</p>
                            </div>
                        )}
                    </>
                )}

                {/* Placeholder Card for Adding */}
                {nodes.length > 0 && nodes.length < 10 && (
                    <motion.button
                        onClick={handleAddNode}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="border-2 border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center p-8 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group min-h-[300px]"
                    >
                        <div className="p-4 rounded-full bg-gray-900 group-hover:bg-purple-500/10 transition-colors mb-4 border border-gray-800 group-hover:border-purple-500/30">
                            <Plus className="w-8 h-8 text-gray-600 group-hover:text-purple-400" />
                        </div>
                        <span className="text-gray-400 font-medium group-hover:text-white transition-colors">Register Additional Hardware</span>
                        <span className="text-xs text-gray-600 mt-2">{10 - nodes.length} slots remaining (Limit 10)</span>
                    </motion.button>
                )}
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

            {/* Custom Token Modal (Since we don't have Dialog component guaranteed in UI folder) */}
            <AnimatePresence>
                {isTokenModalOpen && tokenData && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsTokenModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-gray-900 border border-purple-500/30 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-purple-400" />
                                            Node Registration Token
                                        </h2>
                                        <p className="text-sm text-gray-400 mt-1">
                                            Run this token in your C# Node client to securely pair it with your account.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsTokenModalOpen(false)}
                                        className="text-gray-500 hover:text-white transition-colors"
                                    >
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 mb-4 mt-6">
                                    <div className="flex items-center justify-between">
                                        <code className="text-2xl font-mono text-cyan-400 font-bold tracking-wider">
                                            {tokenData.token}
                                        </code>
                                        <Button
                                            onClick={copyToClipboard}
                                            variant="outline"
                                            className={cn(
                                                "border-gray-800 hover:text-white transition-all",
                                                copied ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" : "bg-gray-900 text-gray-400 hover:bg-gray-800"
                                            )}
                                        >
                                            {copied ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                            {copied ? 'Copied!' : 'Copy'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-400/90 text-xs p-3 rounded-lg mb-6">
                                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                    <p>
                                        This token will expire in 20 minutes (at {new Date(tokenData.expiresAt).toLocaleTimeString()}).
                                        It can only be used <strong>once</strong>. As soon as the node registers, its identity is permanently linked to your account.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-gray-300">Next Steps:</h4>
                                    <ol className="text-sm text-gray-400 space-y-3 list-decimal pl-4">
                                        <li>Download and install the Node CLI software on your hardware.</li>
                                        <li>Run the application (double-click the exe or run <code className="text-gray-300 bg-gray-800 px-1 rounded">dotnet run</code>)</li>
                                        <li>When prompted, paste the token above into the console.</li>
                                        <li>You will be instantly notified here when it comes online.</li>
                                    </ol>
                                </div>
                            </div>

                            <div className="bg-gray-950 px-6 py-4 flex justify-end border-t border-gray-800">
                                <Button
                                    onClick={() => setIsTokenModalOpen(false)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                >
                                    Done
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default NodeDashboard
