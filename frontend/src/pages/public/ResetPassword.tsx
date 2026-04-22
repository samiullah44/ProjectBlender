import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock, FileKey2, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Input } from '@/components/ui/Input'

const ResetPassword = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')
  
  const { resetPassword, isLoading, error, clearError } = useAuthStore()

  useEffect(() => {
    // If there's no token in URL, kick them out
    if (!token) {
        navigate('/login')
    }
    return () => clearError()
  }, [token, navigate, clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setLocalError('')

    if (password !== confirmPassword) {
        setLocalError('Cryptographic hashes do not match. Please verify your new password.')
        return
    }

    if (password.length < 8) {
        setLocalError('Password must be at least 8 characters to meet protocol standards.')
        return
    }
    
    if (token) {
        const res = await resetPassword(token, password)
        if (res.success) {
            navigate('/login')
        }
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 selection:bg-emerald-500/30">
        
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="p-8 rounded-[2rem] bg-gray-900/40 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden relative group">
            <motion.form
                onSubmit={handleSubmit} 
                className="relative z-10 space-y-6"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mx-auto flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                        <FileKey2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">Establish New Key</h1>
                    <p className="text-gray-500 text-sm font-medium">Your token has been verified. Create a new strong password below.</p>
                </div>

                {(error || localError) && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-red-400 shrink-0" />
                        <span className="text-xs text-red-400 font-bold">{localError || error}</span>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-gray-500">New Protocol Key</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <Input
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-12 pr-12 py-6 bg-black/40 border-white/5 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white rounded-xl font-mono"
                                placeholder="••••••••••••"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-gray-500">Verify Protocol Key</label>
                        <div className="relative">
                            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <Input
                                type={showPassword ? "text" : "password"}
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="pl-12 pr-12 py-6 bg-black/40 border-white/5 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white rounded-xl font-mono"
                                placeholder="••••••••••••"
                            />
                        </div>
                    </div>
                </div>

                <Button
                    type="submit"
                    disabled={isLoading || !password || !confirmPassword}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 rounded-xl relative overflow-hidden group/btn shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 mt-8"
                >
                    <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide">
                        {isLoading ? "COMMITTING TO BLOCKCHAIN..." : "CONFIRM NEW KEY"}
                        {!isLoading && <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />}
                    </span>
                </Button>
            </motion.form>
        </div>
      </motion.div>
    </div>
  )
}

export default ResetPassword
