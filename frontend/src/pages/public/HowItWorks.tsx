import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UploadCloud, Scissors, Network, Play, Download, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const HowItWorks = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('waitlist_status') === 'subscribed') {
      setIsSubscribed(true);
    }
    const handleSubscribe = () => setIsSubscribed(true);
    window.addEventListener('waitlist-subscribed', handleSubscribe);
    return () => window.removeEventListener('waitlist-subscribed', handleSubscribe);
  }, []);

  const steps = [
    {
      id: 1,
      title: "Prepare & Upload",
      description: "Package your Blender project (.blend) along with all textures. Upload it securely to our staging environment through the client dashboard.",
      icon: <UploadCloud className="w-8 h-8 text-indigo-400" />,
      color: "from-indigo-500/20 to-indigo-500/5",
      borderColor: "border-indigo-500/30"
    },
    {
      id: 2,
      title: "Job Splitting",
      description: "Our backend analyzes your scene parameters and mathematically slices the total frame count into optimal, manageable chunks based on network availability.",
      icon: <Scissors className="w-8 h-8 text-purple-400" />,
      color: "from-purple-500/20 to-purple-500/5",
      borderColor: "border-purple-500/30"
    },
    {
      id: 3,
      title: "Node Distribution",
      description: "The chunks are securely dispatched across our global peer-to-peer network. High-performance GPUs download their assigned chunks via encrypted tunnels.",
      icon: <Network className="w-8 h-8 text-blue-400" />,
      color: "from-blue-500/20 to-blue-500/5",
      borderColor: "border-blue-500/30"
    },
    {
      id: 4,
      title: "Parallel Rendering",
      description: "Hundreds of independent nodes render your frames simultaneously. You can monitor the progress of every single frame in real-time from your dashboard.",
      icon: <Play className="w-8 h-8 text-emerald-400" />,
      color: "from-emerald-500/20 to-emerald-500/5",
      borderColor: "border-emerald-500/30"
    },
    {
      id: 5,
      title: "Merge & Delivery",
      description: "As nodes finish, they upload the final high-resolution frames. We assemble them back into pristine sequences or composite videos ready for download.",
      icon: <Download className="w-8 h-8 text-cyan-400" />,
      color: "from-cyan-500/20 to-cyan-500/5",
      borderColor: "border-cyan-500/30"
    }
  ];

  return (
    <div className="bg-[#0B0F19] min-h-screen text-white pt-24 pb-20 overflow-hidden">

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 text-center mb-24 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl aspect-square bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="relative z-10 max-w-4xl mx-auto"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
            From Scene to Render <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">in Minutes</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Experience rendering speeds 10x to 50x faster. Our seamless pipeline abstracts away the technical complexity, letting you focus entirely on your art.
          </p>
        </motion.div>
      </section>

      {/* Interactive Timeline */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl relative">

        {/* Vertical Line for Desktop */}
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent -translate-x-1/2" />

        <div className="space-y-24">
          {steps.map((step, index) => {
            const isEven = index % 2 === 0;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.7 }}
                className={`relative flex flex-col md:flex-row items-center gap-8 ${isEven ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Number Circle (Desktop) */}
                <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gray-900 border-2 border-white/10 rounded-full items-center justify-center font-bold text-xl z-20 shadow-xl">
                  {step.id}
                </div>

                {/* Content Box */}
                <div className="w-full md:w-1/2 p-4">
                  <div className={`bg-gradient-to-br ${step.color} border ${step.borderColor} backdrop-blur-sm rounded-3xl p-8 shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all`}>

                    {/* Background glow icon */}
                    <div className="absolute -right-8 -bottom-8 opacity-5 scale-150 transform group-hover:scale-110 group-hover:opacity-10 transition-all duration-700">
                      {step.icon}
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-gray-950/50 rounded-xl border border-white/5">
                        {step.icon}
                      </div>
                      <h3 className="text-2xl font-bold">{step.title}</h3>
                    </div>

                    <p className="text-gray-400 text-lg leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Spacer for structure */}
                <div className="hidden md:block w-full md:w-1/2" />
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Speed Metrics & Inline CTA */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mt-32 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          className="inline-flex flex-col items-center p-12 bg-gray-900/50 rounded-3xl border border-white/10 w-full max-w-4xl mb-16"
        >
          <div className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400 mb-4">
            10x — 50x
          </div>
          <h3 className="text-2xl font-semibold mb-2">Estimated Speed Improvement</h3>
          <p className="text-gray-400">Compared to local single-GPU rendering.</p>
        </motion.div>

        {/* Inline Join Waitlist CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="bg-gradient-to-r from-indigo-900/40 to-emerald-900/40 border border-white/10 rounded-3xl p-12 md:p-16 max-w-4xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Join 120+ users already waiting.</h2>
          <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
            Get early access to our exclusive beta. Experience the fastest rendering timeline you've ever seen, entirely powered by our secure distributed architecture.
          </p>
          <Button
            onClick={() => !isSubscribed && window.dispatchEvent(new Event('open-waitlist'))}
            disabled={isSubscribed}
            className={`text-lg px-8 py-6 rounded-2xl font-bold transition-all ${isSubscribed
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 cursor-not-allowed'
              : 'bg-white text-indigo-950 hover:bg-gray-100 hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)]'
              }`}
          >
            {isSubscribed ? "You're on the priority list!" : "Get Early Access"}
          </Button>
        </motion.div>
      </section>

    </div>
  );
};

export default HowItWorks;
