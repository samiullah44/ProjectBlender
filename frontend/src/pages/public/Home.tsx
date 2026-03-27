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
  Monitor,
  Network,
  Database,
  Layers,
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  MousePointer2,
  HardDrive,
  CheckCircle2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'
import SEO from '../../components/SEO'

// --- Data Constants ---
const HERO_IMAGES = ["/hero.jpg", "/hero1.jpg", "/hero3.png", "/hero2.png"]
const FEATURE_IMAGE_1 = "/gpu.png"
const NETWORK_IMAGE = "/network.png"

const stats = [
  { value: "90%", label: "Faster Rendering" },
  { value: "500+", label: "Active Nodes" },
  { value: "24/7", label: "Uptime" },
  { value: "99.9%", label: "Reliability" }
]

const performanceFeatures = [
  { icon: Zap, title: "GPU Accelerated", description: "NVIDIA RTX & CUDA support" },
  { icon: Clock, title: "Real-time Progress", description: "Frame-by-frame tracking" },
  { icon: Shield, title: "Secure", description: "End-to-end encryption" },
  { icon: Wallet, title: "Cost Effective", description: "Pay per frame" }
]

const networkFeatures = [
  { icon: Users, title: "Global Network", description: "Nodes across 15+ countries" },
  { icon: Cloud, title: "Auto-scaling", description: "Scale resources dynamically" },
  { icon: BarChart3, title: "Smart Load Balancing", description: "Optimized job distribution" }
]

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
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImageIndex}
            initial={isLoaded ? { opacity: 0, scale: 1.1 } : false}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            style={{ y: heroY, opacity: heroOpacity }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 " />
            <img
              src={HERO_IMAGES[currentImageIndex]}
              alt="3D Rendering"
              className="w-full h-full object-cover"
              fetchPriority={currentImageIndex === 0 ? "high" : "auto"}
              loading={currentImageIndex === 0 ? "eager" : "lazy"}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute inset-0 z-30 flex items-center justify-between px-4 md:px-8 opacity-15">
        <button onClick={prevImage} className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 hover:border-white/20 transition-all hover:scale-110 active:scale-95" aria-label="Previous image">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={nextImage} className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 hover:border-white/20 transition-all hover:scale-110 active:scale-95" aria-label="Next image">
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

      <div className="relative z-20 container mx-auto px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-6xl mx-auto">
          <div className="mb-8">
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[0.9] tracking-tight">
              RENDER
              <motion.span initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="block text-gray-100 font-extrabold tracking-wide">
                WITHOUT LIMITS
              </motion.span>
            </motion.h1>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.2 }} className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link to="/client/dashboard">
              <Button size="lg" className="group relative overflow-hidden bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 hover:from-emerald-700 hover:via-cyan-700 hover:to-blue-700 px-7 py-3.5 text-lg font-semibold rounded-2xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95">
                <span className="relative z-10 flex items-center">
                  Start Rendering
                  <ChevronRight className="w-8 h-5 pt-1 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

