// pages/public/OAuthCallback.tsx
import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'

const OAuthCallback: React.FC = () => {
    const navigate = useNavigate()
    const { handleOAuthCallback } = useAuthStore()

    useEffect(() => {
        const processCallback = async () => {
            try {
                await handleOAuthCallback()
                navigate('/dashboard', { replace: true })
            } catch (error) {
                console.error('OAuth callback error:', error)
                toast.error('Authentication failed. Please try again.')
                navigate('/login', { replace: true })
            }
        }

        processCallback()
    }, [handleOAuthCallback, navigate])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center"
            >
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                    Authenticating...
                </h1>
                <p className="text-gray-400">
                    Please wait while we complete your authentication
                </p>
            </motion.div>
        </div>
    )
}

export default OAuthCallback