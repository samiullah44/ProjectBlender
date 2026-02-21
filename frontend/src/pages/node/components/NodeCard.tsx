import React from 'react'
import { motion } from 'framer-motion'
import { HardDrive, MoreVertical, Globe, Lock, Trash2, Loader2, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

interface NodeCardProps {
    node: any
    idx: number
    revokingNodeId: string | null
    onRevoke: (nodeId: string, nodeName: string) => void
}

export const NodeCard: React.FC<NodeCardProps> = ({ node, idx, revokingNodeId, onRevoke }) => {
    const navigate = useNavigate()

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'online':
                return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Online</Badge>
            case 'busy':
                return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Rendering</Badge>
            case 'offline':
                return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Offline</Badge>
            default:
                return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">Unknown</Badge>
        }
    }

    const isRevoking = revokingNodeId === node.nodeId

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + idx * 0.05 }}
        >
            <Card
                className={cn(
                    "bg-gray-900/40 border-gray-800 hover:border-purple-500/30 transition-all group relative overflow-hidden cursor-pointer",
                    isRevoking ? "opacity-75" : ""
                )}
                onClick={() => !isRevoking && navigate(window.location.pathname.startsWith('/admin') ? `/admin/nodes/${node.nodeId}` : `/node/nodes/${node.nodeId}`)}
            >
                {isRevoking && (
                    <div className="absolute inset-0 z-10 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
                        <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
                        <span className="text-red-400 font-medium">Revoking Access...</span>
                    </div>
                )}

                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between mb-2">
                        <div className="bg-purple-500/10 p-2 rounded-xl transition-colors group-hover:bg-purple-500/20">
                            <HardDrive className="w-6 h-6 text-purple-400" />
                        </div>
                        <div className="flex items-center gap-2">
                            {getStatusBadge(node.status)}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500/50 hover:text-red-400 hover:bg-red-500/20 transition-colors z-20"
                                onClick={(e) => {
                                    e.stopPropagation() // Prevent card click
                                    onRevoke(node.nodeId, node.name)
                                }}
                                title="Revoke Node Access"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    <CardTitle className="text-lg text-white group-hover:text-purple-400 transition-colors flex items-center justify-between">
                        {node.name}
                        <ArrowRight className="w-4 h-4 text-gray-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </CardTitle>
                    <CardDescription className="text-xs font-mono text-gray-500">
                        {node.nodeId}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500 text-xs mb-1">GPU Info</p>
                            <p className="text-gray-300 font-medium truncate" title={node.hardware?.gpuName}>
                                {node.hardware?.gpuName || 'N/A'}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs mb-1">CPU Info</p>
                            <p className="text-gray-300 font-medium truncate">
                                {node.hardware?.cpuCores ? `${node.hardware.cpuCores} Cores` : 'N/A'}
                            </p>
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
    )
}
