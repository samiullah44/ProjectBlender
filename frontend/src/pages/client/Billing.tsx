import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Lock, 
  Clock, 
  ExternalLink, 
  Search, 
  Filter,
  BarChart3,
  TrendingUp,
  DollarSign,
  ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useRenderNetwork } from '@/hooks/useRenderNetwork'
import { useJobs } from '@/hooks/useJobs'
import { cn } from '@/lib/utils'

const Billing = () => {
  const { creditedAmount, lockedAmount, isRefreshing: networkRefreshing } = useRenderNetwork()
  const { data: jobsData, isLoading: jobsLoading } = useJobs()
  const jobs = jobsData?.jobs || []
  const [activeTab, setActiveTab] = useState<'summary' | 'transactions' | 'analysis'>('summary')
  const [searchTerm, setSearchTerm] = useState('')

  // Dynamically map jobs into transactions
  const transactions = React.useMemo(() => {
      const txs: any[] = []
      
      jobs.forEach(job => {
          if (job.escrow && job.escrow.lockedAmount > 0) {
              // Lock Transaction
              txs.push({
                  id: `${job.jobId}-lock`,
                  type: 'lock',
                  amount: job.escrow.lockedAmount,
                  status: job.escrow.status === 'locked' ? 'locked' : 'completed',
                  date: new Date(job.createdAt).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  }),
                  stamp: new Date(job.createdAt).getTime(),
                  txid: job.escrow.txSignature ? job.escrow.txSignature.substring(0, 10) + '...' : 'pending-sig...'
              })
              
              // Settlement/Release Transaction
              if (job.escrow.paymentStatus === 'settled' || job.escrow.paymentStatus === 'partial') {
                  txs.push({
                      id: `${job.jobId}-release`,
                      type: 'release',
                      amount: job.escrow.releasedAmount > 0 ? job.escrow.releasedAmount : job.escrow.lockedAmount,
                      status: 'completed',
                      date: new Date(job.escrow.settledAt || job.updatedAt).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      }),
                      stamp: new Date(job.escrow.settledAt || job.updatedAt).getTime(),
                      txid: job.escrow.settlementTxSignatures?.[0] ? job.escrow.settlementTxSignatures[0].substring(0, 10) + '...' : 'batch-sig...'
                  })
              }
          }
      })
      
      return txs.sort((a, b) => b.stamp - a.stamp)
  }, [jobs])

  const filteredTxs = transactions.filter(t => t.txid.toLowerCase().includes(searchTerm.toLowerCase()) || t.type.toLowerCase().includes(searchTerm.toLowerCase()))
  const totalExpenditure = jobs.reduce((acc, job) => acc + (job.totalCreditsDistributed || 0), 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'locked': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'pending': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
      case 'withdraw': return <ArrowUpRight className="w-4 h-4 text-red-400" />
      case 'lock': return <Lock className="w-4 h-4 text-amber-400" />
      case 'release': return <ArrowRight className="w-4 h-4 text-blue-400" />
      default: return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 pt-32 pb-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Billing & Wallet</h1>
            <p className="text-gray-400">Manage your credits, view transactions, and analyze spending.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
                onClick={() => window.dispatchEvent(new Event('open-deposit-modal'))}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6"
            >
              Deposit Funds
            </Button>
            <Button 
                onClick={() => window.dispatchEvent(new Event('open-withdraw-modal'))}
                variant="outline" 
                className="border-white/10 hover:bg-white/5 font-bold"
            >
              Withdraw
            </Button>
          </div>
        </div>

        {/* 3-View Navigation */}
        <div className="flex items-center gap-2 p-1.5 bg-gray-900/50 border border-white/5 rounded-2xl w-fit mb-8">
          {[
            { id: 'summary', label: 'Summary', icon: <Wallet className="w-4 h-4" /> },
            { id: 'transactions', label: 'Transactions', icon: <Clock className="w-4 h-4" /> },
            { id: 'analysis', label: 'Analysis', icon: <BarChart3 className="w-4 h-4" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                activeTab === tab.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-8">
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Balance Cards */}
              <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl group hover:border-emerald-500/30 transition-all duration-500 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className="w-24 h-24 text-emerald-400" />
                </div>
                <CardHeader>
                  <CardDescription className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Available Balance</CardDescription>
                  <CardTitle className="text-4xl font-black text-white flex items-baseline gap-2">
                    {networkRefreshing ? '...' : (creditedAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <span className="text-sm font-bold text-emerald-400">mRNDR</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-xs text-gray-500">Ready for immediate job allocation</div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl group hover:border-amber-500/30 transition-all duration-500 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Lock className="w-24 h-24 text-amber-400" />
                </div>
                <CardHeader>
                  <CardDescription className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Locked in Escrow</CardDescription>
                  <CardTitle className="text-4xl font-black text-white flex items-baseline gap-2">
                    {networkRefreshing ? '...' : (lockedAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <span className="text-sm font-bold text-amber-400">mRNDR</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-xs text-gray-500">Committed to active rendering jobs</div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl group hover:border-blue-500/30 transition-all duration-500 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <DollarSign className="w-24 h-24 text-blue-400" />
                </div>
                <CardHeader>
                  <CardDescription className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Total Expenditure</CardDescription>
                  <CardTitle className="text-4xl font-black text-white flex items-baseline gap-2">
                    {jobsLoading ? '...' : totalExpenditure.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <span className="text-sm font-bold text-blue-400">mRNDR</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-xs text-gray-500">Total life-time spend on Rendering</div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'transactions' && (
            <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 mb-4">
                <div>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>On-chain records of your wallet activity.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search TxID or type..." 
                            className="pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 outline-none w-48 text-white"
                        />
                    </div>
                    <Button variant="ghost" size="sm" className="gap-2">
                        <Filter className="w-3.5 h-3.5" />
                        Filter
                    </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-xs uppercase font-extrabold text-gray-500 border-b border-white/5">
                                <th className="pb-4 pt-2">Type</th>
                                <th className="pb-4 pt-2">Amount</th>
                                <th className="pb-4 pt-2">Status</th>
                                <th className="pb-4 pt-2">Date</th>
                                <th className="pb-4 pt-2">Transaction ID</th>
                                <th className="pb-4 pt-2 text-right">View</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {jobsLoading ? (
                                <tr><td colSpan={6} className="py-8 text-center text-gray-500">Scanning cryptographic ledgers...</td></tr>
                            ) : filteredTxs.length === 0 ? (
                                <tr><td colSpan={6} className="py-8 text-center text-gray-500">No transactions recorded securely on-chain yet.</td></tr>
                            ) : filteredTxs.map(tx => (
                                <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                    <td className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shadow-inner ring-1 ring-white/10">
                                                {getTypeIcon(tx.type)}
                                            </div>
                                            <span className="font-bold text-white capitalize tracking-wide">{tx.type}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 font-mono font-bold text-white">
                                        {tx.amount.toFixed(2)} mRNDR
                                    </td>
                                    <td className="py-4">
                                        <Badge className={cn("px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold", getStatusColor(tx.status))}>
                                            {tx.status}
                                        </Badge>
                                    </td>
                                    <td className="py-4 text-gray-400 font-medium text-xs">{tx.date}</td>
                                    <td className="py-4 text-gray-500 font-mono text-xs max-w-[120px] truncate" title={tx.txid}>{tx.txid}</td>
                                    <td className="py-4 text-right">
                                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ExternalLink className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'analysis' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl h-[400px] flex flex-col items-center justify-center p-8 text-center">
                    <BarChart3 className="w-16 h-16 text-gray-700 mb-4 animate-pulse" />
                    <h3 className="text-xl font-bold text-white mb-2">Spending Over Time</h3>
                    <p className="text-gray-500 text-sm">Visual analysis of your compute expenditure will appear here as you render more jobs.</p>
                </Card>
                <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl h-[400px] flex flex-col items-center justify-center p-8 text-center">
                    <TrendingUp className="w-16 h-16 text-gray-700 mb-4 animate-pulse" />
                    <h3 className="text-xl font-bold text-white mb-2">Efficiency Rating</h3>
                    <p className="text-gray-500 text-sm">Our AI analyzes your job configurations to suggest cost-optimizations based on network demand.</p>
                </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Billing
