// pages/public/VerifyEmail.tsx
import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Key, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'

const verifySchema = z.object({
    otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only numbers')
})

type VerifyFormData = z.infer<typeof verifySchema>

const VerifyEmailPage: React.FC = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { verifyOTP, resendOTP, isLoading, error, clearError } = useAuthStore()

    const [email, setEmail] = useState((location.state as any)?.email || '')
    const [verificationSuccess, setVerificationSuccess] = useState(false)
    const [resent, setResent] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm<VerifyFormData>({
        resolver: zodResolver(verifySchema)
    })

    const onSubmit = async (data: VerifyFormData) => {
        clearError()
        const result = await verifyOTP(email, data.otp)
        if (result.success) {
            setVerificationSuccess(true)
            setTimeout(() => {
                navigate('/')
            }, 2000)
        }
    }

    const handleResendOTP = async () => {
        clearError()
        const result = await resendOTP(email)
        if (result.success) {
            setResent(true)
            setTimeout(() => setResent(false), 3000)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950 px-4 py-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <Card className="border-gray-800 bg-gray-900/50 backdrop-blur-xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-white">
                            Verify your email
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                            We've sent a 6-digit code to {email}
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {verificationSuccess ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-8"
                            >
                                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center">
                                    <CheckCircle className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">
                                    Email Verified!
                                </h3>
                                <p className="text-gray-400">
                                    Redirecting to home page...
                                </p>
                            </motion.div>
                        ) : (
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                {error && (
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                        <div className="flex items-center gap-2 text-red-400">
                                            <AlertCircle className="w-4 h-4" />
                                            <span className="text-sm">{error}</span>
                                        </div>
                                    </div>
                                )}

                                {resent && (
                                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        <div className="flex items-center gap-2 text-emerald-400">
                                            <CheckCircle className="w-4 h-4" />
                                            <span className="text-sm">New OTP sent successfully!</span>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label htmlFor="otp" className="text-sm font-medium text-gray-300">
                                        6-digit OTP
                                    </label>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <Input
                                            id="otp"
                                            type="text"
                                            placeholder="123456"
                                            maxLength={6}
                                            className="pl-10 text-center text-lg tracking-widest bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                            disabled={isLoading}
                                            {...register('otp')}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                                                e.target.value = value
                                            }}
                                        />
                                    </div>
                                    {errors.otp && (
                                        <p className="text-sm text-red-400">{errors.otp.message}</p>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Verifying...' : 'Verify Email'}
                                </Button>

                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={handleResendOTP}
                                        className="text-sm text-emerald-400 hover:text-emerald-300 disabled:text-gray-500"
                                        disabled={isLoading || resent}
                                    >
                                        {resent ? 'Code sent!' : "Didn't receive code? Resend"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    )
}

export default VerifyEmailPage