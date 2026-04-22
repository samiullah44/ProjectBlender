import React from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, Wallet, Clock, ShieldCheck, Scale } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const RefundPolicy = () => {
  const lastUpdated = "April 9, 2026"

  const tiers = [
    {
      title: "Full Refund (Pre-Processing)",
      content: "100% of the locked escrow amount is returnable if the job is cancelled before any frames are assigned to a compute node. On-chain gas fees are non-refundable."
    },
    {
      title: "Partial Refund (Mid-Process)",
      content: "If a job is cancelled during execution, the Client is only charged for the percentage of frames successfully rendered and verified. The remaining balance in the Escrow PDA is released back to the Client's Credit PDA."
    },
    {
      title: "No Refund (Post-Completion)",
      content: "Once a job is declared 'Finished' and the node has successfully delivered all frames to the destination bucket, the escrow release is irreversible and no refunds can be processed."
    },
    {
      title: "Dispute Mediation",
      content: "In cases of technical failure where a node fails to deliver despite charging credits, the protocol's automated slashing mechanism will attempt to recover funds and reallocate them to the Client."
    }
  ]

  return (
    <div className="min-h-screen bg-[#050505] pt-32 pb-40 px-4 font-sans leading-relaxed selection:bg-red-500/30">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20 border-b border-white/5 pb-12">
            <div>
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-indigo-500 text-[11px] font-black uppercase tracking-[0.2em] mb-4"
                >
                    <RotateCcw className="w-4 h-4" />
                    Capital Protection
                </motion.div>
                <h1 className="text-5xl font-black text-white tracking-tight mb-4">Refund Policy</h1>
                <p className="text-gray-500 text-sm font-medium">Policy effective: {lastUpdated}</p>
            </div>
        </div>

        <div className="prose prose-invert max-w-none mb-20">
            <p className="text-xl text-gray-400 font-medium leading-[1.8]">
              Transparency in financial settlement is a core pillar of the RenderOnNodes protocol. Our refund logic is programmatically enforced by the Solana smart contract layer to ensure fairness for both Clients and Providers.
            </p>
        </div>

        <div className="space-y-16">
            {tiers.map((tier, idx) => (
                <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative pl-12 group"
                >
                    <div className="absolute left-0 top-0 w-8 h-8 rounded-xl bg-gray-900 border border-white/5 flex items-center justify-center text-xs font-black text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg">
                        {idx + 1}
                    </div>
                    <h2 className="text-2xl font-black text-white mb-6 tracking-tight group-hover:text-indigo-400 transition-colors">
                        {tier.title}
                    </h2>
                    <div className="text-gray-400 text-[15px] leading-[1.8] font-medium max-w-2xl">
                        {tier.content}
                    </div>
                </motion.div>
            ))}
        </div>

        <div className="mt-32 p-10 rounded-[2.5rem] bg-indigo-600/5 border border-indigo-500/20 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent" />
            <div className="relative z-10">
                <ShieldCheck className="w-8 h-8 text-indigo-500 mx-auto mb-6" />
                <h3 className="text-2xl font-black text-white mb-4">Programmatically Guaranteed.</h3>
                <p className="text-gray-500 text-sm font-medium mb-0 max-w-md mx-auto">
                    By utilizing our non-custodial escrow system, you agree to these automated refund tiers. All reversals are handled via on-chain instructions.
                </p>
            </div>
        </div>
      </div>
    </div>
  )
}

export default RefundPolicy
