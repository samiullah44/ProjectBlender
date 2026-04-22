// pages/admin/Nodes.tsx — Redesigned with AdminLayout
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HardDrive, Search, Wifi, WifiOff, RefreshCw, Cpu, MemoryStick, Zap, Pause, Play, RotateCcw, ArrowUpCircle, Layers, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from 'react-hot-toast'
import axiosInstance from '@/lib/axios'
import { websocketService } from '@/services/websocketService'
import AdminLayout from '@/components/admin/AdminLayout'

interface Node { id: string; nodeId: string; name: string; status: 'online' | 'offline' | 'busy'; isRevoked?: boolean; gpuModel?: string; cpuCores?: number; ramSize?: number; lastHeartbeat?: string; totalFramesRendered?: number; totalEarnings?: number; [key: string]: any }

const STATUS: Record<string, { dot: string; label: string; badge: string }> = {
    online:  { dot: 'bg-emerald-400 animate-pulse', label: 'Online',  badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    busy:    { dot: 'bg-blue-400 animate-pulse',    label: 'Busy',    badge: 'text-blue-400   bg-blue-500/10   border-blue-500/20'   },
    offline: { dot: 'bg-gray-500',                  label: 'Offline', badge: 'text-gray-400   bg-gray-500/10   border-gray-500/20'   },
}

function formatTimeAgo(dateString: string) {
    const diff = Date.now() - new Date(dateString).getTime()
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

const AdminNodes: React.FC = () => {
    const navigate = useNavigate();
    const [nodes, setNodes]         = useState<Node[]>([])
    const [search, setSearch]       = useState('')
    const [loading, setLoading]     = useState(true)
    const [statusFilter, setFilter] = useState<'all' | 'online' | 'busy' | 'offline'>('all')

    const fetchNodes = async () => {
        try {
            const res = await axiosInstance.get('/nodes?adminView=true')
            if (res.data?.nodes) setNodes(res.data.nodes)
        } catch { toast.error('Failed to load nodes') }
        finally { setLoading(false) }
    }

    useEffect(() => {
        fetchNodes()
        const iv = setInterval(fetchNodes, 15000)
        const unsub = websocketService.subscribeToSystem(d => {
            if (['node_registered','node_status_change','node_ws_connected','node_ws_disconnected'].includes(d.type)) fetchNodes()
        })
        return () => { clearInterval(iv); unsub() }
    }, [])

    const handleRevoke = async (nodeId: string, name: string) => {
        if (!window.confirm(`Revoke node "${name}"? This cannot be undone.`)) return
        try {
            const res = await axiosInstance.post('/nodes/revoke', { nodeId, reason: 'Revoked by Admin' })
            if (res.data.success) { toast.success('Node revoked'); fetchNodes() }
        } catch { toast.error('Failed to revoke') }
    }

    const handleNodeCommand = (nodeId: string, cmd: string) => {
        websocketService.sendCommand(nodeId, cmd)
    }

    const filtered = nodes.filter(n => {
        const matchSearch = n.name?.toLowerCase().includes(search.toLowerCase()) || n.nodeId?.toLowerCase().includes(search.toLowerCase())
        const matchStatus = statusFilter === 'all' || n.status === statusFilter
        return matchSearch && matchStatus
    })

    const counts = {
        all: nodes.length,
        online: nodes.filter(n => n.status === 'online').length,
        busy:   nodes.filter(n => n.status === 'busy').length,
        offline:nodes.filter(n => n.status === 'offline').length,
    }

    const headerActions = (
        <div className="flex items-center gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search nodes…"
                    className="bg-[#111118] border border-white/[0.07] text-white text-sm rounded-xl pl-9 pr-3 py-2 w-48 focus:outline-none focus:border-white/20" />
            </div>
            <Button variant="outline" size="sm" onClick={fetchNodes} className="border-white/15 hover:bg-white/5 text-gray-300">
                <RefreshCw className="w-3.5 h-3.5" />
            </Button>
        </div>
    )

    return (
        <AdminLayout title="Network Nodes" subtitle="Live view of all connected rendering hardware" actions={headerActions}>
            <div className="space-y-5 mt-4">
                {/* Network health strip */}
                <div className="grid grid-cols-4 gap-3">
                    {(['all','online','busy','offline'] as const).map(s => {
                        const st = s !== 'all' ? STATUS[s] : null
                        return (
                            <button key={s} onClick={() => setFilter(s)}
                                className={`p-4 rounded-2xl border transition-all text-left ${statusFilter === s ? 'border-white/20 bg-white/[0.06]' : 'border-white/[0.07] bg-[#111118] hover:bg-white/[0.03]'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    {st && <span className={`w-2 h-2 rounded-full ${st.dot}`} />}
                                    <p className="text-xs text-gray-400 capitalize">{s === 'all' ? 'All Nodes' : st?.label}</p>
                                </div>
                                <p className="text-2xl font-bold text-white">{counts[s]}</p>
                            </button>
                        )
                    })}
                </div>

                {/* Node cards grid */}
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map((node, i) => {
                            const st = STATUS[node.status] || STATUS.offline
                            const lastSeen = node.lastHeartbeat
                                ? formatTimeAgo(node.lastHeartbeat)
                                : 'Never'
                            return (
                                <motion.div key={node.nodeId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                    onClick={() => navigate(`/admin/nodes/${node.nodeId}`)}
                                    className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5 cursor-pointer hover:border-purple-500/40 transition-all shadow-xl group relative overflow-hidden">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-2 rounded-xl ${node.status === 'online' ? 'bg-emerald-500/15' : node.status === 'busy' ? 'bg-blue-500/15' : 'bg-gray-500/10'}`}>
                                                <HardDrive className={`w-4 h-4 ${node.status === 'online' ? 'text-emerald-400' : node.status === 'busy' ? 'text-blue-400' : 'text-gray-500'}`} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white/90">{node.name || node.nodeId?.slice(0, 14) + '…'}</p>
                                                <p className="text-[10px] text-gray-500 font-mono">{node.nodeId?.slice(0, 16)}…</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${st.badge}`}>
                                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${st.dot}`} />
                                            {st.label}
                                        </span>
                                    </div>

                                    {/* Hardware info */}
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {[
                                            { icon: Cpu,         label: 'GPU',    value: node.hardware?.gpuName?.slice(0, 20) || '—' },
                                            { icon: MemoryStick, label: 'RAM',    value: node.hardware?.ramGB ? `${node.hardware.ramGB} GB` : '—' },
                                            { icon: Zap,         label: 'Frames', value: (node.performance?.framesRendered || 0).toLocaleString() },
                                            { icon: Layers,      label: 'Jobs',   value: (node.jobsCompleted || 0).toLocaleString() },
                                            { icon: CreditCard,  label: 'Earned', value: `${(node.performance?.earnings || 0).toFixed(2)}` },
                                            { icon: node.status !== 'offline' ? Wifi : WifiOff, label: 'Seen', value: lastSeen },
                                        ].map(({ icon: Icon, label, value }) => (
                                            <div key={label} className="bg-white/[0.04] rounded-xl p-2.5">
                                                <p className="flex items-center gap-1 text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">
                                                    <Icon className="w-3 h-3" />{label}
                                                </p>
                                                <p className="text-xs text-white/80 font-medium truncate">{value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2">
                                        {!node.isRevoked ? (
                                            <>
                                                <div className="flex gap-2">
                                                    {node.status !== 'offline' && (
                                                        node.status === 'busy' || node.status === 'online' ? (
                                                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleNodeCommand(node.nodeId, 'pause'); }}
                                                                title="Suspend node from accepting more jobs"
                                                                className="flex-1 h-8 text-[10px] border-amber-500/20 text-amber-400 hover:bg-amber-500/10">
                                                                <Pause className="w-3 h-3 mr-1" /> Pause
                                                            </Button>
                                                        ) : (
                                                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleNodeCommand(node.nodeId, 'resume'); }}
                                                                title="Allow node to start accepting jobs again"
                                                                className="flex-1 h-8 text-[10px] border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10">
                                                                <Play className="w-3 h-3 mr-1" /> Resume
                                                            </Button>
                                                        )
                                                    )}
                                                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleNodeCommand(node.nodeId, 'update'); }}
                                                        title="Force node to update its client software"
                                                        className="flex-1 h-8 text-[10px] border-blue-500/20 text-blue-400 hover:bg-blue-500/10">
                                                        <ArrowUpCircle className="w-3 h-3 mr-1" /> Update
                                                    </Button>
                                                </div>
                                                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleRevoke(node.nodeId, node.name); }}
                                                    className="w-full h-8 text-[10px] border-red-500/25 text-red-400 hover:bg-red-500/10">
                                                    Revoke Node
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="w-full h-8 flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20">
                                                <p className="text-xs text-red-400 font-semibold">Revoked</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )
                        })}
                        {filtered.length === 0 && (
                            <div className="col-span-3 flex flex-col items-center justify-center py-20 text-gray-500">
                                <HardDrive className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm">No nodes found</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}

export default AdminNodes
