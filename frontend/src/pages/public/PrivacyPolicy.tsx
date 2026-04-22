import React from 'react'
import { motion } from 'framer-motion'
import { Shield, Lock, Eye, EyeOff, Scale } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const PrivacyPolicy = () => {
  const lastUpdated = "April 9, 2026"

  const sections = [
    {
      title: "1. Data Collection & Cryptographic Identity",
      content: "As a decentralized protocol, RenderOnNodes prioritizes pseudonymity. We collect public wallet addresses and session-level metadata necessary for on-chain interactions. Personal identifiable information (PII) is minimized and stored using industry-standard encryption where required for support interactions."
    },
    {
      title: "2. Asset Handling & Protocol Isolation",
      content: "Project files uploaded for rendering are temporarily stored in encrypted S3 instances. Access is programmatically restricted to the assigned compute node. Once a job is finalized or cancelled, source assets are flagged for permanent deletion from platform-managed storage."
    },
    {
      title: "3. Third-Party Compute Nodes",
      content: "Users acknowledge that rendering occurs on hardware owned and operated by independent Node Providers. While the protocol enforces security isolation, we cannot control the physical hardware environment of the providers. Providers are strictly prohibited from retaining client data."
    },
    {
      title: "4. Cookies & Persistent Sessions",
      content: "We use essential cookies to manage authenticated sessions and ensure the security of cryptographic derivations. We do not utilize tracking cookies for cross-site advertising or behavioral analytics."
    }
  ]

  return (
    <div className="min-h-screen bg-[#050505] pt-32 pb-40 px-4 font-sans leading-relaxed selection:bg-emerald-500/30">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20 border-b border-white/5 pb-12">
            <div>
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-emerald-500 text-[11px] font-black uppercase tracking-[0.2em] mb-4"
                >
                    <Shield className="w-4 h-4" />
                    Data Sovereignty
                </motion.div>
                <h1 className="text-5xl font-black text-white tracking-tight mb-4">Privacy Policy</h1>
                <p className="text-gray-500 text-sm font-medium">Updated on: {lastUpdated}</p>
            </div>
        </div>

        <div className="prose prose-invert max-w-none mb-20">
            <p className="text-xl text-gray-400 font-medium leading-[1.8]">
              Your privacy on a decentralized network is paramount. This policy clarifies exactly how RenderOnNodes handles your data, your assets, and your cryptographic identity within our ecosystem.
            </p>
        </div>

        <div className="space-y-16">
            {sections.map((section, idx) => (
                <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative pl-12 group"
                >
                    <div className="absolute left-0 top-0 w-8 h-8 rounded-xl bg-gray-900 border border-white/5 flex items-center justify-center text-xs font-black text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-lg">
                        {idx + 1}
                    </div>
                    <h2 className="text-2xl font-black text-white mb-6 tracking-tight group-hover:text-emerald-400 transition-colors">
                        {section.title}
                    </h2>
                    <div className="text-gray-400 text-[15px] leading-[1.8] font-medium max-w-2xl">
                        {section.content}
                    </div>
                </motion.div>
            ))}
        </div>

        <div className="mt-32 p-10 rounded-[2.5rem] bg-emerald-600/5 border border-emerald-500/20 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent" />
            <div className="relative z-10">
                <Lock className="w-8 h-8 text-emerald-500 mx-auto mb-6" />
                <h3 className="text-2xl font-black text-white mb-4">Your Data, Your Control.</h3>
                <p className="text-gray-500 text-sm font-medium mb-0 max-w-md mx-auto">
                    RenderOnNodes complies with global data protection standards (GDPR/CCPA) regarding the storage and deletion of project-related information.
                </p>
            </div>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
