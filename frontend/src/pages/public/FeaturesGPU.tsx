import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Zap, Layers, Activity, Server, Box, MonitorPlay } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const FeaturesGPU = () => {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  return (
    <div className="bg-[#050505] min-h-screen text-white pt-24">
      {/* Hero */}
      <section className="relative py-24 lg:py-32 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-5xl text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeIn}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-semibold mb-6">
              <Cpu className="w-4 h-4" /> Unmatched Compute Power
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
              Hardware Acceleration <br/> Without Limits.
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              We aggregate the raw processing power of the world's most advanced GPUs. Render complex, million-poly scenes in absolute record time using hardware specifically optimized for intensive 3D operations.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Details Grid */}
      <section className="py-24 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <Zap className="w-10 h-10 text-indigo-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">NVIDIA RTX & OptiX</h3>
            <p className="text-gray-400 leading-relaxed">
              Fully leverages dedicated ray-tracing cores. OptiX integration ensures incredibly fast BVH building and intersection calculations.
            </p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <Layers className="w-10 h-10 text-emerald-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">Massive VRAM Scaling</h3>
            <p className="text-gray-400 leading-relaxed">
              Texture-heavy projects out-of-core errors are a thing of the past. Our premium nodes route jobs to 24GB+ VRAM hardware (e.g. RTX 4090s/A6000s).
            </p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="bg-gray-900/50 p-8 rounded-3xl border border-white/5">
            <Activity className="w-10 h-10 text-cyan-400 mb-6" />
            <h3 className="text-xl font-bold mb-3">CUDA Core Parallelism</h3>
            <p className="text-gray-400 leading-relaxed">
              Job slicing is dynamically mapped purely to node core counts, guaranteeing that no hardware sits idle and your job completes natively fast.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Deep Dive */}
      <section className="py-24 bg-gray-900/30 border-y border-white/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}}>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Built for Serious Pipelines</h2>
              <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                We've ensured our hardware abstraction layer translates seamlessly to major rendering engines. You aren't just getting raw compute; you're getting tightly integrated, reliable output logic.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="bg-indigo-500/20 p-1.5 rounded-full"><Box className="w-4 h-4 text-indigo-400"/></div>
                  Cycles X Engine Auto-tuning
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="bg-indigo-500/20 p-1.5 rounded-full"><MonitorPlay className="w-4 h-4 text-indigo-400"/></div>
                  Unreal Engine Path Tracer Support
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="bg-indigo-500/20 p-1.5 rounded-full"><Server className="w-4 h-4 text-indigo-400"/></div>
                  Failover node redundancy
                </li>
              </ul>
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{once: true}} className="relative">
              <div className="aspect-square bg-gradient-to-tr from-indigo-900/50 to-[#0B0F19] border border-white/10 rounded-3xl p-8 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
                <div className="w-48 h-48 bg-indigo-500 rounded-full blur-[100px] absolute" />
                <div className="relative text-center">
                  <div className="text-6xl font-black text-white mb-2">12,000+</div>
                  <div className="text-indigo-300 font-semibold tracking-wide uppercase text-sm">Combined Cuda Cores per cluster</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};
export default FeaturesGPU;
