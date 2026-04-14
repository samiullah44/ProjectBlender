import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Clock, ArrowRight, Tag } from 'lucide-react'
import { Link } from 'react-router-dom'

type BlogTag = 'All' | 'Tutorial' | 'News' | 'Engineering' | 'Artist Spotlight'
const TAGS: BlogTag[] = ['All', 'Tutorial', 'News', 'Engineering', 'Artist Spotlight']

const posts = [
  {
    slug: 'getting-started-blender-render-farm',
    tag: 'Tutorial' as BlogTag,
    title: 'Getting Started: Your First Render on RenderOnNodes',
    excerpt: 'A step-by-step guide to packing your .blend file, uploading to the network, and downloading your final EXR frames in under 10 minutes.',
    date: 'Apr 10, 2025',
    readTime: '8 min read',
    emoji: '🚀',
    gradient: 'from-emerald-500 to-cyan-500',
  },
  {
    slug: 'cycles-vs-eevee-network-performance',
    tag: 'Engineering' as BlogTag,
    title: 'Cycles vs Eevee on Distributed Nodes: A Performance Deep Dive',
    excerpt: 'We benchmarked both engines across 50+ GPU configurations to understand how render time, VRAM usage, and output quality differ at scale.',
    date: 'Apr 5, 2025',
    readTime: '12 min read',
    emoji: '⚡',
    gradient: 'from-blue-500 to-purple-500',
  },
  {
    slug: 'solana-on-chain-payments-rendering',
    tag: 'Engineering' as BlogTag,
    title: 'Why We Built Payments on Solana — Not Stripe',
    excerpt: 'Traditional payment processors add 2–7 days settlement delays. On-chain Solana credits settle in seconds. Here\'s how and why we built it.',
    date: 'Mar 28, 2025',
    readTime: '10 min read',
    emoji: '🔗',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    slug: 'artist-spotlight-neo-tokyo',
    tag: 'Artist Spotlight' as BlogTag,
    title: 'Artist Spotlight: How Studio Kaze Rendered Neo-Tokyo in 28 Minutes',
    excerpt: 'We sat down with Kaze\'s lead artist to talk volumetric fog, path-traced lighting at 8K, and how the distributed network changed their pipeline.',
    date: 'Mar 20, 2025',
    readTime: '6 min read',
    emoji: '🏙️',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    slug: 'node-provider-setup-guide-2025',
    tag: 'Tutorial' as BlogTag,
    title: 'Node Provider Setup Guide 2025: RTX 4090 Configuration',
    excerpt: 'Everything you need to configure a high-earning render node on Windows or Linux — from CUDA drivers to the RenderOnNodes agent install.',
    date: 'Mar 15, 2025',
    readTime: '15 min read',
    emoji: '🖥️',
    gradient: 'from-gray-500 to-slate-600',
  },
  {
    slug: 'network-expansion-15-countries',
    tag: 'News' as BlogTag,
    title: 'RenderOnNodes Now Live in 15 Countries with 500+ GPU Nodes',
    excerpt: 'We\'ve just crossed 500 active GPU nodes spanning 15 countries — with average render speeds up 3× since Q1.',
    date: 'Mar 8, 2025',
    readTime: '3 min read',
    emoji: '🌐',
    gradient: 'from-teal-500 to-emerald-500',
  },
]

const BlogPage: React.FC = () => {
  const [activeTag, setActiveTag] = useState<BlogTag>('All')
  const filtered = activeTag === 'All' ? posts : posts.filter(p => p.tag === activeTag)

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Hero */}
      <section className="py-28 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
        <div className="container mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="outline" className="text-purple-400 border-purple-500/30 mb-6 px-4 py-1 font-semibold">Blog</Badge>
            <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">
              Render{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Insights</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Tutorials, engineering deep-dives, artist spotlights, and network announcements.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Tags */}
      <div className="pb-12">
        <div className="container mx-auto px-6 flex flex-wrap justify-center gap-3">
          {TAGS.map(tag => (
            <button key={tag} onClick={() => setActiveTag(tag)}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTag === tag ? 'bg-white text-gray-900 shadow-lg' : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white hover:bg-white/10'
              }`}>
              <Tag className="w-3.5 h-3.5" />
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Post */}
      <section className="pb-12">
        <div className="container mx-auto px-6">
          {filtered.length > 0 && (
            <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="group relative rounded-3xl overflow-hidden border border-white/5 hover:border-white/10 transition-all mb-8 cursor-pointer">
              <div className={`h-64 bg-gradient-to-br ${filtered[0].gradient} flex items-center justify-center`}>
                <div className="text-9xl">{filtered[0].emoji}</div>
              </div>
              <div className="p-8 bg-gray-900/60">
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant="outline" className="text-purple-400 border-purple-500/30 text-xs">{filtered[0].tag}</Badge>
                  <span className="text-gray-500 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{filtered[0].readTime}</span>
                  <span className="text-gray-600 text-xs">{filtered[0].date}</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-purple-400 transition-colors">{filtered[0].title}</h2>
                <p className="text-gray-400 leading-relaxed max-w-3xl">{filtered[0].excerpt}</p>
                <div className="mt-6 flex items-center gap-2 text-purple-400 font-semibold text-sm">
                  Read Article <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Posts Grid */}
      <section className="pb-32">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.slice(1).map((post, i) => (
              <motion.div key={post.slug} layout initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="group cursor-pointer rounded-2xl bg-gray-900/60 border border-white/5 hover:border-purple-500/30 overflow-hidden transition-all hover:-translate-y-1">
                <div className={`h-40 bg-gradient-to-br ${post.gradient} flex items-center justify-center`}>
                  <div className="text-6xl">{post.emoji}</div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant="outline" className="text-gray-400 border-white/10 text-xs">{post.tag}</Badge>
                    <span className="text-gray-600 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{post.readTime}</span>
                  </div>
                  <h3 className="text-white font-bold leading-snug mb-2 group-hover:text-purple-400 transition-colors">{post.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">{post.excerpt}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
                    <span>{post.date}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-24 bg-[#0A0A0B] border-t border-white/10 text-center">
        <div className="container mx-auto px-6 max-w-xl">
          <h2 className="text-3xl font-bold text-white mb-3">Stay up to date</h2>
          <p className="text-gray-400 mb-8">Get new tutorials and network updates delivered to your inbox.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="email" placeholder="your@email.com"
              className="flex-1 px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
            <Button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 font-bold rounded-xl whitespace-nowrap shadow-lg shadow-purple-500/20">Subscribe</Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default BlogPage
