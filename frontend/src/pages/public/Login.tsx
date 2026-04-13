// pages/public/Login.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock, AlertCircle, Github, Chrome } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { Checkbox } from '@/components/ui/Checkbox'
import { toast } from 'react-hot-toast'

const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional()
})

type LoginFormData = z.infer<typeof loginSchema>

const LoginPage: React.FC = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { login, isAuthenticated, isLoading, error, clearError, getOAuthUrls } = useAuthStore()
    const [showPassword, setShowPassword] = useState(false)
    const [isOAuthLoading, setIsOAuthLoading] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            rememberMe: false
        }
    })

    const from = (location.state as any)?.from?.pathname || '/'

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/', { replace: true })
            return
        }
        clearError()

        // Load remembered email
        const rememberedEmail = localStorage.getItem('rememberedEmail')
        if (rememberedEmail) {
            setValue('email', rememberedEmail)
            setValue('rememberMe', true)
        }
    }, [isAuthenticated, navigate, setValue, clearError])

    const onSubmit = async (data: LoginFormData) => {
        // Handle Remember Me
        if (data.rememberMe) {
            localStorage.setItem('rememberedEmail', data.email)
        } else {
            localStorage.removeItem('rememberedEmail')
        }

        const result = await login(data.email, data.password)
        if (result.success) {
            navigate('/', { replace: true })
        }
    }

    const handleOAuthLogin = (provider: 'google' | 'github') => {
        setIsOAuthLoading(true)
        const urls = getOAuthUrls()
        window.location.href = urls[provider]
    }

    const oauthUrls = getOAuthUrls()

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
                            Welcome back
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                            Enter your credentials to access your account
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {/* OAuth Buttons */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full border-gray-700 hover:bg-gray-800"
                                onClick={() => handleOAuthLogin('google')}
                                disabled={isOAuthLoading}
                            >
                                <Chrome className="w-4 h-4 mr-2" />
                                Google
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full border-gray-700 hover:bg-gray-800"
                                onClick={() => handleOAuthLogin('github')}
                                disabled={isOAuthLoading}
                            >
                                <Github className="w-4 h-4 mr-2" />
                                GitHub
                            </Button>
                        </div>

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-700"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-gray-900 text-gray-400">
                                    Or continue with email
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <div className="flex items-center gap-2 text-red-400">
                                        <AlertCircle className="w-4 h-4" />
                                        <span className="text-sm">{error}</span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium text-gray-300">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                        disabled={isLoading}
                                        {...register('email')}
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-sm text-red-400">{errors.email.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="password" className="text-sm font-medium text-gray-300">
                                        Password
                                    </label>
                                    <Link
                                        to="/forgot-password"
                                        className="text-sm text-emerald-400 hover:text-emerald-300"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className="pl-10 pr-10 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                        disabled={isLoading}
                                        {...register('password')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-sm text-red-400">{errors.password.message}</p>
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <Checkbox
                                    id="rememberMe"
                                    label="Remember me"
                                    {...register('rememberMe')}
                                    checked={watch('rememberMe')}
                                    onChange={(checked) => setValue('rememberMe', checked)}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Signing in...' : 'Sign In'}
                            </Button>
                        </form>

                        <div className="mt-6 text-center text-sm">
                            <span className="text-gray-400">Don't have an account?</span>{' '}
                            <Link
                                to="/register"
                                className="font-medium text-emerald-400 hover:text-emerald-300"
                            >
                                Sign up
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    )
}

export default LoginPage