import React from 'react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Cpu, Upload, Download, Zap, Shield, Clock, Wallet, CheckCircle2, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const steps = [
  { step: '01', icon: Upload, title: 'Pack & Upload', desc: 'Use Blender\'s built-in "Pack Resources" then upload your .blend to the dashboard. We handle chunking automatically.', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { step: '02', icon: Cpu, title: 'Choose Engine & Settings', desc: 'Select Cycles or Eevee, set your frame range, output format (EXR, PNG, MP4), and resolution. Set a credit cap.', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { step: '03', icon: Zap, title: 'Distributed Rendering', desc: 'Your frames are distributed across global GPU nodes. Watch real-time progress on the live frame ticker.', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { step: '04', icon: Download, title: 'Download Your Frames', desc: 'Once complete, download your full-resolution output as a ZIP or single files. Frames stored for 7 days.', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
]

// Removed pricing array as per user request to reflect "just started" state.

const useCases = [
  { title: 'Animation Studios', desc: 'Render full feature films and shorts without buying server racks. Scale to 200+ GPUs overnight.' },
  { title: 'Architectural Visualization', desc: 'Submit property sun-study animations and walkthroughs. Clients get same-day delivery.' },
  { title: 'Game Cinematics', desc: 'Pre-rendered cutscenes in Blender with full Cycles path tracing — shipped on time every time.' },
  { title: 'Product Marketing', desc: 'Rapid-turnaround product animations for e-commerce and advertising campaigns.' },
]

const ArtistsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Hero */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
          {/* Animated Particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-emerald-400/20 rounded-full"
              animate={{
                y: [0, -100, 0],
                x: [0, Math.random() * 50 - 25, 0],
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: 5 + Math.random() * 5,
                repeat: Infinity,
                delay: i * 2,
                ease: "linear"
              }}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`
              }}
            />
          ))}
        </div>
        <div className="relative container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 mb-6 px-4 py-1 font-semibold">For Blender Artists</Badge>
              <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight leading-tight">
                Render More.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Wait Less.</span>
              </h1>
              <p className="text-xl text-gray-400 mb-8 leading-relaxed">
                Stop waiting on local GPU renders. Upload your .blend and tap into a global network of high-performance GPUs — with flexible credit-based billing and no subscriptions.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/register">
                  <Button className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white px-8 py-3 font-bold rounded-xl">
                    Start Rendering Free <ChevronRight className="w-4 h-4 inline" />
                  </Button>
                </Link>
                <Link to="/showcase">
                  <Button variant="ghost" className="text-gray-400 border border-white/10 hover:text-white hover:border-white/20 px-8 py-3 font-bold rounded-xl">
                    See the Gallery
                  </Button>
                </Link>
              </div>
            </motion.div>
            {/* Feature Pill Grid */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="relative flex justify-center lg:justify-end">
              <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl group max-w-lg">
                <img 
                  src="/assets/renders/artists-hero.webp" 
                  srcSet="/assets/renders/artists-hero.webp 1x"
                  alt="Cinematic 3D Render" 
                  className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                  width="800"
                  height="600"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-6 left-6 right-6 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0">
                  <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
                    <p className="text-xs font-mono text-emerald-400 mb-1">PROJECT: ZENITH CITY</p>
                    <p className="text-sm text-white font-semibold">Rendered in 12m 45s across 24 Node GPUs</p>
                  </div>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-[80px] -z-10" />
            </motion.div>
          </div>
          
          {/* Feature Pills moved below */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20"
          >
            {[
              { icon: Zap, label: 'OptiX & CUDA', color: 'text-blue-400' },
              { icon: Clock, label: 'Real-time Frame Ticker', color: 'text-emerald-400' },
              { icon: Shield, label: 'Asset Encryption', color: 'text-purple-400' },
              { icon: Wallet, label: 'Credit-Based Billing', color: 'text-orange-400' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <f.icon className={`w-5 h-5 ${f.color} shrink-0`} />
                <span className="text-sm font-semibold text-white">{f.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works for Artists */}
      <section className="py-24 bg-[#0A0A0B] border-y border-white/5">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="text-blue-400 border-blue-500/30 mb-4 bg-blue-500/5">Workflow</Badge>
            <h2 className="text-4xl font-bold text-white">Four Steps from Upload to Download</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className={`p-6 rounded-2xl border ${s.bg} ${s.border}`}>
                <div className="text-2xl font-black text-white/5 mb-4 font-mono">{s.step}</div>
                <s.icon className={`w-7 h-7 ${s.color} mb-4`} />
                <h3 className="text-white font-bold mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24 bg-[#0A0A0B]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="text-orange-400 border-orange-500/30 mb-4">Use Cases</Badge>
            <h2 className="text-4xl font-bold text-white">Who Uses RenderOnNodes?</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((u, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-gray-900/60 border border-white/5 hover:border-orange-500/20 transition-all">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-orange-400" />
                </div>
                <h4 className="text-white font-bold mb-2">{u.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{u.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}

export default ArtistsPage
