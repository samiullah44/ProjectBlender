// stores/jobStore.ts - UPDATED
import { create } from 'zustand'
import axios from 'axios'
import { toast } from 'react-hot-toast'

interface Frame {
  frame: number
  url: string
  s3Key: string
  fileSize: number
  uploadedAt: string
  freshUrl?: string
}

export interface Job {
  jobId: string
  projectId: string
  userId: string
  blendFileName: string
  blendFileKey: string
  blendFileUrl: string
  type: 'image' | 'animation'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  settings: {
    engine: string
    device: string
    samples: number
    resolutionX: number
    resolutionY: number
    tileSize: number
    outputFormat: string
    denoiser?: string
    selectedFrame?: number
    creditsPerFrame?: number
  }
  frames: {
    start: number
    end: number
    total: number
    selected: number[]
    rendered: number[]
    failed: number[]
    assigned: number[]
  }
  outputUrls: Frame[]
  assignedNodes: Record<string, number[]>
  frameAssignments: Array<{
    frame: number
    nodeId: string
    status: 'assigned' | 'rendered' | 'failed'
    assignedAt: string
    completedAt?: string
    renderTime?: number
    creditsEarned?: number
    s3Key?: string
  }>
  createdAt: string
  updatedAt: string
  completedAt?: string
}

interface JobStore {
  jobs: Job[]
  currentJob: Job | null
  isLoading: boolean
  error: string | null
  webSocketConnected: boolean

  // Actions
  createJob: (formData: FormData) => Promise<{ success: boolean; data?: any; error?: string }>
  getJob: (jobId: string) => Promise<Job | null>
  listJobs: (params?: { 
    projectId?: string; 
    status?: string; 
    page?: number; 
    limit?: number 
  }) => Promise<{ jobs: Job[]; pagination: any }>
  cancelJob: (jobId: string, cleanupS3?: boolean) => Promise<boolean>
  selectFrames: (jobId: string, frames: number[]) => Promise<boolean>
  getDashboardStats: () => Promise<{
    totalJobs: number
    activeJobs: number
    completedJobs: number
    failedJobs: number
    completedToday: number
    totalRenderTime: number
    totalCreditsUsed: number
    totalFramesRendered: number
    avgRenderTimePerFrame: number
    framesRenderedToday: number
  }>
  
  // Real-time updates
  updateJobProgress: (jobId: string, updates: Partial<Job>) => void
  addJob: (job: Job) => void
  removeJob: (jobId: string) => void
  
  // WebSocket
  setWebSocketConnected: (connected: boolean) => void
  
  // Utility
  refreshJobs: () => Promise<void>
  clearError: () => void
  clearCurrentJob: () => void
}

const API_BASE_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:3000/api'

