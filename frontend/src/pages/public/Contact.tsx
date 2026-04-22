import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Mail, Twitter, Linkedin, CheckCircle2, Send, Globe } from 'lucide-react'

const channels = [
  { 
    icon: Mail, 
    label: 'Email Support', 
    value: 'support@renderonnodes.io', 
    href: 'mailto:support@renderonnodes.io',
    color: 'text-blue-400', 
    bg: 'bg-blue-500/10', 
    border: 'border-blue-500/20', 
    desc: 'Typical response time: 24–48 hours' 
  },
  { 
    icon: Twitter, 
    label: 'Twitter / X', 
    value: '@RenderOnNodes', 
    href: 'https://x.com/RenderOnNodes',
    color: 'text-sky-400', 
    bg: 'bg-sky-500/10', 
    border: 'border-sky-500/20', 
    desc: 'Updates, render tips, and announcements' 
  },
  { 
    icon: Linkedin, 
    label: 'LinkedIn', 
    value: 'RenderOnNodes Network', 
    href: 'https://www.linkedin.com/company/rebderonnodes/',
    color: 'text-indigo-400', 
    bg: 'bg-indigo-500/10', 
    border: 'border-indigo-500/20', 
    desc: 'Professional updates and networking' 
  },
]

const topics = ['General Inquiry', 'Technical Support', 'Become a Node Provider', 'Business / Enterprise', 'Press & Media', 'Bug Report']

const ContactPage: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', topic: topics[0], message: '' })
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulated submission — in production connect to backend
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Hero */}
      <section className="py-28 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
        <div className="container mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="outline" className="text-blue-400 border-blue-500/30 mb-6 px-4 py-1 font-semibold">Get In Touch</Badge>
            <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">
              Let's{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Talk</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Whether you're a studio, a hardware owner, or just curious — we'd love to hear from you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Channels */}
      <section className="pb-16 bg-[#050505]">
        <div className="container mx-auto px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {channels.map((ch, i) => (
              <motion.a 
                key={i} 
                href={ch.href}
                target={ch.href.startsWith('http') ? "_blank" : undefined}
                rel={ch.href.startsWith('http') ? "noopener noreferrer" : undefined}
                initial={{ opacity: 0, y: 20 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                transition={{ delay: i * 0.1 }}
                className={`p-5 rounded-2xl border ${ch.bg} ${ch.border} flex flex-col gap-3 hover:scale-[1.02] hover:border-white/20 transition-all cursor-pointer`}
              >
                <div className={`w-10 h-10 rounded-xl ${ch.bg} flex items-center justify-center`}>
                  <ch.icon className={`w-5 h-5 ${ch.color}`} />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">{ch.label}</div>
                  <div className={`text-xs font-mono ${ch.color} mt-0.5`}>{ch.value}</div>
                  <div className="text-gray-600 text-xs mt-1">{ch.desc}</div>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="py-24 bg-[#050505]">
        <div className="container mx-auto px-6 max-w-2xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">Send a Message</h2>
            <p className="text-gray-400 mt-2">Fill out the form and we'll get back to you within 48 hours.</p>
          </div>

          {sent ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center p-12 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Message Sent!</h3>
              <p className="text-gray-400">We'll get back to you at <span className="font-semibold text-white">{form.email}</span> within 48 hours.</p>
            </motion.div>
          ) : (
            <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit}
              className="space-y-6 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Name</label>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    placeholder="Your name" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Email</label>
                  <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    placeholder="you@studio.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">Topic</label>
                <select value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm">
                  {topics.map(t => <option key={t} className="bg-gray-900">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">Message</label>
                <textarea rows={5} required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-none"
                  placeholder="Tell us what you're working on…" />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                <Send className="w-4 h-4" />
                Send Message
              </Button>
            </motion.form>
          )}
        </div>
      </section>
    </div>
  )
}

export default ContactPage
