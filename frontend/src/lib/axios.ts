// lib/axios.ts - UPDATED
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { getSharedToken } from './cookieUtils'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5035/api'

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor for auth tokens
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || getSharedToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const impersonatingId = localStorage.getItem('impersonatingUserId')
    if (impersonatingId) {
      config.headers['X-Impersonating-User'] = impersonatingId
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error

    // Handle 401 Unauthorized
    if (response?.status === 401) {
      // Synchronously clear all auth state from Zustand + localStorage
      // before any navigation so the persisted store is clean on next load
      const { user, token, isAuthenticated } = useAuthStore.getState()
      if (isAuthenticated || user || token) {
        useAuthStore.getState().logout(true)
      }
      // Use a custom event so the React app handles navigation via React Router
      // instead of a hard reload which would re-hydrate stale Zustand state
      const authPaths = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/auth/callback', '/admin/login']
      const isAuthPage = authPaths.some(p => window.location.pathname.startsWith(p))
      if (!isAuthPage) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      }
    }

    // Handle 403 Forbidden
    if (response?.status === 403) {
      toast.error('You do not have permission to access this resource')
    }

    // Handle 429 Rate Limit
    if (response?.status === 429) {
      toast.error('Too many requests. Please try again later.')
    }

    return Promise.reject(error)
  }
)

export default axiosInstance