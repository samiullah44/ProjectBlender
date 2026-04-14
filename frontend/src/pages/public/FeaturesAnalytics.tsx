import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Clock, LayoutGrid, Bell, Settings2, ShieldCheck } from 'lucide-react';

const FeaturesAnalytics = () => {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  return (
    <div className="bg-[#050505] min-h-screen text-white pt-24">
      {/* Hero */}
      <section className="relative py-24 lg:py-32 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-cyan-500/5 blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-5xl text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeIn}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-semibold mb-6">
              <BarChart3 className="w-4 h-4" /> Telemetry & Observability
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
              Real-time Rendering <br/> Analytics.
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Never wonder about the status of your render again. We provide surgical precision over your jobs with an incredibly detailed, live-updating dashboard.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Details Grid */}
      <section className="py-24 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <LayoutGrid className="w-10 h-10 text-cyan-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">Frame-by-Frame Tracking</h3>
            <p className="text-gray-400 leading-relaxed">
              Watch as the exact progress of every single sliced frame updates live. View a grid visualization of what's currently processing and an estimated time to completion matrix.
            </p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <Clock className="w-10 h-10 text-emerald-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">Historical Diagnostics</h3>
            <p className="text-gray-400 leading-relaxed">
              Access the exact render times of your previous nodes and compare them against historical averages to see performance gains transparently.
            </p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <Bell className="w-10 h-10 text-indigo-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">Live Webhooks</h3>
            <p className="text-gray-400 leading-relaxed">
              Integrate directly into your Slack, Discord, or custom CI/CD pipelines. Receive instant pings the moment your ultra-HD asset finishes compiling.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Interface Segment */}
      <section className="py-24 bg-gray-900/30 border-y border-white/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl text-center">
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}}>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Designed for Control</h2>
            <p className="text-gray-400 text-lg mb-16 max-w-2xl mx-auto leading-relaxed">
              A heavily optimized react-based command center provides an ultra-responsive interface regardless of how many concurrent frames you are actively rendering.
            </p>
          </motion.div>
          <motion.div initial={{opacity: 0, y: 40}} whileInView={{opacity: 1, y: 0}} viewport={{once: true}} transition={{duration: 0.8}} className="relative mx-auto w-full max-w-4xl aspect-[16/9] bg-gray-950 border border-white/10 shadow-2xl rounded-xl overflow-hidden flex flex-col">
             {/* Mock Dashboard UI */}
             <div className="h-10 border-b border-white/5 flex items-center px-4 gap-2 bg-gray-900">
               <div className="w-3 h-3 rounded-full bg-red-500" />
               <div className="w-3 h-3 rounded-full bg-yellow-500" />
               <div className="w-3 h-3 rounded-full bg-green-500" />
               <div className="mx-auto text-xs text-gray-500 font-mono">Job Dash: #RD-49210</div>
             </div>
             <div className="p-6 flex-1 flex gap-6">
               <div className="w-1/3 flex flex-col gap-4">
                 <div className="h-24 bg-cyan-500/10 border border-cyan-500/20 rounded-lg flex flex-col justify-center px-6">
                   <div className="text-xs text-cyan-400 uppercase font-bold tracking-wider">Active Nodes</div>
                   <div className="text-3xl font-black text-white">128</div>
                 </div>
                 <div className="flex-1 bg-gray-900 rounded-lg border border-white/5 p-4 space-y-3">
                   <div className="h-4 w-3/4 bg-gray-800 rounded animate-pulse" />
                   <div className="h-4 w-1/2 bg-gray-800 rounded animate-pulse" />
                   <div className="h-4 w-5/6 bg-gray-800 rounded animate-pulse" />
                 </div>
               </div>
               <div className="w-2/3 bg-gray-900 rounded-lg border border-white/5 relative overflow-hidden flex items-center justify-center p-6">
                 <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-cyan-500/5 point-grid" />
                 <div className="w-full h-full grid grid-cols-8 gap-2">
                   {Array.from({length: 32}).map((_, i) => (
                     <div key={i} className={`rounded-md ${i < 18 ? 'bg-emerald-500/20 border border-emerald-500/30' : i < 22 ? 'bg-cyan-500/40 border border-cyan-400 animate-pulse' : 'bg-gray-800 border border-gray-700'}`} />
                   ))}
                 </div>
               </div>
             </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};
export default FeaturesAnalytics;
