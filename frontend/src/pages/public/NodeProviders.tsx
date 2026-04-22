import React from 'react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Server, Wallet, Shield, Cpu, CheckCircle2, ChevronRight, Zap, BarChart3, HardDrive } from 'lucide-react'
import { Link } from 'react-router-dom'

const requirements = [
  { icon: Cpu, label: 'GPU', value: 'NVIDIA RTX 2080 or newer (CUDA 11+)', color: 'text-blue-400' },
  { icon: HardDrive, label: 'RAM', value: '16 GB minimum, 32 GB recommended', color: 'text-emerald-400' },
  { icon: Zap, label: 'Bandwidth', value: '100 Mbps symmetric upload/download', color: 'text-orange-400' },
  { icon: Server, label: 'OS', value: 'Windows 10/11 or Ubuntu 20.04+', color: 'text-purple-400' },
]

// Removed earnings array as per user request to reflect "just started" state.

const steps = [
  { step: '01', title: 'Apply for Provider Access', desc: 'Fill out the node provider application. Our team reviews hardware specs to ensure quality for clients.' },
  { step: '02', title: 'Install the RenderOnNodes Agent', desc: 'A lightweight background service that accepts encrypted frame jobs from the network and renders them using your GPU.' },
  { step: '03', title: 'Set Your Schedule', desc: 'Run the agent 24/7 for maximum earnings, or configure active hours to only render when you\'re not gaming or working.' },
  { step: '04', title: 'Earn On-Chain Credits', desc: 'Get paid in mRNDR credits per frame rendered. Every payment is settled on Solana — transparent and instant.' },
]

const NodeProvidersPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Hero */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image on the Left for Nodes */}
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="relative group order-2 lg:order-1 flex justify-start">
              <div className="relative rounded-[2rem] overflow-hidden border border-white/10 shadow-xl max-w-md">
                <img 
                  src="/assets/renders/gpu-node.png" 
                  alt="High-Performance GPU Node" 
                  className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 via-transparent to-transparent opacity-60" />
                <div className="absolute top-8 right-8">
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-3xl translate-y-2 group-hover:translate-y-0 transition-all duration-500 opacity-0 group-hover:opacity-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                        <Cpu className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs font-mono text-purple-400 mb-0.5">AVAILABILITY</p>
                        <p className="text-sm text-white font-bold uppercase tracking-wide">99.9% Network Uptime</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-10 -left-10 w-64 h-64 bg-purple-600/20 rounded-full blur-[100px] -z-10" />
            </motion.div>

            {/* Content on the Right for Nodes */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="order-1 lg:order-2">
              <Badge variant="outline" className="text-purple-400 border-purple-500/30 mb-6 px-4 py-1 font-semibold">For GPU Owners</Badge>
              <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight leading-tight text-left">
                Your GPU.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Someone's Deadline.</span>
              </h1>
              <p className="text-xl text-gray-400 mb-10 leading-relaxed max-w-xl text-left">
                Join the render network and earn mRNDR credits every time your GPU renders a Blender frame. No upfront cost. No setup complexity. Paid per frame on-chain.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/apply-node-provider">
                  <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-10 py-4 font-bold rounded-2xl text-lg">
                    Apply to Become a Node <ChevronRight className="w-5 h-5 inline" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-[#0A0A0B] border-y border-white/5">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 'Expanding', label: 'Network Nodes', color: 'text-purple-400' },
              { value: 'Global', label: 'Availability', color: 'text-blue-400' },
              { value: 'Scaling', label: 'Daily Renders', color: 'text-emerald-400' },
              { value: '$0', label: 'Setup Cost', color: 'text-orange-400' },
            ].map((s) => (
              <div key={s.label}>
                <div className={`text-4xl font-black mb-1 ${s.color}`}>{s.value}</div>
                <div className="text-gray-500 text-xs uppercase tracking-widest font-bold">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to Join */}
      <section className="py-24 bg-[#0A0A0B]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="text-purple-400 border-purple-500/30 mb-4">Getting Started</Badge>
            <h2 className="text-4xl font-bold text-white">Start Earning in Four Steps</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="relative p-6 rounded-2xl bg-gray-900/60 border border-white/5 hover:border-purple-500/30 transition-all">
                <div className="text-4xl font-black text-white/5 absolute top-4 right-5 font-mono">{s.step}</div>
                <h3 className="text-white font-bold text-lg mb-3">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-24 bg-[#050505]">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="text-gray-400 border-white/10 mb-4 bg-white/5">Requirements</Badge>
            <h2 className="text-4xl font-bold text-white">Minimum Hardware Specs</h2>
            <p className="text-gray-400 mt-4">Your node will be benchmarked on approval. High-performance GPUs have the potential to earn more credits per frame.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {requirements.map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <r.icon className={`w-5 h-5 ${r.color}`} />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-0.5">{r.label}</div>
                  <div className="text-white font-semibold text-sm">{r.value}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* Trust */}
      <section className="py-24 bg-[#0A0A0B] border-t border-white/5">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white mb-12">Built on Trust</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: 'Encrypted Jobs', desc: 'You render encrypted payloads. You never access raw .blend assets.', color: 'text-purple-400' },
              { icon: Wallet, title: 'On-Chain Payments', desc: 'Every mRNDR credit earned is settled on Solana. Fully auditable.', color: 'text-blue-400' },
              { icon: BarChart3, title: 'Transparent Dashboard', desc: 'Track frames rendered, credits earned, and uptime in real time.', color: 'text-emerald-400' },
            ].map((t, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <t.icon className={`w-6 h-6 ${t.color}`} />
                </div>
                <h4 className="text-white font-bold mb-2">{t.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-16">
            <Link to="/apply-node-provider">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white px-10 py-4 font-bold rounded-2xl text-lg shadow-lg shadow-purple-500/20">
                Apply Now — It's Free
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default NodeProvidersPage
