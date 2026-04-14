import React from 'react'
import { motion } from 'framer-motion'
import { Cpu, Globe, Shield, Zap, Users, Rocket, Heart, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const team = [
  { name: 'Core Engineering', role: 'Distributed Systems & Solana', desc: 'Building the infrastructure that powers frame-perfect rendering at scale.' },
  { name: 'Rendering R&D', role: 'Blender & GPU Pipeline', desc: 'Deep Blender integration experts ensuring Cycles & Eevee render flawlessly on every node.' },
  { name: 'Network Operations', role: 'Global Node Orchestration', desc: 'Managing a worldwide mesh of GPU nodes across 15+ countries 24/7.' },
  { name: 'Security & Trust', role: 'Asset Encryption & Compliance', desc: 'Protecting your .blend assets with end-to-end encryption across every hop.' },
]

const values = [
  { icon: Target, title: 'Artist-First Philosophy', desc: 'Every architectural decision starts with the question: does this make the artist\'s life easier?', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { icon: Globe, title: 'Decentralized by Design', desc: 'On-chain settlement via Solana means no single point of failure — your earnings are verifiable on-chain.', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { icon: Shield, title: 'Zero-Trust Security', desc: 'Your .blend files are encrypted in transit and at rest. Nodes can render without ever seeing raw assets.', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { icon: Heart, title: 'Community-Driven', desc: 'We are artists and engineers who render ourselves. The network is built by the community, for the community.', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
]

// Removed milestones array as per user request to reflect "just started" state.

const AboutUsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Hero */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-purple-500/10 to-orange-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative container mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 mb-6 px-4 py-1 font-semibold">Our Story</Badge>
            <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
              Rendering the Future,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                Together
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              RenderOnNodes is a decentralized GPU rendering network built exclusively for Blender artists. We connect studios and creators who need rendering power with hardware owners who want to put their idle GPUs to work — powered by Solana on-chain settlements.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-white/5 bg-[#0A0A0B]">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: 'Network Scalability', value: 'Unlimited', color: 'text-emerald-400' },
              { label: 'Global Availability', value: '24/7', color: 'text-blue-400' },
              { label: 'Settlement Speed', value: 'Instant', color: 'text-purple-400' },
              { label: 'Enterprise Ready', value: 'Secure', color: 'text-orange-400' },
            ].map((stat) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <div className={`text-4xl font-black mb-1 ${stat.color}`}>{stat.value}</div>
                <div className="text-gray-500 font-bold text-xs uppercase tracking-widest">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-24 bg-[#050505]">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Badge variant="outline" className="text-purple-400 border-purple-500/30 mb-4">Mission</Badge>
              <h2 className="text-4xl font-bold mb-6">
                Democratize Professional Rendering — <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">No Render Farm Required</span>
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-6">
                Traditional render farms are expensive, opaque, and locked to proprietary formats. We believe every Blender artist — from solo freelancer to 50-person studio — deserves access to industrial-grade GPU rendering power at fair, transparent, per-frame pricing.
              </p>
              <p className="text-gray-400 text-lg leading-relaxed">
                Our Solana-backed on-chain credit system ensures every payment is transparent, auditable, and instant. Node providers earn real credits. Studios render without surprise bills.
              </p>
            </motion.div>
            <div className="grid grid-cols-2 gap-4">
              {values.map((v, i) => (
                <motion.div key={v.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className={`p-5 rounded-2xl border ${v.bg} ${v.border}`}>
                  <v.icon className={`w-6 h-6 ${v.color} mb-3`} />
                  <h4 className="text-white font-semibold text-sm mb-1">{v.title}</h4>
                  <p className="text-gray-500 text-xs leading-relaxed">{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Vision section replacing Timeline */}
      <section className="py-24 bg-[#050505] border-t border-white/5">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <Badge variant="outline" className="text-blue-400 border-blue-500/30 mb-4 bg-blue-500/5">Vision</Badge>
          <h2 className="text-4xl font-bold text-white mb-6">Our Vision for the Future</h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            We are building the first truly decentralized, artist-centric render network. By leveraging the power of Solana and a global mesh of high-performance GPUs, we're making professional-grade rendering accessible to every creator on the planet. Our journey is just beginning, and we're dedicated to evolving the platform based on the needs of the Blender community.
          </p>
        </div>
      </section>

      {/* Team */}
      <section className="py-24 bg-[#0A0A0B]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="text-orange-400 border-orange-500/30 mb-4">The Team</Badge>
            <h2 className="text-4xl font-bold text-white">Built by Creators, for Creators</h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">Our team spans distributed systems, GPU computing, and 3D art — we've all felt the pain of waiting on local renders.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-gray-900/60 border border-white/5 hover:border-white/10 transition-all text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <Cpu className="w-6 h-6 text-emerald-400" />
                </div>
                <h4 className="text-white font-bold mb-1">{t.name}</h4>
                <div className="text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-3">{t.role}</div>
                <p className="text-gray-500 text-sm leading-relaxed">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-[#0A0A0B] border-t border-white/10">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Render?</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">Join over 1,200 artists already using the network.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 font-bold rounded-xl shadow-lg shadow-emerald-500/20">Get Started Free</Button>
            </Link>
            <Link to="/contact">
              <Button variant="ghost" className="text-white hover:text-white border border-white/20 hover:bg-white/5 hover:border-white/30 px-8 py-4 font-bold rounded-xl">Contact Us</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AboutUsPage
