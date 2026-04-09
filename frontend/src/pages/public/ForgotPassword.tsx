import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KeyRound, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate, Link } from 'react-router-dom'
import { Input } from '@/components/ui/Input'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const { forgotPassword, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    
    const res = await forgotPassword(email)
    if (res.success) {
        setIsSubmitted(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 selection:bg-blue-500/30">
        
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <Link to="/" className="flex items-center justify-center mb-8 hover:opacity-80 transition-opacity">
            <span className="font-bold text-2xl tracking-tight">
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Render
                </span>
                <span className="text-white">OnNodes</span>
            </span>
        </Link>

        <div className="p-8 rounded-[2rem] bg-gray-900/40 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden relative group">
            
            <AnimatePresence mode="wait">
                {!isSubmitted ? (
                    <motion.form
                        key="form"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onSubmit={handleSubmit} 
                        className="relative z-10 space-y-6"
                    >
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mx-auto flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                                <KeyRound className="w-8 h-8 text-blue-500" />
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tight mb-2">Cryptographic Recovery</h1>
                            <p className="text-gray-500 text-sm font-medium">Enter the email associated with your verified wallet session.</p>
                        </div>

                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                                <ShieldCheck className="w-5 h-5 text-red-400 shrink-0" />
                                <span className="text-xs text-red-400 font-bold">{error}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black tracking-widest text-gray-500">Session Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <Input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-12 py-6 bg-black/40 border-white/5 focus:border-blue-500/50 focus:ring-blue-500/20 text-white rounded-xl"
                                        placeholder="vitalik@ethereum.org"
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading || !email}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-xl relative overflow-hidden group/btn shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all active:scale-95"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {isLoading ? "VERIFYING IDENTITY..." : "TRANSMIT RECOVERY LINK"}
                                {!isLoading && <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />}
                            </span>
                        </Button>
                        
                        <p className="text-center text-xs text-gray-500 font-medium">
                            Remembered your keys? <Link to="/login" className="text-blue-400 font-black hover:underline">Return to Login</Link>
                        </p>
                    </motion.form>
                ) : (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-8 relative z-10"
                    >
                        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Transmission Complete</h2>
                        <p className="text-gray-400 text-sm font-medium mb-8 leading-relaxed px-4">
                            If an active derivation is linked to <span className="text-white font-bold">{email}</span>, you will receive a secure transmission containing your recovery payload within 60 seconds.
                        </p>
                        <Button 
                            onClick={() => navigate('/login')}
                            variant="outline" 
                            className="border-white/10 hover:bg-white/5 font-black py-6 px-10 rounded-xl"
                        >
                            Return to Interface
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

export default ForgotPassword