const jobStore = create<JobStore>((set, get) => ({
  jobs: [],
  currentJob: null,
  isLoading: false,
  error: null,
  webSocketConnected: false,

  createJob: async (formData: FormData) => {
    try {
      set({ isLoading: true, error: null })
      
      const response = await axios.post(`${API_BASE_URL}/jobs/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000,
      })
      
      if (response.data.success) {
        const newJob: Job = {
          jobId: response.data.jobId,
          projectId: response.data.projectId,
          userId: 'default-user', // You might want to get this from auth
          blendFileName: response.data.blendFileName || 'uploaded_file.blend',
          blendFileKey: response.data.fileStructure.blendFile,
          blendFileUrl: response.data.blendFileUrl,
          type: response.data.type,
          status: 'pending',
          progress: 0,
          settings: response.data.settings,
          frames: {
            start: response.data.settings?.startFrame || 1,
            end: response.data.settings?.endFrame || 1,
            total: response.data.totalFrames,
            selected: response.data.selectedFrames || [],
            rendered: [],
            failed: [],
            assigned: []
          },
          outputUrls: [],
          assignedNodes: {},
          frameAssignments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        set(state => ({ 
          jobs: [newJob, ...state.jobs],
          currentJob: newJob,
          isLoading: false 
        }))
        
        toast.success('Job created successfully!')
        return { success: true, data: response.data }
      } else {
        set({ error: response.data.error || 'Failed to create job', isLoading: false })
        toast.error(response.data.error || 'Failed to create job')
        return { success: false, error: response.data.error }
      }
    } catch (error: any) {
      console.error('Error creating job:', error)
      
      let errorMessage = 'Failed to create job'
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.message) {
        errorMessage = error.message
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please try again.'
      }
      
      set({ error: errorMessage, isLoading: false })
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  },

  getJob: async (jobId: string) => {
    try {
      set({ isLoading: true, error: null })
      
      const response = await axios.get(`${API_BASE_URL}/jobs/${jobId}`)
      
      const job: Job = response.data
      set({ 
        currentJob: job,
        isLoading: false 
      })
      
      // Update in jobs list if exists
      set(state => ({
        jobs: state.jobs.map(j => 
          j.jobId === jobId ? job : j
        )
      }))
      
      return job
    } catch (error: any) {
      console.error('Error fetching job:', error)
      const errorMessage = error.response?.data?.error || 'Failed to fetch job'
      set({ error: errorMessage, isLoading: false })
      toast.error(errorMessage)
      return null
    }
  },

  listJobs: async (params = {}) => {
    try {
      set({ isLoading: true, error: null })
      
      const response = await axios.get(`${API_BASE_URL}/jobs`, { params })
      
      const jobs = response.data.jobs || []
      set({ jobs, isLoading: false })
      return response.data
    } catch (error: any) {
      console.error('Error listing jobs:', error)
      const errorMessage = error.response?.data?.error || 'Failed to list jobs'
      set({ error: errorMessage, isLoading: false })
      return { jobs: [], pagination: { total: 0, page: 1, limit: 50, pages: 0 } }
    }
  },

  cancelJob: async (jobId: string, cleanupS3 = false) => {
    try {
      set({ isLoading: true, error: null })
      
      const response = await axios.delete(`${API_BASE_URL}/jobs/${jobId}`, {
        data: { cleanupS3 }
      })
      
      set({ isLoading: false })
      
      if (response.data.success) {
        // Update job status in store
        set(state => ({
          jobs: state.jobs.map(job => 
            job.jobId === jobId 
              ? { ...job, status: 'cancelled' }
              : job
          ),
          currentJob: state.currentJob?.jobId === jobId 
            ? { ...state.currentJob, status: 'cancelled' }
            : state.currentJob
        }))
        
        toast.success('Job cancelled successfully')
        return true
      }
      
      toast.error('Failed to cancel job')
      return false
    } catch (error: any) {
      console.error('Error cancelling job:', error)
      const errorMessage = error.response?.data?.error || 'Failed to cancel job'
      set({ error: errorMessage, isLoading: false })
      toast.error(errorMessage)
      return false
    }
  },

  selectFrames: async (jobId: string, frames: number[]) => {
    try {
      set({ isLoading: true, error: null })
      
      const response = await axios.post(`${API_BASE_URL}/jobs/${jobId}/select-frames`, { frames })
      
      set({ isLoading: false })
      
      if (response.data.success) {
        // Update job in store
        set(state => ({
          jobs: state.jobs.map(job => 
            job.jobId === jobId 
              ? { 
                  ...job, 
                  frames: {
                    ...job.frames,
                    selected: frames,
                    total: frames.length
                  },
                  progress: Math.round((job.frames.rendered.length / frames.length) * 100)
                }
              : job
          )
        }))
        
        toast.success('Frames selected successfully')
        return true
      }
      
      toast.error('Failed to select frames')
      return false
    } catch (error: any) {
      console.error('Error selecting frames:', error)
      const errorMessage = error.response?.data?.error || 'Failed to select frames'
      set({ error: errorMessage, isLoading: false })
      toast.error(errorMessage)
      return false
    }
  },

  getDashboardStats: async () => {
    try {
      set({ isLoading: true, error: null })
      
      const response = await axios.get(`${API_BASE_URL}/jobs/dashboard/stats`)
      
      set({ isLoading: false })
      return response.data.stats
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error)
      const errorMessage = error.response?.data?.error || 'Failed to fetch dashboard stats'
      set({ error: errorMessage, isLoading: false })
      
      return {
        totalJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        completedToday: 0,
        totalRenderTime: 0,
        totalCreditsUsed: 0,
        totalFramesRendered: 0,
        avgRenderTimePerFrame: 0,
        framesRenderedToday: 0
      }
    }
  },

  updateJobProgress: (jobId: string, updates: Partial<Job>) => {
    set(state => ({
      jobs: state.jobs.map(job => 
        job.jobId === jobId 
          ? { ...job, ...updates, updatedAt: new Date().toISOString() }
          : job
      ),
      currentJob: state.currentJob?.jobId === jobId 
        ? { ...state.currentJob, ...updates, updatedAt: new Date().toISOString() }
        : state.currentJob
    }))
  },

  addJob: (job: Job) => {
    set(state => ({
      jobs: [job, ...state.jobs],
      currentJob: job
    }))
  },

  removeJob: (jobId: string) => {
    set(state => ({
      jobs: state.jobs.filter(job => job.jobId !== jobId),
      currentJob: state.currentJob?.jobId === jobId ? null : state.currentJob
    }))
  },

  setWebSocketConnected: (connected: boolean) => {
    set({ webSocketConnected: connected })
  },

  refreshJobs: async () => {
    await get().listJobs({ limit: 50, page: 1 })
  },

  clearError: () => set({ error: null }),
  clearCurrentJob: () => set({ currentJob: null })
}))

export default jobStore