const ProjectConceptSection: React.FC = () => {
  return (
    <section className="py-24 relative overflow-hidden border-y border-white/5">
      <div className="absolute inset-0 bg-[#0A0A0B]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

      <div className="relative container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-6">
            <Badge variant="outline" className="text-purple-400 border-purple-500/30 font-mono uppercase tracking-tighter">Project Concept</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              A Global Mesh of <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Rendering Intelligence</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              RenderOnNodes isn't just a platform; it's a decentralized ecosystem. We bridge the gap between <span className="text-white font-medium">3D Artists</span> who need massive computational power and <span className="text-white font-medium">Hardware Owners</span> with idle high-end GPUs.
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
                <h4 className="text-white font-semibold mb-1">Dynamic Scaling</h4>
                <p className="text-xs text-gray-500">Instantly scale from 1 to 500+ GPUs based on project urgency.</p>
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
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center"
                  >
                    <Cpu className="w-10 h-10 text-white" />
                  </motion.div>

                  <div className="flex gap-4">
                    {[Network, Database, Server].map((Icon, i) => (
                      <motion.div
                        key={i}
                        initial={{ y: 0 }}
                        animate={{ y: [-5, 5, -5] }}
                        transition={{ duration: 4, delay: i * 0.5, repeat: Infinity, ease: "easeInOut" }}
                        className="w-14 h-14 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center backdrop-blur-sm"
                      >
                        <Icon className="w-6 h-6 text-gray-400" />
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
    <section className="py-24 bg-black relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold text-white mb-4">Streamlined Workflow</h2>
          <p className="text-gray-500 font-mono tracking-widest uppercase text-xs">From Project Upload to Final Render</p>
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-y-1/2" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {[
              { step: "01", title: "Upload Pack", desc: "Bundle your .blend file with all packed textures.", icon: <Layers className="w-6 h-6" /> },
              { step: "02", title: "Distribute", desc: "Our engine breaks your project into frame-chunks.", icon: <Zap className="w-6 h-6" /> },
              { step: "03", title: "Compute", desc: "GPUs worldwide render your frames in parallel.", icon: <Cpu className="w-6 h-6" /> },
              { step: "04", title: "Download", desc: "Get your high-res frames back instantly.", icon: <CheckCircle2 className="w-6 h-6" /> },
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
    <section className="py-24 relative overflow-hidden bg-black/50 border-y border-white/5">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <Badge variant="outline" className="text-blue-400 border-blue-500/30 mb-4 px-4 py-1">Join the Ecosystem</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Choose Your Path</h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">Whether you need massive computing power or want to monetize your idle hardware, RenderOnNodes has you covered.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Client Path */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group relative rounded-3xl overflow-hidden p-[1px] bg-gradient-to-b from-white/10 to-transparent hover:from-emerald-500/30 transition-colors duration-500"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-full bg-[#0d0d12] backdrop-blur-xl rounded-[23px] p-8 flex flex-col items-start border border-white/5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center mb-6">
                <Layers className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">I Need Rendering Power</h3>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Connect to thousands of GPUs instantly. Upload your Blender projects and get high-quality frames rendered in a fraction of the time.
              </p>
              <div className="mt-auto pt-4 w-full">
                <Link to="/client/dashboard" className="w-full">
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
            className="group relative rounded-3xl overflow-hidden p-[1px] bg-gradient-to-b from-white/10 to-transparent hover:from-purple-500/30 transition-colors duration-500"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-full bg-[#0d0d12] backdrop-blur-xl rounded-[23px] p-8 flex flex-col items-start border border-white/5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30 flex items-center justify-center mb-6">
                <Rocket className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">I Have Idle Hardware</h3>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Turn your high-end GPU into a passive income stream. Join the network securely, contribute computing power, and earn credits for every frame rendered.
              </p>
              <div className="mt-auto pt-4 w-full">
                <Link to="/apply-node-provider" className="w-full">
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
    <section id="features" className="py-32">
      <div className="container mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 mb-4 px-4 py-1">Advanced Features</Badge>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-white">
            Professional-Grade <span className="text-emerald-400">Rendering Engine</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Built for studios and professionals who demand industrial reliability, extreme speed, and uncompromised quality.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
          <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-400">Performance</span>
              </div>
              <h3 className="text-3xl font-bold">Lightning Fast GPU Acceleration</h3>
              <p className="text-gray-400 leading-relaxed">
                Leverage NVIDIA RTX, CUDA, and OptiX across our global network. Render complex scenes with ray tracing in record time.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {performanceFeatures.map((feature, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-colors">
                  <feature.icon className="w-6 h-6 text-blue-400 mb-3" />
                  <div className="font-medium">{feature.title}</div>
                  <div className="text-sm text-gray-400">{feature.description}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
            <div className="relative rounded-2xl overflow-hidden border border-white/10">
              <img src={FEATURE_IMAGE_1} alt="GPU Rendering" className="w-full h-auto" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            </div>

            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="absolute -bottom-6 -right-6 p-6 bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-xs text-gray-400">Average Speed Increase</div>
                  <div className="text-2xl font-bold">12.5x</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative order-2 lg:order-1">
            <div className="relative rounded-2xl overflow-hidden border border-white/10">
              <img src={NETWORK_IMAGE} alt="Global Network Nodes" className="w-full h-auto" />
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

// --- Main Component ---
const HomePage: React.FC = () => {
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
      <DualCTASection />
      <FeaturesSection />
    </div>
  )
}

export default HomePage
