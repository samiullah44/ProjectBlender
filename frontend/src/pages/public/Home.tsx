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
  Wallet,
  // Sparkles,
  ChevronLeft,
  ChevronRight as ChevronRightIcon
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// Hero images array
const HERO_IMAGES = ["/hero.jpg","/hero1.jpg"
  ]

const FEATURE_IMAGE_1 = "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=1080&q=80"
// const FEATURE_IMAGE_2 = "https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1080&q=80"
const NETWORK_IMAGE = "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1080&q=80"

const HomePage: React.FC = () => {
  const { scrollY } = useScroll()
  const [isLoaded, setIsLoaded] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  const heroY = useTransform(scrollY, [0, 500], [0, 100])
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.8])

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  // Auto-rotate hero images
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
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      {/* Navigation - No changes here */}

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Background Carousel */}
        <div className="absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentImageIndex}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              style={{ y: heroY, opacity: heroOpacity }}
              className="absolute inset-0"
            >
              <div className="absolute inset-0 " />
              <img
                src={HERO_IMAGES[currentImageIndex]}
                alt="3D Rendering Visualization"
                className="w-full h-full object-cover"
              />
            </motion.div>
          </AnimatePresence>
        </div>


        {/* Carousel Controls */}
        <div className="absolute inset-0 z-30 flex items-center justify-between px-4 md:px-8 opacity-15">
          <button
            onClick={prevImage}
            className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 hover:border-white/20 transition-all hover:scale-110 active:scale-95"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextImage}
            className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 hover:border-white/20 transition-all hover:scale-110 active:scale-95"
            aria-label="Next image"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Carousel Indicators */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30 flex gap-3">
          {HERO_IMAGES.map((_, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className="group"
              aria-label={`Go to image ${index + 1}`}
            >
              <div className="relative">
                <div className={cn(
                  "w-3 h-3 rounded-full transition-all duration-300",
                  currentImageIndex === index 
                    ? "bg-white scale-110" 
                    : "bg-white/30 hover:bg-white/50"
                )} />
                {currentImageIndex === index && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 rounded-full border-2 border-white"
                  />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Hero Content */}
        <div className="relative z-20 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-6xl mx-auto"
          >
            
            <div className="mb-8">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[0.9] tracking-tight"
              >
                  RENDER
                <motion.span
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                  className="block text-gray-100 font-extrabold tracking-wide"
                >
                  WITHOUT LIMITS
                </motion.span>
              </motion.h1>
            </div>
            
            {/* <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="text-2xl md:text-3xl font-light text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed tracking-wide"
            >
              Distribute your 3D rendering across a{' '}
              <span className="font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                global network
              </span>{' '}
              of high-performance nodes. Achieve{' '}
              <span className="font-semibold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                production-quality
              </span>{' '}
              results in minutes, not days.
            </motion.p> */}
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center"
            >
              <Button 
                size="lg" 
                className="group relative overflow-hidden bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 hover:from-emerald-700 hover:via-cyan-700 hover:to-blue-700 px-7 py-3.5 text-lg font-semibold rounded-2xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95"
              >
                <span className="relative z-10 flex items-center">
                  Start Rendering
                  <ChevronRight className="w-8 h-5 pt-1 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
              
              {/* <Button 
                size="lg" 
                variant="outline" 
                className="px-10 py-6 text-lg font-semibold rounded-xl border-2 border-white/20 hover:border-white/40 hover:bg-white/5 backdrop-blur-sm transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <Rocket className="w-5 h-5 mr-3" />
                Join as Node Provider
              </Button> */}
            </motion.div>
          </motion.div>
        </div>

         
      </section>

      {/* Stats Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="py-20 bg-gradient-to-b from-black to-gray-900"
      >
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section id="features" className="py-32">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Professional-Grade <span className="text-blue-400">Rendering</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Built for studios and professionals who demand reliability, speed, and quality.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">Performance</span>
                </div>
                <h3 className="text-3xl font-bold">Lightning Fast GPU Acceleration</h3>
                <p className="text-gray-400 leading-relaxed">
                  Leverage NVIDIA RTX, CUDA, and OptiX across our global network. 
                  Render complex scenes with ray tracing in record time.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                {performanceFeatures.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-colors"
                  >
                    <feature.icon className="w-6 h-6 text-blue-400 mb-3" />
                    <div className="font-medium">{feature.title}</div>
                    <div className="text-sm text-gray-400">{feature.description}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden border border-white/10">
                <img
                  src={FEATURE_IMAGE_1}
                  alt="GPU Rendering Visualization"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              </div>
              
              {/* Floating card */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -bottom-6 -right-6 p-6 bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 shadow-2xl"
              >
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

          {/* Network Section */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative order-2 lg:order-1"
            >
              <div className="relative rounded-2xl overflow-hidden border border-white/10">
                <img
                  src={NETWORK_IMAGE}
                  alt="Global Network Nodes"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8 order-1 lg:order-2"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-400">Network</span>
                </div>
                <h3 className="text-3xl font-bold">Global Distributed Network</h3>
                <p className="text-gray-400 leading-relaxed">
                  Tap into a worldwide network of high-performance nodes. 
                  Our intelligent load balancing ensures optimal performance 24/7.
                </p>
              </div>
              
              <div className="space-y-4">
                {networkFeatures.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4"
                  >
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

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="py-32 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-purple-900/10 to-black" />
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
        </div>
        
        <div className="relative container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-gray-900/50 to-black/50 backdrop-blur-xl rounded-3xl border border-white/10 p-12 shadow-2xl"
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Ready to Transform Your <span className="text-blue-400">Workflow</span>?
              </h2>
              <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
                Join thousands of studios and artists who've accelerated their rendering pipeline.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  Start Free Trial
                  <Rocket className="w-5 h-5 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="border-white/20 hover:bg-white/5">
                  Schedule a Demo
                </Button>
              </div>
              
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Cpu className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold">
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Blender
                </span>
                <span className="text-white">Farm</span>
              </span>
              <div className="text-xs text-gray-500 ml-4">
                © 2024 BlenderFarm. All rights reserved.
              </div>
            </div>
            
            <div className="flex gap-8 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Security</a>
              <a href="#" className="hover:text-white transition-colors">Status</a>
              <a href="#" className="hover:text-white transition-colors">Docs</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

const stats = [
  { value: "90%", label: "Faster Rendering" },
  { value: "500+", label: "Active Nodes" },
  { value: "24/7", label: "Uptime" },
  { value: "99.9%", label: "Reliability" }
]

const performanceFeatures = [
  {
    icon: Zap,
    title: "GPU Accelerated",
    description: "NVIDIA RTX & CUDA support"
  },
  {
    icon: Clock,
    title: "Real-time Progress",
    description: "Frame-by-frame tracking"
  },
  {
    icon: Shield,
    title: "Secure",
    description: "End-to-end encryption"
  },
  {
    icon: Wallet,
    title: "Cost Effective",
    description: "Pay per frame"
  }
]

const networkFeatures = [
  {
    icon: Users,
    title: "Global Network",
    description: "Nodes across 15+ countries"
  },
  {
    icon: Cloud,
    title: "Auto-scaling",
    description: "Scale resources dynamically"
  },
  {
    icon: BarChart3,
    title: "Smart Load Balancing",
    description: "Optimized job distribution"
  }
]

export default HomePage