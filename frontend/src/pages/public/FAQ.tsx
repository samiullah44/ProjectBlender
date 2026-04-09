import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, ChevronDown, Plus, Minus, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const FAQ = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = [
    {
      question: "What is RenderOnNodes?",
      answer: "RenderOnNodes is a decentralized compute marketplace that connects 3D artists with high-performance GPU node providers. We use blockchain-based escrow to ensure safe and transparent transactions."
    },
    {
      question: "How do tokens (mRNDR) work?",
      answer: "mRNDR is the native utility credit of our network. You deposit USDC to get mRNDR, which is then locked in escrow when you start a job and released to providers frame-by-frame."
    },
    {
      question: "Are my project files secure?",
      answer: "Yes. Files are uploaded to encrypted S3 buckets. Only the assigned Node Provider has access to download the assets required for rendering, and they are automatically deleted after a set period."
    },
    {
      question: "How can I become a Node Provider?",
      answer: "You can apply through the 'Apply Node Provider' link in the Client Dashboard. We review your hardware specs (Minimum RTX 3060 or equivalent) and network stability before approval."
    },
    {
      question: "What happens if a render fails?",
      answer: "Our system detects failures automatically. If a node fails to deliver verified frames, the job is automatically reassigned and you are only charged for successfully completed frames."
    }
  ]

  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.answer.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-950 pt-32 pb-20 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
        >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-6">
                <HelpCircle className="w-3 h-3" />
                Support Center
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent mb-8">
                Frequently Asked Questions
            </h1>
            
            <div className="relative max-w-xl mx-auto">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                    placeholder="Search for answers..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-900 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
            </div>
        </motion.div>

        <div className="space-y-4">
            {filteredFaqs.map((faq, index) => (
                <div 
                    key={index}
                    className="rounded-2xl bg-gray-900/40 border border-white/5 overflow-hidden transition-all hover:bg-white/5"
                >
                    <button 
                        onClick={() => setOpenIndex(openIndex === index ? null : index)}
                        className="w-full px-8 py-6 flex items-center justify-between text-left group"
                    >
                        <span className="font-bold text-white group-hover:text-blue-400 transition-colors">
                            {faq.question}
                        </span>
                        <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                            openIndex === index ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500"
                        )}>
                            {openIndex === index ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </div>
                    </button>
                    <AnimatePresence>
                        {openIndex === index && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                            >
                                <div className="px-8 pb-6 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                                    {faq.answer}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </div>

        {filteredFaqs.length === 0 && (
            <div className="text-center py-20 text-gray-500">
                No results found for "{searchTerm}". Try searching for 'tokens' or 'security'.
            </div>
        )}

        <div className="mt-20 p-8 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-center text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-all" />
            <h3 className="text-2xl font-bold mb-2">Can't find what you're looking for?</h3>
            <p className="opacity-80 mb-8 text-sm max-w-md mx-auto">Our specialized engineering team is available 24/7 to assist with complex rendering issues or custom deployments.</p>
            <Button onClick={() => window.location.href = 'mailto:support@rendernodes.io'} className="bg-white text-blue-600 hover:bg-gray-100 font-black px-10 py-6 rounded-2xl shadow-2xl">
                Contact Support
            </Button>
        </div>
      </div>
    </div>
  )
}

export default FAQ
