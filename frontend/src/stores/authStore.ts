// stores/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { axiosInstance } from '@/lib/axios'
import { toast } from 'react-hot-toast'
import { websocketService } from '@/services/websocketService'

interface User {
    id: string
    email: string
    username: string
    name: string
    role: 'client' | 'node_provider' | 'admin'
    roles?: ('client' | 'node_provider' | 'admin')[]
    primaryRole?: 'client' | 'node_provider' | 'admin'
    credits: number
    tokenBalance: number
    depositTokenAddress?: string
    solanaSeed?: string
    isVerified: boolean

    provider?: 'google' | 'github' | 'local'
    nodeProvider?: {
        // nodeId?: string
        // nodeName?: string
        earnings: number
    }
    nodeProviderStatus?: 'none' | 'pending' | 'approved' | 'rejected'
    nodeProviderApplication?: {
        operatingSystem: string
        cpuModel: string
        gpuModel: string
        ramSize: number
        storageSize: number
        internetSpeed: number
        country: string
        ipAddress: string
        additionalNotes?: string
    }
    rejectionReason?: string
    stats?: {
        jobsCreated: number
        framesRendered: number
        totalSpent: number
        totalEarned: number
    }
    preferences?: {
        defaultProjectId?: string
        notificationEnabled?: boolean
    }
    createdAt: string
    lastLoginAt?: string
}

interface AuthStore {
    user: User | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null

    // Actions
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
    register: (userData: {
        email: string
        username: string
        name: string
        password: string
        role: 'client' | 'node_provider'
    }) => Promise<{ success: boolean; error?: string }>
    verifyOTP: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>
    resendOTP: (email: string) => Promise<{ success: boolean; error?: string }>
    forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>
    resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
    logout: () => void
    updateProfile: (updates: Partial<Omit<User, 'id' | 'email' | 'role'>>) => Promise<{ success: boolean; error?: string }>
    getProfile: () => Promise<{ success: boolean; error?: string }>
    setToken: (token: string) => void
    clearError: () => void

    // OAuth URLs
    getOAuthUrls: () => {
        google: string
        github: string
    }
    switchRole: (role: 'client' | 'node_provider' | 'admin') => Promise<{ success: boolean; error?: string }>
    handleOAuthCallback: () => Promise<void>
    
    // Impersonation
    impersonatingUser: { id: string; name: string; username: string } | null
    impersonate: (user: { id: string; name: string; username: string }) => void
    stopImpersonating: () => void
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            impersonatingUser: null,

            login: async (email: string, password: string) => {
                try {
                    set({ isLoading: true, error: null })

                    const response = await axiosInstance.post('/auth/login', {
                        email,
                        password
                    })

                    if (response.data.success) {
                        const { token, user } = response.data
                        localStorage.setItem('token', token)

                        set({
                            user,
                            token,
                            isAuthenticated: true,
                            isLoading: false
                        })

                        toast.success('Login successful!')
                        websocketService.authenticate(user.id)
                        return { success: true }
                    } else {
                        set({
                            error: response.data.error || 'Login failed',
                            isLoading: false
                        })
                        toast.error(response.data.error || 'Login failed')
                        return { success: false, error: response.data.error }
                    }
                } catch (error: any) {
                    console.error('Login error:', error)
                    const errorMessage = error.response?.data?.error || error.message || 'Login failed'
                    set({ error: errorMessage, isLoading: false })
                    toast.error(errorMessage)
                    return { success: false, error: errorMessage }
                }
            },

            register: async (userData) => {
                try {
                    set({ isLoading: true, error: null })

                    const response = await axiosInstance.post('/auth/register', userData)

                    if (response.data.success) {
                        set({ isLoading: false })
                        toast.success('Registration successful! Please check your email for OTP verification.')
                        return { success: true }
                    } else {
                        set({
                            error: response.data.error || 'Registration failed',
                            isLoading: false
                        })
                        toast.error(response.data.error || 'Registration failed')
                        return { success: false, error: response.data.error }
                    }
                } catch (error: any) {
                    console.error('Registration error:', error)
                    const errorMessage = error.response?.data?.error || error.message || 'Registration failed'
                    set({ error: errorMessage, isLoading: false })
                    toast.error(errorMessage)
                    return { success: false, error: errorMessage }
                }
            },

