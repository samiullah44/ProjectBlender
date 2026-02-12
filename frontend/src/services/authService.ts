// services/authService.ts
import { axiosInstance } from '@/lib/axios'

export interface LoginCredentials {
    email: string
    password: string
}

export interface RegisterData {
    email: string
    username: string
    name: string
    password: string
    role: 'client' | 'node_provider'
}

export interface UserProfile {
    id: string
    email: string
    username: string
    name: string
    role: 'client' | 'node_provider' | 'admin'
    roles?: ('client' | 'node_provider' | 'admin')[]
    primaryRole?: 'client' | 'node_provider' | 'admin'
    credits: number
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

export interface Application {
    _id: string
    name: string
    email: string
    nodeProviderApplicationDate: string
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
}

export interface AuthResponse {
    success: boolean
    token?: string
    user?: UserProfile
    message?: string
    error?: string
    applications?: Application[]
}

class AuthService {
    // Login with email and password
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        try {
            const response = await axiosInstance.post<AuthResponse>('/auth/login', credentials)
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Register new user
    async register(userData: RegisterData): Promise<AuthResponse> {
        try {
            const response = await axiosInstance.post<AuthResponse>('/auth/register', userData)
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Verify OTP
    async verifyOTP(email: string, otp: string): Promise<AuthResponse> {
        try {
            const response = await axiosInstance.post<AuthResponse>('/auth/verify-otp', {
                email,
                otp
            })
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Resend OTP
    async resendOTP(email: string): Promise<AuthResponse> {
        try {
            const response = await axiosInstance.post<AuthResponse>('/auth/resend-otp', { email })
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Forgot password
    async forgotPassword(email: string): Promise<AuthResponse> {
        try {
            const resetUrl = `${window.location.origin}/reset-password`
            const response = await axiosInstance.post<AuthResponse>('/auth/forgot-password', {
                email,
                resetUrl
            })
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Reset password
    async resetPassword(token: string, newPassword: string): Promise<AuthResponse> {
        try {
            const response = await axiosInstance.post<AuthResponse>('/auth/reset-password', {
                token,
                newPassword
            })
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Get user profile
    async getProfile(): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
        try {
            const response = await axiosInstance.get<{ success: boolean; user?: UserProfile; error?: string }>('/auth/profile')
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Update user profile
    async updateProfile(updates: Partial<Omit<UserProfile, 'id' | 'email' | 'role'>>): Promise<AuthResponse> {
        try {
            const response = await axiosInstance.put<AuthResponse>('/auth/profile', updates)
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Apply as Node Provider
    async applyAsNodeProvider(applicationData: {
        operatingSystem: string
        cpuModel: string
        gpuModel: string
        ramSize: number
        storageSize: number
        internetSpeed: number
        country: string
        ipAddress: string
        additionalNotes?: string
    }): Promise<AuthResponse> {
        try {
            const response = await axiosInstance.post<AuthResponse>('/auth/apply-node-provider', applicationData)
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Get Applications (Admin)
    async getApplications(): Promise<AuthResponse> {
        try {
            const response = await axiosInstance.get<AuthResponse>('/auth/admin/applications')
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Approve Application (Admin)
    async approveApplication(userId: string): Promise<AuthResponse> {
        try {
            const response = await axiosInstance.post<AuthResponse>(`/auth/admin/applications/${userId}/approve`)
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Reject Application (Admin)
    async rejectApplication(userId: string, reason: string): Promise<AuthResponse> {
        try {
            const response = await axiosInstance.post<AuthResponse>(`/auth/admin/applications/${userId}/reject`, { reason })
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Update Primary Role
    async updatePrimaryRole(role: 'client' | 'node_provider' | 'admin'): Promise<AuthResponse> {
        try {
            const response = await axiosInstance.put<AuthResponse>('/auth/primary-role', { role })
            return response.data
        } catch (error: any) {
            throw this.handleError(error)
        }
    }

    // Validate token
    async validateToken(): Promise<boolean> {
        try {
            const response = await axiosInstance.get('/auth/health')
            return response.status === 200
        } catch (error) {
            return false
        }
    }

    // Get OAuth URLs
    getOAuthUrls(): { google: string; github: string } {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
        const redirectUrl = encodeURIComponent(window.location.origin + '/auth/callback')

        return {
            google: `${baseUrl}/auth/google?redirectUrl=${redirectUrl}`,
            github: `${baseUrl}/auth/github?redirectUrl=${redirectUrl}`
        }
    }

    // Handle OAuth callback
    handleOAuthCallback(): { token: string | null; authStatus: string | null; provider: string | null } {
        const params = new URLSearchParams(window.location.search)
        return {
            token: params.get('token'),
            authStatus: params.get('auth'),
            provider: params.get('provider')
        }
    }

    // Clear OAuth parameters from URL
    clearOAuthParams(): void {
        window.history.replaceState({}, document.title, window.location.pathname)
    }

    // Helper: Validate email
    validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    // Helper: Validate password
    validatePassword(password: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = []

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long')
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter')
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter')
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number')
        }
        if (!/[^A-Za-z0-9]/.test(password)) {
            errors.push('Password must contain at least one special character')
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }

    // Helper: Error handling
    private handleError(error: any): Error {
        if (error.response) {
            // Server responded with error
            return new Error(error.response.data.error || error.response.data.message || 'Server error')
        } else if (error.request) {
            // Request made but no response
            return new Error('Network error. Please check your connection.')
        } else {
            // Something else happened
            return new Error(error.message || 'An unexpected error occurred')
        }
    }
}

export const authService = new AuthService()