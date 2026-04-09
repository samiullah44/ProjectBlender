import React from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, ServerOff, Globe, Download, Scale } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'

const AcceptableUse = () => {
  const navigate = useNavigate()
  const lastUpdated = "April 9, 2026"

  const sections = [
    {
      title: "1. Allowed Workloads",
      content: "RenderOnNodes is strictly architected for 3D rendering, animation computation, and approved AI inferencing pipelines. Users may upload scene files (.blend, .fbx, etc.) and associated texture assets specifically for these purposes."
    },
    {
      title: "2. Prohibited Activities",
      content: "Node Providers' hardware must not be utilized for unauthorized cryptographic mining (e.g., Proof of Work hashing), distributed denial of service (DDoS) generation, network scanning, or any activity that attempts to break the virtualization sandbox."
    },
    {
      title: "3. Content Restrictions",
      content: "While the network prioritizes censorship resistance for artistic expression, users are strictly prohibited from utilizing the distributed compute power to generate illegal imagery, child exploitation material, or content that violates international terrorism laws."
    },
    {
      title: "4. Network Abuse & Slashing",
      content: "Nodes found attempting to intercept client data, manipulate frame verification hashes, or spoof completion signals will face immediate network banishment and programmatic slashing of any locked governance stakes."
    }
  ]

  return (
    <div className="min-h-screen bg-[#030712] pt-32 pb-40 px-4 font-sans selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20 border-b border-white/5 pb-12">
            <div>
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-red-500 text-[11px] font-black uppercase tracking-[0.2em] mb-4"
                >
                    <ServerOff className="w-4 h-4" />
                    Network Integrity
                </motion.div>
                <h1 className="text-5xl font-black text-white tracking-tight mb-4">Acceptable Use</h1>
                <p className="text-gray-500 text-sm font-medium">Enforced Protocol Standards: {lastUpdated}</p>
            </div>
        </div>

        <div className="prose prose-invert max-w-none mb-20">
            <p className="text-xl text-gray-400 font-medium leading-[1.8]">
              To maintain the integrity and high performance of the decentralized compute pool, all users (Clients and Providers) must adhere to these strict execution guidelines.
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
                    <div className="absolute left-0 top-0 w-8 h-8 rounded-xl bg-gray-900 border border-white/5 flex items-center justify-center text-xs font-black text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all shadow-lg">
                        {idx + 1}
                    </div>
                    <h2 className="text-2xl font-black text-white mb-6 tracking-tight group-hover:text-red-400 transition-colors">
                        {section.title}
                    </h2>
                    <div className="text-gray-400 text-[15px] leading-[1.8] font-medium max-w-2xl">
                        {section.content}
                    </div>
                </motion.div>
            ))}
        </div>

        <div className="mt-32 p-10 rounded-[2.5rem] bg-red-600/5 border border-red-500/20 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent" />
            <div className="relative z-10 max-w-xl mx-auto">
                <ShieldAlert className="w-8 h-8 text-red-500 mx-auto mb-6" />
                <h3 className="text-2xl font-black text-white mb-4">Report Network Abuse</h3>
                <p className="text-gray-500 text-sm font-medium mb-8">
                    If you detect a node behaving maliciously or a client uploading prohibited materials, report it immediately to protect the protocol.
                </p>
                <div className="flex justify-center gap-4">
                    <Button onClick={() => window.location.href = 'mailto:security@rendernodes.io'} className="bg-red-600 hover:bg-red-500 text-white font-black py-4 px-8 rounded-xl">
                        Report to Security
                    </Button>
                    <Button onClick={() => navigate('/terms')} variant="outline" className="border-white/10 hover:bg-white/5 font-black py-4 px-8 rounded-xl">
                        View Terms
                    </Button>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}

export default AcceptableUse
