import React from 'react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Building2, Cpu, Globe, Shield, BarChart3, Zap, CheckCircle2, ChevronRight, Clock, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

const features = [
  { icon: Cpu, title: 'Dedicated GPU Pool', desc: 'Reserve a dedicated tier of nodes exclusively for your organization — isolated from the public queue.', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { icon: Globe, title: 'Geographic Routing', desc: 'Pin renders to specific regions for compliance or latency. GDPR-friendly EU nodes available.', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { icon: Shield, title: 'Enterprise SLA', desc: '99.9% uptime SLA with guaranteed render completion windows and dedicated incident response.', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { icon: BarChart3, title: 'Advanced Analytics', desc: 'Full team-level usage dashboards, per-project cost attribution, and exportable billing reports.', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { icon: Zap, title: 'API Access', desc: 'Integrate render job submission directly into your existing pipeline via our REST API.', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { icon: Wallet, title: 'Flexible Billing', desc: 'Secure enterprise-grade rendering with transparent on-chain credit settlement.', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
]

// Removed tiers array as per user request to reflect "just started" state.

const integrations = [
  { name: 'Blender', desc: 'Native .blend support with packed resources' },
  { name: 'REST API', desc: 'Submit jobs from any CI/CD pipeline' },
  { name: 'Solana', desc: 'On-chain credit settlement and audit' },
  { name: 'Webhooks', desc: 'Real-time render completion callbacks' },
]

const ComputeClientsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Hero */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative container mx-auto px-6 text-center max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="outline" className="text-blue-400 border-blue-500/30 mb-6 px-4 py-1 font-semibold">For Studios & Enterprises</Badge>
            <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight leading-tight">
              Studio-Grade Rendering.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Elastic Infrastructure.</span>
            </h1>
            <p className="text-xl text-gray-400 mb-10 leading-relaxed max-w-2xl mx-auto">
              Scale from a single project to a feature film pipeline without buying a single server. RenderOnNodes delivers enterprise-grade GPU rendering with transparent on-chain billing and SLA-backed reliability.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link to="/contact">
                <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-10 py-4 font-bold rounded-2xl text-lg">
                  Talk to Sales <ChevronRight className="w-5 h-5 inline" />
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative group max-w-3xl mx-auto">
            <div className="relative rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_0_30px_rgba(0,186,255,0.05)]">
              <img 
                src="/assets/renders/data-center.webp" 
                srcSet="/assets/renders/data-center.webp 1x"
                alt="Enterprise Infrastructure" 
                className="w-full h-auto object-cover transform transition-transform duration-1000 group-hover:scale-105"
                loading="lazy"
                width="800"
                height="600"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />
              <div className="absolute bottom-10 left-10 right-10">
                <div className="flex flex-wrap gap-4 justify-center items-center">
                  {[
                    { value: 'Unlimited', label: 'Network Power', color: 'text-blue-400', icon: Cpu },
                    { value: '99.9%', label: 'Uptime SLA', color: 'text-emerald-400', icon: Shield },
                    { value: 'Global', label: 'Availability', color: 'text-purple-400', icon: Globe },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/5 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-[2rem] flex items-center gap-3">
                      <s.icon className={`w-5 h-5 ${s.color}`} />
                      <div className="text-left">
                        <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-[#050505] border-y border-white/5">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="text-blue-400 border-blue-500/30 mb-4 bg-blue-500/5">Enterprise Features</Badge>
            <h2 className="text-4xl font-bold text-white">Built for Production Pipelines</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className={`p-6 rounded-2xl border ${f.bg} ${f.border}`}>
                <f.icon className={`w-7 h-7 ${f.color} mb-4`} />
                <h4 className="text-white font-semibold mb-1">Dynamic GPU Scaling</h4>
                <p className="text-xs text-gray-500">Instantly distribute your sequence across our global network.</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-24 bg-[#0A0A0B]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 mb-4">Integrations</Badge>
            <h2 className="text-4xl font-bold text-white">Fits into Your Pipeline</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {integrations.map((int, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-gray-900/60 border border-white/5 text-center flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                  <Cpu className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="font-bold text-white mb-1">{int.name}</div>
                <div className="text-gray-500 text-xs">{int.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* Bottom CTA */}
      <section className="py-24 bg-[#050505] text-center">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Scale Your Pipeline?</h2>
          <p className="text-gray-400 mb-10 max-w-xl mx-auto">Talk to our team about a custom plan for your studio's rendering needs.</p>
          <Link to="/contact">
            <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-12 py-4 font-bold rounded-2xl text-lg">
              Request a Demo
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}

export default ComputeClientsPage