            verifyOTP: async (email: string, otp: string) => {
                try {
                    set({ isLoading: true, error: null })

                    const response = await axiosInstance.post('/auth/verify-otp', {
                        email,
                        otp
                    })

                    if (response.data.success) {
                        const { token, user } = response.data
                        localStorage.setItem('token', token)

                        set({
                            user,
                            token,
                            isAuthenticated: true,
                            isLoading: false
                        })

                        toast.success('Email verified successfully!')
                        websocketService.authenticate(user.id)
                        return { success: true }
                    } else {
                        set({
                            error: response.data.error || 'Verification failed',
                            isLoading: false
                        })
                        toast.error(response.data.error || 'Verification failed')
                        return { success: false, error: response.data.error }
                    }
                } catch (error: any) {
                    console.error('OTP verification error:', error)
                    const errorMessage = error.response?.data?.error || error.message || 'Verification failed'
                    set({ error: errorMessage, isLoading: false })
                    toast.error(errorMessage)
                    return { success: false, error: errorMessage }
                }
            },

            resendOTP: async (email: string) => {
                try {
                    set({ isLoading: true, error: null })

                    const response = await axiosInstance.post('/auth/resend-otp', { email })

                    if (response.data.success) {
                        set({ isLoading: false })
                        toast.success('New OTP sent to your email')
                        return { success: true }
                    } else {
                        set({
                            error: response.data.error || 'Failed to resend OTP',
                            isLoading: false
                        })
                        toast.error(response.data.error || 'Failed to resend OTP')
                        return { success: false, error: response.data.error }
                    }
                } catch (error: any) {
                    console.error('Resend OTP error:', error)
                    const errorMessage = error.response?.data?.error || error.message || 'Failed to resend OTP'
                    set({ error: errorMessage, isLoading: false })
                    toast.error(errorMessage)
                    return { success: false, error: errorMessage }
                }
            },

            forgotPassword: async (email: string) => {
                try {
                    set({ isLoading: true, error: null })

                    const resetUrl = `${window.location.origin}/reset-password`
                    const response = await axiosInstance.post('/auth/forgot-password', {
                        email,
                        resetUrl
                    })

                    if (response.data.success) {
                        set({ isLoading: false })
                        toast.success('Password reset email sent! Please check your inbox.')
                        return { success: true }
                    } else {
                        set({
                            error: response.data.error || 'Failed to send reset email',
                            isLoading: false
                        })
                        toast.error(response.data.error || 'Failed to send reset email')
                        return { success: false, error: response.data.error }
                    }
                } catch (error: any) {
                    console.error('Forgot password error:', error)
                    const errorMessage = error.response?.data?.error || error.message || 'Failed to send reset email'
                    set({ error: errorMessage, isLoading: false })
                    toast.error(errorMessage)
                    return { success: false, error: errorMessage }
                }
            },

            resetPassword: async (token: string, newPassword: string) => {
                try {
                    set({ isLoading: true, error: null })

                    const response = await axiosInstance.post('/auth/reset-password', {
                        token,
                        newPassword
                    })

                    if (response.data.success) {
                        set({ isLoading: false })
                        toast.success('Password reset successfully! You can now login.')
                        return { success: true }
                    } else {
                        set({
                            error: response.data.error || 'Failed to reset password',
                            isLoading: false
                        })
                        toast.error(response.data.error || 'Failed to reset password')
                        return { success: false, error: response.data.error }
                    }
                } catch (error: any) {
                    console.error('Reset password error:', error)
                    const errorMessage = error.response?.data?.error || error.message || 'Failed to reset password'
                    set({ error: errorMessage, isLoading: false })
                    toast.error(errorMessage)
                    return { success: false, error: errorMessage }
                }
            },

