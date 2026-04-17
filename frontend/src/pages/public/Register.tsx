// pages/public/Register.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, User, Lock, Eye, EyeOff, Hash, AlertCircle, Github, Chrome } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { useAuthStore } from '@/stores/authStore'
import { Checkbox } from '@/components/ui/Checkbox'
import { analytics } from '@/services/analytics'

const registerSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(20, 'Username must be at most 20 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string(),
    role: z.enum(['client', 'node_provider']),
    rememberMe: z.boolean().optional()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

type RegisterFormData = z.infer<typeof registerSchema>

const RegisterPage: React.FC = () => {
    const navigate = useNavigate()
    const { register: registerUser, isLoading, error, clearError, getOAuthUrls } = useAuthStore()
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isOAuthLoading, setIsOAuthLoading] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
        setValue
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            role: 'client',
            rememberMe: false
        }
    })

    useEffect(() => {
        // Load remembered email
        const rememberedEmail = localStorage.getItem('rememberedEmail')
        if (rememberedEmail) {
            setValue('email', rememberedEmail)
            setValue('rememberMe', true)
        }
    }, [setValue])

    const onSubmit = async (data: RegisterFormData) => {
        clearError()

        // Handle Remember Me
        if (data.rememberMe) {
            localStorage.setItem('rememberedEmail', data.email)
        } else {
            localStorage.removeItem('rememberedEmail')
        }

        const { confirmPassword, rememberMe, ...registerData } = data
        const result = await registerUser(registerData)

        if (result.success) {
            navigate('/verify-email', {
                state: { email: data.email }
            })
        }
    }

    const handleOAuthRegister = (provider: 'google' | 'github') => {
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
                            Create an account
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                            Join our distributed rendering platform
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {/* OAuth Buttons */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full border-gray-700 hover:bg-gray-800"
                                onClick={() => handleOAuthRegister('google')}
                                disabled={isOAuthLoading}
                            >
                                <Chrome className="w-4 h-4 mr-2" />
                                Google
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full border-gray-700 hover:bg-gray-800"
                                onClick={() => handleOAuthRegister('github')}
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
                                    Or sign up with email
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="username" className="text-sm font-medium text-gray-300">
                                        Username
                                    </label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <Input
                                            id="username"
                                            type="text"
                                            placeholder="john_doe"
                                            className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                            disabled={isLoading}
                                            {...register('username')}
                                        />
                                    </div>
                                    {errors.username && (
                                        <p className="text-sm text-red-400">{errors.username.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="name" className="text-sm font-medium text-gray-300">
                                        Full Name
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <Input
                                            id="name"
                                            type="text"
                                            placeholder="John Doe"
                                            className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                            disabled={isLoading}
                                            {...register('name')}
                                        />
                                    </div>
                                    {errors.name && (
                                        <p className="text-sm text-red-400">{errors.name.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="role" className="text-sm font-medium text-gray-300">
                                    Account Type
                                </label>
                                <Select
                                    defaultValue="client"
                                    onValueChange={(value: 'client' | 'node_provider') =>
                                        setValue('role', value)
                                    }
                                >
                                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                                        <SelectValue placeholder="Select account type" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border-gray-700 text-white">
                                        <SelectItem value="client">Client - Render your projects</SelectItem>
                                        <SelectItem value="node_provider">Node Provider - Rent your GPU</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="password" className="text-sm font-medium text-gray-300">
                                        Password
                                    </label>
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

                                <div className="space-y-2">
                                    <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-300">
                                        Confirm Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <Input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            className="pl-10 pr-10 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                            disabled={isLoading}
                                            {...register('confirmPassword')}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                        >
                                            {showConfirmPassword ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.confirmPassword && (
                                        <p className="text-sm text-red-400">{errors.confirmPassword.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                                <p className="text-sm text-gray-400">
                                    Password must contain:
                                </p>
                                <ul className="mt-1 text-xs text-gray-400 space-y-1">
                                    <li className={`flex items-center gap-2 ${watch('password')?.length >= 8 ? 'text-emerald-400' : ''}`}>
                                        <div className={`w-1 h-1 rounded-full ${watch('password')?.length >= 8 ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                        At least 8 characters
                                    </li>
                                    <li className={`flex items-center gap-2 ${/[A-Z]/.test(watch('password') || '') ? 'text-emerald-400' : ''}`}>
                                        <div className={`w-1 h-1 rounded-full ${/[A-Z]/.test(watch('password') || '') ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                        One uppercase letter
                                    </li>
                                    <li className={`flex items-center gap-2 ${/[a-z]/.test(watch('password') || '') ? 'text-emerald-400' : ''}`}>
                                        <div className={`w-1 h-1 rounded-full ${/[a-z]/.test(watch('password') || '') ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                        One lowercase letter
                                    </li>
                                    <li className={`flex items-center gap-2 ${/[0-9]/.test(watch('password') || '') ? 'text-emerald-400' : ''}`}>
                                        <div className={`w-1 h-1 rounded-full ${/[0-9]/.test(watch('password') || '') ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                        One number
                                    </li>
                                    <li className={`flex items-center gap-2 ${/[^A-Za-z0-9]/.test(watch('password') || '') ? 'text-emerald-400' : ''}`}>
                                        <div className={`w-1 h-1 rounded-full ${/[^A-Za-z0-9]/.test(watch('password') || '') ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                        One special character
                                    </li>
                                </ul>
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
                                onClick={() => analytics.trackClick('register_submit')}
                            >
                                {isLoading ? 'Creating account...' : 'Create Account'}
                            </Button>
                        </form>

                        <div className="mt-6 text-center text-sm">
                            <span className="text-gray-400">Already have an account?</span>{' '}
                            <Link
                                to="/login"
                                className="font-medium text-emerald-400 hover:text-emerald-300"
                            >
                                Sign in
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    )
}

export default RegisterPage