// lib/axios.ts - UPDATED
import axios from 'axios'
import { toast } from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

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
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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
      // Clear auth state
      localStorage.removeItem('token')
      // Don't redirect if we're already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
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