            logout: () => {
                localStorage.removeItem('token')
                localStorage.removeItem('impersonatingUserId')
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    impersonatingUser: null
                })
                toast.success('Logged out successfully')
            },

            impersonate: (user) => {
                localStorage.setItem('impersonatingUserId', user.id)
                set({ impersonatingUser: user })
                toast.success(`Now impersonating ${user.name}`)
                window.location.href = '/' // Force redirect to home to refresh context
            },

            stopImpersonating: () => {
                localStorage.removeItem('impersonatingUserId')
                set({ 
                    impersonatingUser: null,
                    user: null // Clear the impersonated user profile to force a fresh fetch
                })
                toast.success('Exited impersonation mode')
                window.location.href = '/admin/users' // Force fresh load to restore admin profile
            },

            updateProfile: async (updates) => {
                try {
                    set({ isLoading: true, error: null })

                    const response = await axiosInstance.put('/auth/profile', updates)

                    if (response.data.success) {
                        set(state => ({
                            user: state.user ? { ...state.user, ...response.data.user } : null,
                            isLoading: false
                        }))
                        toast.success('Profile updated successfully!')
                        return { success: true }
                    } else {
                        set({
                            error: response.data.error || 'Failed to update profile',
                            isLoading: false
                        })
                        toast.error(response.data.error || 'Failed to update profile')
                        return { success: false, error: response.data.error }
                    }
                } catch (error: any) {
                    console.error('Update profile error:', error)
                    const errorMessage = error.response?.data?.error || error.message || 'Failed to update profile'
                    set({ error: errorMessage, isLoading: false })
                    toast.error(errorMessage)
                    return { success: false, error: errorMessage }
                }
            },

            getProfile: async () => {
                try {
                    set({ isLoading: true, error: null })

                    const response = await axiosInstance.get('/auth/profile')

                    if (response.data.success) {
                        if (response.data.token) {
                            localStorage.setItem('token', response.data.token)
                            set({ token: response.data.token })
                        }
                        set({
                            user: response.data.user,
                            isLoading: false
                        })
                        websocketService.authenticate(response.data.user.id)
                        return { success: true }
                    } else {
                        set({
                            error: response.data.error || 'Failed to get profile',
                            isLoading: false
                        })
                        return { success: false, error: response.data.error }
                    }
                } catch (error: any) {
                    console.error('Get profile error:', error)
                    const errorMessage = error.response?.data?.error || error.message || 'Failed to get profile'
                    set({ error: errorMessage, isLoading: false })
                    return { success: false, error: errorMessage }
                }
            },

            setToken: (token: string) => {
                localStorage.setItem('token', token)
                set({ token, isAuthenticated: true })
            },

            clearError: () => set({ error: null }),

            switchRole: async (role) => {
                try {
                    set({ isLoading: true, error: null })
                    const response = await axiosInstance.put('/auth/primary-role', { role })

                    if (response.data.success) {
                        set(state => ({
                            user: state.user ? { ...state.user, primaryRole: role } : null,
                            isLoading: false
                        }))
                        toast.success(`Switched to ${role.replace('_', ' ')} view`)
                        return { success: true }
                    } else {
                        set({
                            error: response.data.error || 'Failed to switch role',
                            isLoading: false
                        })
                        toast.error(response.data.error || 'Failed to switch role')
                        return { success: false, error: response.data.error }
                    }
                } catch (error: any) {
                    console.error('Switch role error:', error)
                    const errorMessage = error.response?.data?.error || error.message || 'Failed to switch role'
                    set({ error: errorMessage, isLoading: false })
                    toast.error(errorMessage)
                    return { success: false, error: errorMessage }
                }
            },

            getOAuthUrls: () => {
                const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
                const redirectUrl = encodeURIComponent(window.location.origin + '/auth/callback')

                return {
                    google: `${baseUrl}/auth/google?redirectUrl=${redirectUrl}`,
                    github: `${baseUrl}/auth/github?redirectUrl=${redirectUrl}`
                }
            },

            handleOAuthCallback: async () => {
                try {
                    const params = new URLSearchParams(window.location.search)
                    const token = params.get('token')
                    const authStatus = params.get('auth')
                    const provider = params.get('provider')

                    if (token && authStatus === 'success') {
                        // Store the token
                        get().setToken(token)

                        // Get user profile
                        await get().getProfile()

                        // Clear URL parameters
                        window.history.replaceState({}, document.title, window.location.pathname)

                        toast.success(`Logged in with ${provider}!`)
                    } else if (authStatus === 'failed' || authStatus === 'error') {
                        toast.error(`Failed to authenticate with ${provider}`)
                    }
                } catch (error) {
                    console.error('OAuth callback error:', error)
                    toast.error('Authentication failed')
                }
            }
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                token: state.token,
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                impersonatingUser: state.impersonatingUser
            })
        }
    )
)