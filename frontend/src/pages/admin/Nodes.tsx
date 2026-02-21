import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { HardDrive, Search, Filter, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from 'react-hot-toast'
import axiosInstance from '@/lib/axios'
import { websocketService } from '@/services/websocketService'
import { NodeCard } from '@/pages/node/components/NodeCard'

interface Node {
    id: string
    nodeId: string
    name: string
    status: 'online' | 'offline' | 'busy'
    isRevoked?: boolean
    [key: string]: any
}

const AdminNodes: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [nodes, setNodes] = useState<Node[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchNodes = async () => {
        try {
            const res = await axiosInstance.get('/nodes')
            if (res.data && res.data.nodes) {
                // Admins see everything, including revoked nodes if they want, but let's filter revoked out for clean view by default
                // Actually an admin should see revoked nodes to audit them. We will just show all.
                setNodes(res.data.nodes)
            }
        } catch (error) {
            console.error('Fetch nodes error:', error)
            toast.error('Failed to load nodes')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchNodes()

        const interval = setInterval(fetchNodes, 15000)

        const unsubscribeSystem = websocketService.subscribeToSystem((data) => {
            if (data.type === 'node_registered' || data.type === 'node_status_change') {
                fetchNodes()
            }
        })

        return () => {
            clearInterval(interval)
            unsubscribeSystem()
        }
    }, [])

    const handleRevokeNode = async (nodeId: string, nodeName: string) => {
        if (!window.confirm(`[ADMIN] Are you sure you want to completely revoke access for node "${nodeName}"?`)) {
            return
        }

        try {
            const res = await axiosInstance.post('/nodes/revoke', { nodeId, reason: 'Revoked by Admin' })
            if (res.data.success) {
                toast.success('Node revoked successfully')
                fetchNodes()
            }
        } catch (error: any) {
            console.error('Revoke error:', error)
            toast.error(error.response?.data?.error || 'Failed to revoke node')
        }
    }

    if (isLoading && nodes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
                <p className="text-gray-400 animate-pulse">Loading all global nodes...</p>
            </div>
        )
    }

    const filteredNodes = nodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()) || n.nodeId.toLowerCase().includes(searchQuery.toLowerCase()))

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Network Nodes</h1>
                    <p className="text-gray-400">Global overview and management of all connected rendering hardware.</p>
                </div>
            </div>

            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    All Nodes
                    <span className="text-sm font-normal text-gray-500">({nodes.length} Total)</span>
                </h2>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search globally..."
                            className="bg-gray-900 border-gray-800 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-cyan-500/50 outline-none w-64"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {filteredNodes.length > 0 ? filteredNodes.map((node, idx) => (
                    <NodeCard
                        key={node.id || node.nodeId}
                        node={node}
                        idx={idx}
                        revokingNodeId={null}
                        onRevoke={handleRevokeNode}
                    />
                )) : (
                    <div className="lg:col-span-3 text-center py-20 bg-gray-900/20 rounded-2xl border border-dashed border-gray-800">
                        <HardDrive className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                        <h3 className="text-gray-400 font-medium">No nodes found</h3>
                    </div>
                )}
            </div>
        </div>
    )
}

export default AdminNodes
