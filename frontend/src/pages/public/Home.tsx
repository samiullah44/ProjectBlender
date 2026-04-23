import React, { useEffect, useState } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import {
  Cpu,
  Zap,
  Cloud,
  Users,
  Shield,
  Rocket,
  ChevronRight,
  BarChart3,
  Globe,
  Clock,
  Server,
  Wallet,
  Network,
  Database,
  Layers,
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  CheckCircle2,
  Box,
  Blend
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'
import SEO from '../../components/SEO'
import { analytics } from '@/services/analytics'
import { useScrollTracking } from '@/hooks/useAnalytics'

import IncomeCalculator from '@/components/ui/IncomeCalculator'

// --- Data Constants ---
const HERO_IMAGES = ["/hero.webp", "/hero2.webp", "/hero1.webp", "/hero3.webp"]
const FEATURE_IMAGE_1 = "/gpu.webp"
const NETWORK_IMAGE = "/network.webp"

const performanceFeatures = [
  { icon: Zap, title: "OptiX & CUDA Supported", description: "Native hardware acceleration" },
  { icon: Clock, title: "Real-time Frame Ticker", description: "Watch your render progress live" },
  { icon: Shield, title: "Asset Security", description: "End-to-end encryption for your blends" },
  { icon: Wallet, title: "Cost Effective", description: "Pay perfectly per frame rendered" }
]

const networkFeatures = [
  { icon: Users, title: "Global Mesh Network", description: "Vetted GPUs across multiple continents" },
  { icon: Cloud, title: "Elastic Scaling", description: "On-demand power that grows with your project" },
  { icon: BarChart3, title: "Smart Orchestration", description: "Optimized job distribution protocols" }
]

// --- Custom Blender SVG Icons ---
const BlenderIcon = ({ className }: { className?: string }) => (
  <img src="/blender-icon.svg" alt="Blender Logo" className={className} width="24" height="24" />
)

// --- Section Components ---

const HeroSection: React.FC = () => {
  const { scrollY } = useScroll()
  const [isLoaded, setIsLoaded] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  const heroY = useTransform(scrollY, [0, 500], [0, 100])
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.8])

  useEffect(() => { setIsLoaded(true) }, [])

  useEffect(() => {
    if (!isAutoPlaying) return
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % HERO_IMAGES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [isAutoPlaying])

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % HERO_IMAGES.length)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + HERO_IMAGES.length) % HERO_IMAGES.length)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const goToImage = (index: number) => {
    setCurrentImageIndex(index)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      <motion.div className="absolute inset-0 z-0" style={{ y: heroY, opacity: heroOpacity }}>
        {HERO_IMAGES.map((src, index) => (
          <motion.div
            key={src}
            initial={false}
            animate={{ 
              opacity: currentImageIndex === index ? 1 : 0,
              scale: currentImageIndex === index ? 1 : 1.1,
              zIndex: currentImageIndex === index ? 10 : 0
            }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute inset-0 bg-gray-950/40" />
            <img
              src={src}
              alt="3D Rendering"
              className="w-full h-full object-cover"
              fetchPriority={index === 0 ? "high" : "auto"}
              loading={index === 0 ? "eager" : "lazy"}
              width="1200"
              height="1200"
            />
          </motion.div>
        ))}
      </motion.div>

      <div className="absolute inset-0 z-30 flex items-center justify-between px-4 md:px-8 opacity-15 pointer-events-none">
        <button onClick={prevImage} className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 hover:border-white/20 transition-all hover:scale-110 active:scale-95 pointer-events-auto" aria-label="Previous image">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={nextImage} className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 hover:border-white/20 transition-all hover:scale-110 active:scale-95 pointer-events-auto" aria-label="Next image">
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30 flex gap-3">
        {HERO_IMAGES.map((_, index) => (
          <button key={index} onClick={() => goToImage(index)} className="group" aria-label={`Go to image ${index + 1}`}>
            <div className="relative">
              <div className={cn("w-3 h-3 rounded-full transition-all duration-300", currentImageIndex === index ? "bg-white scale-110" : "bg-white/30 hover:bg-white/50")} />
              {currentImageIndex === index && (
                <motion.div layoutId="activeIndicator" className="absolute inset-0 rounded-full border-2 border-white" />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="relative z-20 container mx-auto px-5 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-6xl mx-auto">
          <div className="mb-6 flex justify-center">
            <span className="px-4 py-1.5 rounded-full bg-[#EA7600]/10 border border-[#EA7600]/60 text-[#EA7600] font-bold text-sm tracking-widest flex items-center gap-2 backdrop-blur-xl">
              <BlenderIcon className="w-5 h-5 object-contain" /> Blender it. Render it
            </span>
          </div>
          <div className="mb-8">
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[0.9] tracking-tight">
              RENDER
              <motion.span initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="block text-gray-100 font-extrabold tracking-wide">
                WITHOUT LIMITS
              </motion.span>
            </motion.h1>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Link to="/client/dashboard">
              <Button size="lg" className="group relative overflow-hidden bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 hover:from-emerald-700 hover:via-cyan-700 hover:to-blue-700 px-7 py-3.5 text-lg font-semibold rounded-2xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95">
                <span className="relative z-10 flex items-center">
                  Start Rendering
                  <ChevronRight className="w-8 h-5 pt-1 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </Link>
          </motion.div>

          {/* Engine Badges */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex flex-wrap justify-center gap-6 items-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/50 backdrop-blur-xl border border-white/10 text-gray-300 font-semibold shadow-lg">
              <Cpu className="w-5 h-5 text-blue-400" />
              Cycles Engine
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/50 backdrop-blur-xl border border-white/10 text-gray-300 font-semibold shadow-lg">
              <BlenderIcon className="w-5 h-5 text-orange-400" />
              Blender LTS 4.5+ Supported
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/50 backdrop-blur-xl border border-white/10 text-gray-300 font-semibold shadow-lg">
              <Zap className="w-5 h-5 text-emerald-400" />
              Eevee Engine
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

const ProjectConceptSection: React.FC = () => {
  return (
    <section className="py-24 relative overflow-hidden border-y border-white/5">
      <div className="absolute inset-0 bg-gray-950" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />

      <div className="relative container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-6">
            <Badge variant="outline" className="text-purple-400 border-purple-500/30 font-mono uppercase tracking-tighter">Project Concept</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              Unleash the Power of <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Cycles & Eevee</span>
              {" "}Networks
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Built exclusively for Blender artists. We bridge the gap between 3D Studios who need massive computational power and hardware owners with idle high-end GPUs. No complex setups—just upload your packed <span className="text-white font-mono bg-white/10 px-1 py-0.5 rounded">.blend</span> project and watch the magic happen.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                  <Database className="w-5 h-5 text-purple-400" />
                </div>
                <h4 className="text-white font-semibold mb-1">Asset Security</h4>
                <p className="text-xs text-gray-500">End-to-end encrypted frame distribution across the mesh.</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
                  <Network className="w-5 h-5 text-emerald-400" />
                </div>
                <h4 className="text-white font-semibold mb-1">Dynamic GPU Scaling</h4>
                <p className="text-xs text-gray-500">Instantly distribute your sequence across our global network of nodes.</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative aspect-square max-w-md mx-auto lg:mx-0">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-emerald-500/20 rounded-full blur-3xl" />
            <div className="relative h-full flex items-center justify-center">
              <div className="relative w-full aspect-square border border-white/10 rounded-3xl bg-black/40 backdrop-blur-md overflow-hidden flex flex-col p-8 justify-center">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
                <div className="relative z-10 flex flex-col items-center justify-center space-y-8">
                  <motion.div
                    animate={{ boxShadow: ['0 0 0 0 rgba(168,85,247,0.4)', '0 0 0 20px rgba(168,85,247,0)'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center"
                  >
                    <BlenderIcon className="w-12 h-12 text-white" />
                  </motion.div>

                  <div className="flex gap-4">
                    {[Cpu, Database, Server].map((Icon, i) => (
                      <motion.div
                        key={i}
                        initial={{ y: 0 }}
                        animate={{ y: [-5, 5, -5] }}
                        transition={{ duration: 4, delay: i * 0.5, repeat: Infinity, ease: "easeInOut" }}
                        className="w-14 h-14 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center backdrop-blur-sm"
                      >
                        <Icon className="w-6 h-6 text-gray-300" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

const WorkflowSection: React.FC = () => {
  return (
    <section className="py-24 bg-[#050505] relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold text-white mb-4">Streamlined Blender Workflow</h2>
          <p className="text-gray-500 font-mono tracking-widest uppercase text-xs">From Project Upload to Final Render Output</p>
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent -translate-y-1/2" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {[
              { step: "01", title: "Upload Pack", desc: "Bundle your .blend file with all packed textures.", icon: <Layers className="w-6 h-6" /> },
              { step: "02", title: "Distribute", desc: "Our engine breaks your project into frame-chunks.", icon: <Zap className="w-6 h-6" /> },
              { step: "03", title: "Compute", desc: "GPUs worldwide render your frames via Cycles/Eevee.", icon: <Cpu className="w-6 h-6" /> },
              { step: "04", title: "Download", desc: "Get your high-res frames back instantly in EXR, PNG, or formats.", icon: <CheckCircle2 className="w-6 h-6" /> },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="relative group p-6 rounded-2xl bg-gray-900/50 border border-white/5 hover:border-white/10 transition-all hover:-translate-y-1">
                <div className="text-4xl font-black text-white/5 absolute top-4 right-6 group-hover:text-purple-500/10 transition-colors font-mono">{item.step}</div>
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-all">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const DualCTASection: React.FC = () => {
  return (
    <section className="py-24 relative overflow-hidden bg-[#0A0A0B] border-y border-white/5">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <Badge variant="outline" className="text-blue-400 border-blue-500/30 mb-4 px-4 py-1 font-semibold">Join the 3D Ecosystem</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Choose Your Path</h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">Whether you need massive computing power for an animation sequence or want to monetize your idle 3D workstation.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* 
            TEMPORARY ACCESS CONTROL:
            The handlers below intercept navigation to restricted dashboards and instead 
            trigger the site-wide WaitlistPopup. 
            
            TO REVERT TO LIVE ACCESS:
            Search for 'handleRestrictedCTA' and remove e.preventDefault() logic.
          */}
          
          {/* Client Path */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group relative rounded-3xl overflow-hidden p-[1px] bg-gradient-to-b from-white/10 to-transparent hover:from-orange-500/50 transition-colors duration-500"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-full bg-[#0d0d12] backdrop-blur-xl rounded-[23px] p-8 flex flex-col items-start border border-white/5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center mb-6">
                <BlenderIcon className="w-7 h-7 text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">I Need Rendering Power</h3>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Connect to thousands of GPUs instantly. Upload your Blender projects and get high-quality frames rendered in a fraction of the time with native support.
              </p>
              <div className="mt-auto pt-4 w-full">
                <Link
                  to="/client/dashboard"
                  className="w-full"
                  onClick={(e) => {
                    // Start of Temporary Restriction
                    e.preventDefault(); 
                    analytics.trackClick('home_cta_client');
                    window.dispatchEvent(new CustomEvent('open-waitlist'));
                    // End of Temporary Restriction
                  }}
                >
                  <Button className="w-full bg-white/5 hover:bg-emerald-600 text-white border border-white/10 hover:border-emerald-500 transition-all duration-300 py-6">
                    Access Rendering Dashboard <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Provider Path */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="group relative rounded-3xl overflow-hidden p-[1px] bg-gradient-to-b from-white/10 to-transparent hover:from-blue-500/50 transition-colors duration-500"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-full bg-[#0d0d12] backdrop-blur-xl rounded-[23px] p-8 flex flex-col items-start border border-white/5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center mb-6">
                <Rocket className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">I Have Idle Hardware</h3>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Turn your high-end GPU or workstation into a passive income stream. Join the network securely, crunch blender frames, and earn credits automatically.
              </p>
              <div className="mt-auto pt-4 w-full">
                <Link
                  to="/apply-node-provider"
                  className="w-full"
                  onClick={(e) => {
                    // Start of Temporary Restriction
                    e.preventDefault();
                    analytics.trackClick('home_cta_provider');
                    window.dispatchEvent(new CustomEvent('open-waitlist'));
                    // End of Temporary Restriction
                  }}
                >
                  <Button className="w-full bg-white/5 hover:bg-purple-600 text-white border border-white/10 hover:border-purple-500 transition-all duration-300 py-6">
                    Become a Node Provider <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="py-32 bg-[#050505]">
      <div className="container mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <Badge variant="outline" className="text-orange-400 border-orange-500/30 mb-4 px-4 py-1 font-semibold">Native Support</Badge>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-white">
            Professional-Grade <span className="text-orange-400">Blender Integration</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Built for 3D studios and professionals who demand industrial reliability, extreme speed, and uncompromised rendering quality.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
          <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-cyan-400">Performance Focus</span>
              </div>
              <h3 className="text-4xl font-bold text-white">True GPU Acceleration</h3>
              <p className="text-gray-400 leading-relaxed text-lg">
                Leverage NVIDIA RTX, CUDA, and OptiX directly across our global network to render complex fluid simulations and ray-traced scenes in record time.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {performanceFeatures.map((feature, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="p-5 rounded-2xl bg-gray-900/40 border border-white/5 hover:border-orange-500/30 transition-colors shadow-lg">
                  <feature.icon className="w-7 h-7 text-orange-400 mb-3" />
                  <div className="font-bold text-white mb-1">{feature.title}</div>
                  <div className="text-sm text-gray-500">{feature.description}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
              <img src={FEATURE_IMAGE_1} alt="GPU Rendering" className="w-full h-auto" width="800" height="600" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
            </div>

            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="absolute -bottom-6 -left-6 lg:-right-6 lg:left-auto p-6 bg-gray-900 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-inner border border-white/20">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-sm text-gray-400 font-semibold mb-1">Compute Boost</div>
                  <div className="text-3xl font-black text-white tracking-tighter">Industrial Speed</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative order-2 lg:order-1">
            <div className="relative rounded-2xl overflow-hidden border border-white/10">
              <img src={NETWORK_IMAGE} alt="Global Network Nodes" className="w-full h-auto" width="800" height="600" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-8 order-1 lg:order-2">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
                <Globe className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Network</span>
              </div>
              <h3 className="text-3xl font-bold">Global Distributed Network</h3>
              <p className="text-gray-400 leading-relaxed">
                Tap into a worldwide network of high-performance nodes. Our intelligent load balancing ensures optimal performance 24/7.
              </p>
            </div>

            <div className="space-y-4">
              {networkFeatures.map((feature, index) => (
                <motion.div key={index} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-medium">{feature.title}</div>
                    <div className="text-sm text-gray-400">{feature.description}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

const EarningsSection: React.FC = () => {
  return (
    <section className="py-24 relative overflow-hidden bg-black/40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.05),transparent)] pointer-events-none" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 mb-4 px-4 py-1">Node Operators</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Turn Your Hardware into <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400">Passive Income</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Discover your rig's monetization score and unlock your hardware's full earning capacity in the RenderOnNodes distributed ecosystem.
          </p>
        </div>
        
        <IncomeCalculator />
        
          <div className="mt-16 flex flex-wrap justify-center gap-12 text-center opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
            <div className="flex flex-col items-center">
              <div className="text-2xl font-bold text-white">Any GPU</div>
              <div className="text-xs uppercase tracking-widest text-gray-500">Supported</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-2xl font-bold text-white">Global</div>
              <div className="text-xs uppercase tracking-widest text-gray-500">Mesh Access</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-2xl font-bold text-white">Instant</div>
              <div className="text-xs uppercase tracking-widest text-gray-500">Connectivity</div>
            </div>
          </div>
      </div>
    </section>
  )
}

// --- Main Component ---
const HomePage: React.FC = () => {
  useScrollTracking();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <SEO
        title="Distributed GPU Render Farm"
        description="Join RenderOnNodes to contribute GPU power to the decentralized render network. Earn rewards as a node operator or submit rendering jobs at scale."
        canonical="/"
      />
      {/* Navigation - No changes here */}

      <HeroSection />
      <ProjectConceptSection />
      <WorkflowSection />
      <EarningsSection />
      <DualCTASection />
      <FeaturesSection />
    </div>
  )
}

export default HomePage
