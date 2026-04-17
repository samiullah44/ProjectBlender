import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Mail, Eye, EyeOff, ShieldAlert, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const AdminLogin: React.FC = () => {
  const navigate = useNavigate()
  const { login, logout, user, isLoading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)

  // If already logged in as admin, go straight to admin dashboard
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        // Logged in but not admin — kick them out
        setAccessDenied(true)
        logout()
      }
    }
  }, [user, navigate, logout])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setAccessDenied(false)
    const result = await login(email, password)
    if (!result.success) return
    // Role check happens in the useEffect above once `user` updates
  }

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <ShieldAlert className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
          <p className="text-sm text-gray-500 mt-1">Restricted area — authorised personnel only</p>
        </div>

        {/* Error states */}
        {accessDenied && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            Access denied. This portal is for admins only.
          </div>
        )}
        {error && !accessDenied && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@email.com"
              required
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-gray-900/60 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
              className="w-full pl-10 pr-10 py-3 bg-gray-900/60 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

export default AdminLogin
