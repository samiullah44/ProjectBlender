import React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ShieldAlert, Zap, Cpu, Scale } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const RiskDisclosure = () => {
  const lastUpdated = "April 9, 2026"

  const risks = [
    {
      title: "Smart Contract & Protocol Risk",
      content: "All interactions with the RenderOnNodes protocol are facilitated by decentralized smart contracts. While audited, these contracts may contain unforeseen vulnerabilities that could result in the loss of locked credits (mRNDR)."
    },
    {
      title: "Node Performance & Network Latency",
      content: "Rendering occurs on an distributed network of independent nodes. Performance variability, hardware failure, and network congestion may impact job completion times. RenderOnNodes does not guarantee real-time delivery performance."
    },
    {
      title: "On-Chain Transaction & Gas Fees",
      content: "Users are responsible for all on-chain fees associated with depositing, locking, and releasing funds. The protocol uses batch settlement to mitigate costs, but volatile network conditions may impact settlement speed."
    },
    {
      title: "Data Sovereignty & Hardware Isolation",
      content: "While project assets are encrypted in transit and at rest, rendering requires localized asset execution on external GPU hardware. Users acknowledge the inherent risk of utilizing non-custodial compute resource providers."
    }
  ]

  return (
    <div className="min-h-screen bg-[#050505] pt-32 pb-40 px-4 font-sans leading-relaxed selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20 border-b border-white/5 pb-12">
            <div>
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-amber-500 text-[11px] font-black uppercase tracking-[0.2em] mb-4"
                >
                    <AlertTriangle className="w-4 h-4" />
                    Marketplace Risk Notice
                </motion.div>
                <h1 className="text-5xl font-black text-white tracking-tight mb-4">Risk Disclosure</h1>
                <p className="text-gray-500 text-sm font-medium">As of: {lastUpdated}</p>
            </div>
        </div>

        <div className="prose prose-invert max-w-none mb-20">
            <p className="text-xl text-gray-400 font-medium leading-[1.8]">
              Operating within a decentralized compute marketplace involves unique technical and financial risks. This disclosure outlines the primary risk factors associated with utilizing the RenderOnNodes decentralized infrastructure.
            </p>
        </div>

        <div className="space-y-16">
            {risks.map((risk, idx) => (
                <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative pl-12 group"
                >
                    <div className="absolute left-0 top-0 w-8 h-8 rounded-xl bg-gray-900 border border-white/5 flex items-center justify-center text-xs font-black text-amber-500 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-lg">
                        {idx + 1}
                    </div>
                    <h2 className="text-2xl font-black text-white mb-6 tracking-tight group-hover:text-amber-400 transition-colors">
                        {risk.title}
                    </h2>
                    <div className="text-gray-400 text-[15px] leading-[1.8] font-medium max-w-2xl">
                        {risk.content}
                    </div>
                </motion.div>
            ))}
        </div>

        <div className="mt-32 p-10 rounded-[2.5rem] bg-amber-600/5 border border-amber-500/20 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />
            <div className="relative z-10">
                <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-6" />
                <h3 className="text-2xl font-black text-white mb-4">Invest Wisely. Compute Safely.</h3>
                <p className="text-gray-500 text-sm font-medium mb-0 max-w-md mx-auto">
                    Users are advised to only allocate capital and project data they can afford to lose in the event of platform-level failures or protocol anomalies.
                </p>
            </div>
        </div>
      </div>
    </div>
  )
}

export default RiskDisclosure
