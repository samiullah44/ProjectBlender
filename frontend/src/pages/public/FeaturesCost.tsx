import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard, TrendingDown, Scissors, PiggyBank, Scale } from 'lucide-react';

const FeaturesCost = () => {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  return (
    <div className="bg-[#050505] min-h-screen text-white pt-24">
      {/* Hero */}
      <section className="relative py-24 lg:py-32 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-purple-500/5 blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-5xl text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeIn}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-semibold mb-6">
              <CreditCard className="w-4 h-4" /> Revolutionary Pricing Model
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
              Pay Only For <br/> What You Calculate.
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Our decentralized architecture totally bypasses centralized cloud monopolies. You only pay directly for the peer-to-peer compute capacity allocated to your exact frames, yielding savings of up to 80%.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Details Grid */}
      <section className="py-24 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <Scissors className="w-10 h-10 text-purple-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">No Subscription Fees</h3>
            <p className="text-gray-400 leading-relaxed">
              No arbitrary tiers, no massive monthly minimums, no idle costs. Purchase rendering credits precisely when you need an intensive job processed, completely a-la-carte.
            </p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <Scale className="w-10 h-10 text-emerald-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">OctaneBench Standardized</h3>
            <p className="text-gray-400 leading-relaxed">
              We mathematically map credits to exact compute output based on the standardized OctaneBench (OB) hour model. You pay equally for computational output, not arbitrarily for random hardware time.
            </p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <PiggyBank className="w-10 h-10 text-cyan-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">Earn as a Node</h3>
            <p className="text-gray-400 leading-relaxed">
              Completely offset your own rendering costs. Leave your GPU connected to the network overnight to process jobs for others and earn credits straight into your account.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Comparative Analysis Segment */}
      <section className="py-24 bg-gray-900/30 border-y border-white/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl text-center">
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}}>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Compare the Savings</h2>
            <p className="text-gray-400 text-lg mb-16 max-w-2xl mx-auto leading-relaxed">
              Decentralized rendering eliminates the massive overhead of centralized data centers, allowing for significantly lower costs for artists and studios.
            </p>
            
            <div className="grid md:grid-cols-2 gap-8 text-left">
               <div className="bg-[#0B0F19] p-8 rounded-2xl border border-white/10 shadow-xl opacity-60 grayscale filter hover:grayscale-0 transition-all duration-300">
                 <div className="text-gray-500 font-bold uppercase tracking-widest text-sm mb-4">Traditional Cloud Rendering</div>
                 <div className="text-4xl font-bold text-white mb-2">High Overhead</div>
                 <p className="text-gray-500 mb-6">Centralized Infrastructure</p>
                 <ul className="space-y-3">
                   <li className="flex items-center gap-2 text-gray-400"><TrendingDown className="w-4 h-4 text-red-500"/> Paying for instance idle boot time</li>
                   <li className="flex items-center gap-2 text-gray-400"><TrendingDown className="w-4 h-4 text-red-500"/> Massive markup margins</li>
                   <li className="flex items-center gap-2 text-gray-400"><TrendingDown className="w-4 h-4 text-red-500"/> Complicated, opaque pricing</li>
                 </ul>
               </div>
               
               <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 p-8 rounded-2xl border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)] relative overflow-hidden text-left transform md:-translate-y-4">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 blur-[80px] opacity-20" />
                 <div className="text-purple-400 font-bold uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
                   <CreditCard className="w-4 h-4" /> RenderOnNodes Direct
                 </div>
                 <div className="text-4xl font-bold text-white mb-2">Maximum Efficiency</div>
                 <p className="text-purple-300 mb-6">Peer-to-Peer Network</p>
                 <ul className="space-y-3">
                   <li className="flex items-center gap-2 text-gray-200"><TrendingDown className="w-4 h-4 text-emerald-400"/> Instant boot, zero idle charges</li>
                   <li className="flex items-center gap-2 text-gray-200"><TrendingDown className="w-4 h-4 text-emerald-400"/> Direct peer-to-peer settlement</li>
                   <li className="flex items-center gap-2 text-gray-200"><TrendingDown className="w-4 h-4 text-emerald-400"/> Transparent on-chain credits</li>
                 </ul>
               </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};
export default FeaturesCost;
