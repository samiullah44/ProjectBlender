import React from 'react'
import { motion } from 'framer-motion'
import { FileText, Shield, Scale, Info, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'

const TermsOfService = () => {
  const navigate = useNavigate()
  const lastUpdated = "April 9, 2026"

  const sections = [
    {
      title: "1. Acceptance of Protocol Terms",
      content: "By accessing the RenderOnNodes decentralized compute protocol, you irrevocably agree to be bound by these Terms of Service. If you do not agree with any of these terms, you are prohibited from utilizing the protocol and its associated interfaces."
    },
    {
      title: "2. Decentralized Compute Marketplace",
      content: "RenderOnNodes operates as a non-custodial marketplace connecting Compute Clients with Node Providers. The platform does not directly provide rendering services and is not liable for the uptime, performance, or availability of independently operated compute nodes."
    },
    {
      title: "3. On-Chain Escrow & Credits",
      content: "All financial interactions are governed by the Render Network Smart Contract system. Credits (mRNDR) are locked in a programmatic escrow upon job initiation and released frame-by-frame. Users acknowledge that on-chain transactions are irreversible."
    },
    {
      title: "4. Node Provider Responsibilities",
      content: "Node Providers must maintain the technical specifications declared during onboarding. Failure to deliver verified frames will result in automatic job reassignment and potential degradation of Trust Score within the protocol reputation system."
    },
    {
      title: "5. Intellectual Property & Privacy",
      content: "Clients retain full ownership of all assets (S3) uploaded for rendering. Node Providers are programmatically restricted from unauthorized data retention, but the protocol cannot mathematically guarantee absolute file isolation on external hardware."
    }
  ]

  return (
    <div className="min-h-screen bg-[#050505] pt-32 pb-40 px-4 font-sans leading-relaxed selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20 border-b border-white/5 pb-12">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-blue-500 text-[11px] font-black uppercase tracking-[0.2em] mb-4"
            >
              <Scale className="w-4 h-4" />
              Protocol Governance
            </motion.div>
            <h1 className="text-5xl font-black text-white tracking-tight mb-4">Terms of Service</h1>
            <p className="text-gray-500 text-sm font-medium">Last substantive revision: {lastUpdated}</p>
          </div>
        </div>

        {/* Narrative Intro */}
        <div className="prose prose-invert max-w-none mb-20">
          <p className="text-xl text-gray-400 font-medium leading-[1.8]">
            This document outlines the rules, responsibilities, and legal framework governing the interaction between users and the RenderOnNodes decentralized infrastructure. Please read carefully before initializing any on-chain escrows.
          </p>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-16">
          {sections.map((section, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative pl-12 group"
            >
              <div className="absolute left-0 top-0 w-8 h-8 rounded-xl bg-gray-900 border border-white/5 flex items-center justify-center text-xs font-black text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg">
                {idx + 1}
              </div>
              <h2 className="text-2xl font-black text-white mb-6 tracking-tight group-hover:text-blue-400 transition-colors">
                {section.title}
              </h2>
              <div className="text-gray-400 text-[15px] leading-[1.8] font-medium max-w-2xl">
                {section.content}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Callout */}
        <div className="mt-32 p-10 rounded-[2.5rem] bg-blue-600/5 border border-blue-500/20 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full -ml-32 -mt-32 blur-3xl opacity-50" />
          <div className="relative z-10 max-w-xl mx-auto">
            <Info className="w-8 h-8 text-blue-500 mx-auto mb-6" />
            <h3 className="text-2xl font-black text-white mb-4">Questions about these terms?</h3>
            <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed px-10">
              Our compliance team is available to clarify any aspects of the protocol governance or escrow logic. Contact us at <span className="text-blue-400 font-black underline cursor-pointer">legal@rendernodes.io</span>
            </p>
            <div className="flex justify-center flex-wrap gap-4">
              <Button onClick={() => window.location.href = 'mailto:legal@rendernodes.io'} className="bg-white text-black hover:bg-gray-100 font-black py-4 px-8 rounded-xl">Contact Legal</Button>
              <Button onClick={() => navigate('/faq')} variant="outline" className="border-white/10 hover:bg-white/5 font-black py-4 px-8 rounded-xl">View FAQ</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TermsOfService
