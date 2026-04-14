import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Server, Shield, Zap, CircleDollarSign, 
  Cpu, Globe, Layers, Lock, MonitorPlay, Box, FileImage
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const Features = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('waitlist_status') === 'subscribed') {
      setIsSubscribed(true);
    }
    const handleSubscribe = () => setIsSubscribed(true);
    window.addEventListener('waitlist-subscribed', handleSubscribe);
    return () => window.removeEventListener('waitlist-subscribed', handleSubscribe);
  }, []);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const handleJoinWaitlist = () => {
    window.dispatchEvent(new Event('open-waitlist'));
  };

  return (
    <div className="bg-[#050505] min-h-screen text-white pt-24 pb-20">
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 text-center mb-32">
        <motion.div initial="hidden" animate="visible" variants={fadeIn} className="max-w-4xl mx-auto">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-semibold mb-6">
            The Next Generation of Rendering
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight">
            Distributed Rendering. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">
              Reinvented.
            </span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Unleash the power of idle GPUs globally. Process your most complex scenes in a fraction of the time, and at a fraction of the cost of traditional cloud rendering.
          </p>
          <Button 
            onClick={handleJoinWaitlist}
            className="bg-indigo-600 hover:bg-indigo-700 text-lg px-8 py-6 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
          >
            Join the Waitlist
          </Button>
        </motion.div>
      </section>

      {/* The Problem */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-32">
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
          variants={fadeIn}
          className="bg-gray-900/40 border border-white/5 rounded-3xl p-8 md:p-12 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-32 bg-red-500/5 blur-[120px] rounded-full" />
          <h2 className="text-3xl font-bold mb-10 text-center">The Industry Standard is Broken</h2>
          
          <div className="grid md:grid-cols-3 gap-8 text-center relative z-10">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <MonitorPlay className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Slow Local Hardware</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Tying up your workstation for hours or days kills productivity and stalls creative iterations.
              </p>
            </div>
            <div className="p-6">
              <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Server className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Expensive Cloud Rigs</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Traditional cloud rendering monopolies charge astronomical markups for centralized infrastructure.
              </p>
            </div>
            <div className="p-6">
              <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Globe className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Idle Global Compute</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Millions of high-end GPUs sit unused around the world while creators wait in long render queues.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Core Features Grid */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">The RenderOnNodes Solution</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">We've built a revolutionary decentralized architecture to solve the rendering bottleneck.</p>
        </div>

        <motion.div 
          variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          className="grid md:grid-cols-2 gap-6"
        >
          {/* Feature 1 */}
          <motion.div variants={fadeIn} className="bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 rounded-3xl p-8 hover:bg-indigo-500/10 transition-colors">
            <Layers className="w-10 h-10 text-indigo-400 mb-6" />
            <h3 className="text-2xl font-bold mb-4">Distributed Rendering Engine</h3>
            <p className="text-gray-400 leading-relaxed">
              Our core engine automatically slices your scene into optimal chunks. These frames are processed in parallel across hundreds of nodes simultaneously, cutting render times from days to hours.
            </p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div variants={fadeIn} className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-3xl p-8 hover:bg-emerald-500/10 transition-colors">
            <Globe className="w-10 h-10 text-emerald-400 mb-6" />
            <h3 className="text-2xl font-bold mb-4">Global Node Marketplace</h3>
            <p className="text-gray-400 leading-relaxed">
              A peer-to-peer network. Anyone with a dedicated GPU can contribute power and earn credits. Connect your idle machines and let them work for you while you sleep.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div variants={fadeIn} className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-3xl p-8 hover:bg-cyan-500/10 transition-colors">
            <Zap className="w-10 h-10 text-cyan-400 mb-6" />
            <h3 className="text-2xl font-bold mb-4">Smart Scheduler</h3>
            <p className="text-gray-400 leading-relaxed">
              Our intelligent load balancer assigns chunks based on hardware capabilities and node reliability. Built-in fault tolerance guarantees that if a node drops out, the chunk is instantly reassigned.
            </p>
          </motion.div>

          {/* Feature 4 */}
          <motion.div variants={fadeIn} className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-3xl p-8 hover:bg-purple-500/10 transition-colors">
            <CircleDollarSign className="w-10 h-10 text-purple-400 mb-6" />
            <h3 className="text-2xl font-bold mb-4">Cost Optimization Layer</h3>
            <p className="text-gray-400 leading-relaxed">
              Pay strictly for the compute you use. By bypassing massive cloud markups and utilizing peer-to-peer hardware, you save up to 80% compared to traditional services.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* Capabilities & Security */}
      <section className="bg-gray-900/30 border-y border-white/5 py-24 mb-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Tech Specs */}
            <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 text-indigo-400 font-semibold mb-6">
                <Cpu className="w-5 h-5" />
                Technical Capabilities
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-8">Built for Professionals</h2>
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="mt-1 bg-white/5 p-2 rounded-lg"><Box className="w-5 h-5 text-gray-300" /></div>
                  <div>
                    <h4 className="font-semibold text-lg text-white">Supported Engines</h4>
                    <p className="text-gray-400 mt-1">Full integration with Blender (Cycles & Eevee). Unreal Engine pipeline coming soon.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1 bg-white/5 p-2 rounded-lg"><FileImage className="w-5 h-5 text-gray-300" /></div>
                  <div>
                    <h4 className="font-semibold text-lg text-white">Output Formats</h4>
                    <p className="text-gray-400 mt-1">Lossless EXR (multilayer), transparent PNG sequences, and heavily optimized MP4 composites.</p>
                  </div>
                </li>
              </ul>
            </motion.div>

            {/* Security */}
            <motion.div initial="hidden" whileInView="visible" variants={fadeIn} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 text-emerald-400 font-semibold mb-6">
                <Shield className="w-5 h-5" />
                Enterprise-Grade Trust
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-8">Secure by Design</h2>
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="mt-1 bg-white/5 p-2 rounded-lg"><Lock className="w-5 h-5 text-gray-300" /></div>
                  <div>
                    <h4 className="font-semibold text-lg text-white">End-to-End Encryption</h4>
                    <p className="text-gray-400 mt-1">Your proprietary scenes are encrypted at rest and during transit. Nodes only decrypt in volatile memory.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1 bg-white/5 p-2 rounded-lg"><Server className="w-5 h-5 text-gray-300" /></div>
                  <div>
                    <h4 className="font-semibold text-lg text-white">Sandbox Execution</h4>
                    <p className="text-gray-400 mt-1">Render processes run in strictly isolated sandboxes, ensuring zero interference and maximum stability.</p>
                  </div>
                </li>
              </ul>
            </motion.div>

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 text-center pb-10">
        <motion.div 
          initial="hidden" whileInView="visible" variants={fadeIn} viewport={{ once: true }}
          className="bg-gradient-to-r from-indigo-900/40 to-emerald-900/40 border border-white/10 rounded-3xl p-12 md:p-20"
        >
          <h2 className="text-4xl font-bold mb-6">Join 120+ creators waiting for launch.</h2>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Get notified the moment we go live. Early adopters will receive exclusive beta priority and free rendering credits to test out the platform.
          </p>
          <Button 
            onClick={isSubscribed ? undefined : handleJoinWaitlist}
            disabled={isSubscribed}
            className={`text-lg px-8 py-6 rounded-2xl font-bold transition-all shadow-xl ${
              isSubscribed 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 cursor-not-allowed' 
                : 'bg-white text-indigo-950 hover:bg-gray-100 hover:scale-105'
            }`}
          >
            {isSubscribed ? "You're on the list!" : "Claim Priority Access"}
          </Button>
        </motion.div>
      </section>

    </div>
  );
};

export default Features;
