import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Shield, Wifi, Server, Play, HeartHandshake, Earth } from 'lucide-react';

const FeaturesNetwork = () => {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  return (
    <div className="bg-[#050505] min-h-screen text-white pt-24">
      {/* Hero */}
      <section className="relative py-24 lg:py-32 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-emerald-500/5 blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-5xl text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeIn}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold mb-6">
              <Earth className="w-4 h-4" /> Global Node Topology
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
              A Network Without Borders.
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              We leverage an extensively vetted peer-to-peer network spanning over 15 countries. Gain unparalleled uptime, automated redundancy, and extreme low latency distribution directly to high-end hardware.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Details Grid */}
      <section className="py-24 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <Wifi className="w-10 h-10 text-emerald-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">Ultra-Low Latency</h3>
            <p className="text-gray-400 leading-relaxed">
              Jobs are algorithmically sorted and dispatched to geographical clusters closest to you, guaranteeing that the massive transfer of heavy textures and EXR files happens instantly.
            </p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <Server className="w-10 h-10 text-indigo-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">Node Redundancy</h3>
            <p className="text-gray-400 leading-relaxed">
              Every chunk is double-verified. If a peer-to-peer node drops offline mid-render, the job is instantly, transparently assigned to a standby node with zero data corruption.
            </p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <Shield className="w-10 h-10 text-cyan-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">Hardware Vetting</h3>
            <p className="text-gray-400 leading-relaxed">
              Providers undergo rigorous benchmark authentication. Only top-tier silicon (RTX 3080/4080/4090 equivalents) are allowed to onboard onto the primary premium queues.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Network Verification Segment */}
      <section className="py-24 bg-gray-900/30 border-y border-white/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="flex-1 relative w-full aspect-video rounded-3xl border border-white/10 bg-[#0A0D14] overflow-hidden flex items-center justify-center">
              {/* Decorative map representation */}
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/connected-points.png')] opacity-30" />
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent mix-blend-overlay" />
              <Globe className="w-32 h-32 text-emerald-500/50 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 slow-spin" />
            </motion.div>
            
            <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="flex-1">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Enterprise-Level Security</h2>
              <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                We understand that your 3D assets are heavily guarded intellectual property. That is why our global network treats every single asset as classified media.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="mt-1 bg-emerald-500/10 p-2 rounded-lg"><Shield className="w-5 h-5 text-emerald-400" /></div>
                  <div>
                    <h4 className="font-semibold text-lg text-white">End-to-End Encryption</h4>
                    <p className="text-gray-400 mt-1">Files are encrypted before they ever leave your machine (AES-256). They remain encrypted in transit and on the node's disk.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1 bg-emerald-500/10 p-2 rounded-lg"><Play className="w-5 h-5 text-emerald-400" /></div>
                  <div>
                    <h4 className="font-semibold text-lg text-white">Volatile Memory Execution</h4>
                    <p className="text-gray-400 mt-1">Blend files are only decrypted temporarily in volatile RAM. No footprints are left on the physical storage of the host.</p>
                  </div>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};
export default FeaturesNetwork;
