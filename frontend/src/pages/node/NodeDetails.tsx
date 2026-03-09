import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    HardDrive,
    Activity,
    Cpu,
    Monitor,
    Clock,
    Zap,
    Network,
    AlertCircle,
    CheckCircle2,
    XCircle,
    ServerCrash,
    History,
    RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { toast } from 'react-hot-toast'
import axiosInstance from '@/lib/axios'
import { websocketService } from '@/services/websocketService'
import { cn } from '@/lib/utils'

export const NodeDetails: React.FC = () => {
    const { nodeId } = useParams<{ nodeId: string }>()
    const navigate = useNavigate()
    const [node, setNode] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const fetchNode = async (showRefresh = false) => {
        if (showRefresh) setIsRefreshing(true)
        try {
            const res = await axiosInstance.get(`/nodes/${nodeId}`)
            if (res.data.success && res.data.node) {
                setNode(res.data.node)
            } else {
                toast.error('Could not load node details')
            }
        } catch (error) {
            console.error('Fetch node error:', error)
            toast.error('Error fetching node details')
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }

    useEffect(() => {
        fetchNode()

        const interval = setInterval(() => fetchNode(), 15000)

        // Subscribe to system events for instant updates (like node going offline/online)
        const unsubscribeSystem = websocketService.subscribeToSystem((data) => {
            if (data.type === 'node_status_change' && data.nodeId === nodeId) {
                fetchNode()
            }
        })

        return () => {
            clearInterval(interval)
            unsubscribeSystem()
        }
    }, [nodeId])

    if (isLoading && !node) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <RefreshCw className="w-10 h-10 text-purple-500 animate-spin" />
                <p className="text-gray-400 animate-pulse">Loading detailed telemetry...</p>
            </div>
        )
    }

    if (!node) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <ServerCrash className="w-12 h-12 text-red-500" />
                <h2 className="text-xl text-white font-semibold">Node Not Found</h2>
                <p className="text-gray-400">The hardware node you requested does not exist or was permanently revoked.</p>
                <Button variant="outline" onClick={() => navigate('/node/dashboard')}>
                    Return to Dashboard
                </Button>
            </div>
        )
    }

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'online':
                return { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle2 className="w-4 h-4" />, text: 'Online & Ready' }
            case 'busy':
                return { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: <Activity className="w-4 h-4" />, text: 'Rendering Currently' }
            case 'offline':
                return { badge: 'bg-red-500/10 text-red-400 border-red-500/20', icon: <XCircle className="w-4 h-4" />, text: 'Offline' }
            default:
                return { badge: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: <AlertCircle className="w-4 h-4" />, text: 'Unknown' }
        }
    }

    const sConf = getStatusConfig(node.status)
    const isRevoked = node.isRevoked

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/node/dashboard')}
                        className="text-gray-400 hover:text-white hover:bg-gray-800 p-2"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                {node.name}
                            </h1>
                            {isRevoked ? (
                                <Badge className="bg-red-500 text-white border-transparent">Revoked</Badge>
                            ) : (
                                <Badge className={cn("flex items-center gap-1.5 px-2.5 py-1", sConf.badge)}>
                                    {sConf.icon}
                                    {sConf.text}
                                </Badge>
                            )}
                        </div>
                        <p className="text-gray-500 font-mono text-sm max-w-md truncate">ID: {node.nodeId}</p>
                    </div>
                </div>

                {!isRevoked && (
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-gray-300 border-gray-800 hover:bg-gray-800"
                            onClick={() => fetchNode(true)}
                        >
                            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                            Refresh Telemetry
                        </Button>
                    </div>
                )}
            </div>

            {isRevoked && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-semibold text-red-500">Node Revoked</h4>
                        <p className="text-sm text-red-400/90 mt-1">
                            This node was permanently disconnected on {new Date(node.revokedAt).toLocaleString()}.
                            Reason: {node.revokedReason || "Revoked from dashboard."}. It can no longer accept jobs or connect to the network.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Quick Stats */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-gray-900/40 border-gray-800">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Activity className="w-5 h-5 text-cyan-400" />
                                Current Telemetry
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-400">Node CPU Usage</span>
                                    <span className="text-white font-medium">{node.lastResources?.cpuUsage ?? 0}%</span>
                                </div>
                                <Progress value={node.lastResources?.cpuUsage ?? 0} className="h-2 bg-gray-800" indicatorClassName="bg-cyan-500" />
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-400">Node RAM Usage</span>
                                    <span className="text-white font-medium">{node.lastResources?.ramUsage ?? 0}%</span>
                                </div>
                                <Progress value={node.lastResources?.ramUsage ?? 0} className="h-2 bg-gray-800" indicatorClassName="bg-purple-500" />
                            </div>

                            {node.lastResources?.gpuUsage !== undefined && (
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-400">GPU VRAM Usage</span>
                                        <span className="text-white font-medium">{node.lastResources?.vramUsage ?? 0}%</span>
                                    </div>
                                    <Progress value={node.lastResources?.vramUsage ?? 0} className="h-2 bg-gray-800" indicatorClassName="bg-emerald-500" />
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-800/50">
                                <p className="text-sm text-gray-500 flex items-center justify-between">
                                    <span>Added to Network</span>
                                    <span className="text-gray-300">{new Date(node.createdAt).toLocaleDateString()}</span>
                                </p>
                                <p className="text-sm text-gray-500 flex items-center justify-between mt-2">
                                    <span>Last Heartbeat</span>
                                    <span className="text-gray-300">{new Date(node.lastHeartbeat).toLocaleTimeString()}</span>
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-900/40 border-gray-800 flex flex-col items-center p-6 text-center">
                        <div className="p-3 bg-emerald-500/10 rounded-full mb-3">
                            <Zap className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h3 className="text-3xl font-bold text-white">{node.performance?.framesRendered || 0}</h3>
                        <p className="text-sm text-gray-400 mt-1">Total Frames Rendered</p>

                        <div className="w-full h-px bg-gray-800 my-4" />

                        <h3 className="text-2xl font-bold text-emerald-400">{node.performance?.earnings?.toFixed(2) || '0.00'} CR</h3>
                        <p className="text-xs text-gray-500 mt-1">Total Gross Earnings</p>
                    </Card>
                </div>

                {/* Right Column: Deep Specs & Job Info */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Hardware Card */}
                    <Card className="bg-gray-900/40 border-gray-800">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Cpu className="w-5 h-5 text-purple-400" />
                                Hardware Specifications
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> Processor (CPU)</p>
                                        <p className="text-sm text-gray-200 font-medium">{node.hardware?.cpuModel || 'Not Reported'}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{node.hardware?.cpuCores} Cores @ {node.hardware?.cpuSpeedGHz}GHz</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Memory (RAM)</p>
                                        <p className="text-sm text-gray-200 font-medium">{node.hardware?.ramGB} GB Total</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{node.hardware?.ramAvailableGB} GB Currently Available</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Graphics (GPU)</p>
                                        <p className="text-sm text-gray-200 font-medium">{node.hardware?.gpuName || 'No Dedicated GPU'}</p>
                                        {node.hardware?.gpuVRAM && <p className="text-xs text-gray-400 mt-0.5">{node.hardware?.gpuVRAM} MB VRAM</p>}
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5"><Network className="w-3.5 h-3.5" /> Network capabilities</p>
                                        <p className="text-sm text-gray-200">OS: {node.os}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Blender v{node.hardware?.blenderVersion || 'Unknown'}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Rendering Engine Capabilities */}
                    <Card className="bg-gray-900/40 border-gray-800">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Engine Capabilities</CardTitle>
                            <CardDescription>What this hardware is authorized to render</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {node.capabilities?.supportedEngines?.map((eng: string) => (
                                    <Badge key={eng} variant="outline" className="border-purple-500/30 text-purple-400">{eng}</Badge>
                                )) || <p className="text-gray-500 text-sm">No engines specified</p>}
                                {node.capabilities?.supportedGPUs?.map((gpuType: string) => (
                                    <Badge key={gpuType} variant="outline" className="border-cyan-500/30 text-cyan-400">{gpuType}</Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Current Job Status */}
                    {node.status === 'busy' && node.currentJob && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <Card className="bg-purple-900/10 border-purple-500/30">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-purple-400 flex items-center gap-2">
                                        <Activity className="w-4 h-4" />
                                        Active Render Assignment
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between items-end mb-2">
                                        <div>
                                            <p className="text-white text-lg font-medium">Job {typeof node.currentJob === 'string' ? node.currentJob.substring(0, 8) : node.currentJob?.jobId?.substring(0, 8)}...</p>
                                            <p className="text-gray-400 text-sm">Rendering Frame</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-2xl font-bold text-white">{node.currentProgress || 0}%</span>
                                        </div>
                                    </div>
                                    <Progress value={node.currentProgress || 0} className="h-3 bg-gray-950" indicatorClassName="bg-purple-500" />
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                </div>
            </div>
        </div>
    )
}

export default NodeDetails
