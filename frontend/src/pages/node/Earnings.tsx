import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight, 
  Calendar,
  Filter,
  Server,
  Activity,
  ChevronRight,
  Wallet,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { axiosInstance } from '@/lib/axios'

const Earnings = () => {
  const [timeFilter, setTimeFilter] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [jobEarnings, setJobEarnings] = useState<any[]>([])

  React.useEffect(() => {
    const fetchEarningsData = async () => {
        try {
            // 1. Fetch cross-node statistics (Totals)
            const statsRes = await axiosInstance.get('/nodes/statistics')
            setStats(statsRes.data)
            
            // 2. Fetch all nodes to get their IDs
            const nodesRes = await axiosInstance.get('/nodes')
            const nodes = nodesRes.data.nodes || []
            
            // 3. Fetch history for each node
            const historyPromises = nodes.map((n: any) => axiosInstance.get(`/nodes/${n.nodeId}/history`))
            const historyResponses = await Promise.all(historyPromises)
            
            // 4. Combine and flatten granular job data
            const combinedJobs = historyResponses.flatMap(res => res.data.history || [])
            
            // 5. Aggregate by Job ID (since multiple nodes might work on the same job)
            const jobMap = new Map()
            combinedJobs.forEach(job => {
                if (jobMap.has(job.jobId)) {
                    const existing = jobMap.get(job.jobId)
                    existing.nodeContribution.creditsEarned += job.nodeContribution.creditsEarned
                    existing.nodeContribution.totalFramesInvolved += job.nodeContribution.totalFramesInvolved
                } else {
                    // Deep copy to avoid mutating the original
                    jobMap.set(job.jobId, JSON.parse(JSON.stringify(job)))
                }
            })
            
            const uniqueJobEarnings = Array.from(jobMap.values())
            
            // Sort by date (newest first)
            uniqueJobEarnings.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            setJobEarnings(uniqueJobEarnings)
        } catch (error) {
            console.error("Failed to load earnings data:", error)
        } finally {
            setIsLoading(false)
        }
    }
    fetchEarningsData()
  }, [])

  // Filter jobs by the selected time window
  const filteredJobs = React.useMemo(() => {
    if (!jobEarnings.length) return []
    const now = Date.now()
    const windowMs = {
      daily:   1 * 24 * 60 * 60 * 1000,
      weekly:  7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    }[timeFilter]
    return jobEarnings.filter((job: any) => {
      const jobTime = new Date(job.createdAt).getTime()
      return now - jobTime <= windowMs
    })
  }, [jobEarnings, timeFilter])

  // Totals derived from the filtered & visible data — always accurate to the table
  const totalSettled = React.useMemo(
    () => filteredJobs
      .filter((j: any) => j.status === 'completed')
      .reduce((acc: number, j: any) => acc + (j.nodeContribution?.creditsEarned ?? 0), 0),
    [filteredJobs]
  )

  const totalPending = React.useMemo(
    () => filteredJobs
      .filter((j: any) => j.status === 'rendering')
      .reduce((acc: number, j: any) => acc + (j.nodeContribution?.creditsEarned ?? 0), 0),
    [filteredJobs]
  )

  const activeNodes = stats?.byStatus?.busy || 0

  return (
    <div className="min-h-screen bg-[#030712] pt-32 pb-20 px-4 font-sans selection:bg-purple-500/30">
      <div className="max-w-6xl mx-auto">
        
        {/* Web3 Identity Header */}
        <div className="relative mb-12 p-8 rounded-[2rem] bg-gradient-to-br from-purple-600/10 via-transparent to-emerald-600/10 border border-white/5 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse" />
            
            <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8 relative z-10">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-gray-900 border border-white/10 flex items-center justify-center text-white shadow-2xl ring-1 ring-white/5 overflow-hidden">
                            <Wallet className="w-8 h-8 text-purple-500 opacity-80" />
                            <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/20 to-transparent" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-purple-400 text-[10px] font-black uppercase tracking-widest mb-1">
                            <Activity className="w-3 h-3" />
                            Provider Revenue
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2">Earnings Registry</h1>
                        <p className="text-gray-500 font-medium text-sm">Cryptographic on-chain settlement details.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/5 rounded-2xl ring-1 ring-white/5">
                    {(['daily', 'weekly', 'monthly'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setTimeFilter(f)}
                            className={cn(
                                "px-5 py-2 rounded-xl text-xs font-black transition-all capitalize tracking-wider",
                                timeFilter === f ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "text-gray-500 hover:text-white hover:bg-white/5"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl hover:border-emerald-500/20 transition-all rounded-[2rem] overflow-hidden group">
            <CardContent className="p-8 relative">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2 relative z-10">Total Settled</div>
                <div className="flex items-baseline gap-2 relative z-10">
                    <span className="text-4xl font-black text-white">{totalSettled.toFixed(2)}</span>
                    <span className="text-emerald-400 text-xs font-bold font-mono">mRNDR</span>
                </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl hover:border-amber-500/20 transition-all border-l-4 border-l-amber-500/50 rounded-[2rem] overflow-hidden group">
            <CardContent className="p-8 relative">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
                <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2 relative z-10">Pending Release</div>
                <div className="flex items-baseline gap-2 relative z-10">
                    <span className="text-4xl font-black text-white">{totalPending.toFixed(2)}</span>
                    <span className="text-amber-400 text-xs font-bold font-mono">mRNDR</span>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-widest relative z-10">
                    <Clock className="w-3 h-3 text-amber-500" />
                    Next Batch: ~4h
                </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl hover:border-blue-500/20 transition-all rounded-[2rem] overflow-hidden group">
            <CardContent className="p-8 relative">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2 relative z-10">Uptime Score</div>
                <div className="flex items-baseline gap-2 relative z-10">
                    <span className="text-4xl font-black text-white">99.8</span>
                    <span className="text-blue-400 text-xs font-bold font-mono">%</span>
                </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl hover:border-purple-500/20 transition-all rounded-[2rem] overflow-hidden group">
            <CardContent className="p-8 relative">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
                <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2 relative z-10">Active Nodes</div>
                <div className="flex items-baseline gap-2 relative z-10">
                    <span className="text-4xl font-black text-white">{activeNodes}</span>
                    <span className="text-purple-400 text-xs font-bold uppercase tracking-wider">Nodes</span>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown Table */}
        <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <CardContent className="p-0">
                <div className="p-8 border-b border-white/5">
                    <h2 className="text-2xl font-black text-white tracking-tight">Job Transactions</h2>
                    <p className="text-sm font-medium text-gray-500 mt-1">Granular transparency for every frame rendered.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] uppercase font-black text-gray-600 border-b border-white/5 bg-black/20 tracking-widest">
                                <th className="px-8 py-5">Job Name</th>
                                <th className="px-8 py-5">Frames</th>
                                <th className="px-8 py-5">Render Time</th>
                                <th className="px-8 py-5">Earnings</th>
                                <th className="px-8 py-5">Status</th>
                                <th className="px-8 py-5 text-right">Date</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-12 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-500" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Querying Blockchain Nodes...</span>
                                    </td>
                                </tr>
                            ) : filteredJobs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-12 text-center text-gray-500">
                                        <span className="text-xs font-bold uppercase tracking-widest">No settlements in this time window</span>
                                    </td>
                                </tr>
                            ) : filteredJobs.map((job: any) => (
                                <tr key={job.jobId} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
                                                <Server className="w-4 h-4" />
                                            </div>
                                            <span className="font-bold text-white tracking-tight">{job.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 inline-flex text-gray-400 font-mono text-xs shadow-inner">
                                            {job.nodeContribution.totalFramesInvolved} <span className="text-gray-600 ml-1">/ {job.totalJobFrames}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-gray-400 font-mono text-xs">--</td>
                                    <td className="px-8 py-6">
                                        <div className="font-black text-white flex items-center gap-1.5">
                                            {job.nodeContribution.creditsEarned.toFixed(2)}
                                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">mRNDR</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <Badge className={cn(
                                            "uppercase tracking-widest px-3 py-1.5 text-[9px] font-black rounded-lg border",
                                            job.status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                        )}>
                                            {job.status}
                                        </Badge>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="text-gray-500 text-xs font-medium bg-black/40 border border-white/5 inline-flex px-3 py-1.5 rounded-lg whitespace-nowrap">
                                            {new Date(job.createdAt).toLocaleString(undefined, {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>

        {/* Batch Release Info */}
        <div className="mt-12 p-8 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/20 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-20" />
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-inner">
                <Clock className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
                <h4 className="text-white font-black tracking-tight mb-2 text-lg">Cryptographic Batch Settlement</h4>
                <p className="text-sm font-medium text-gray-400 leading-relaxed max-w-3xl">
                    RenderOnNodes utilizes a Layer-2 batch-settlement protocol to minimize on-chain execution costs. Earnings remain in an isolated escrow state ('Pending') until the 24-hour network cycle finalizes, systematically transferring value to your derived identity wallet.
                </p>
            </div>
        </div>
      </div>
    </div>
  )
}

export default Earnings
