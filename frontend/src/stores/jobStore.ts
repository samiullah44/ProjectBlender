// stores/jobStore.ts - UPDATED
import { create } from 'zustand'
import { axiosInstance } from '@/lib/axios'
import { toast } from 'react-hot-toast'
import { uploadService } from '@/services/uploadService'

interface Frame {
  frame: number
  url: string
  s3Key: string
  fileSize: number
  uploadedAt: string
  freshUrl?: string
}

interface JobSettings {
  engine: 'CYCLES' | 'EEVEE'
  device: 'CPU' | 'GPU'
  samples: number
  resolutionX: number
  resolutionY: number
  tileSize: number
  outputFormat: 'PNG' | 'JPEG' | 'EXR' | 'TIFF' | 'TARGA' | 'BMP' | 'OPEN_EXR'
  colorMode: 'BW' | 'RGB' | 'RGBA'
  colorDepth: '8' | '16' | '32'
  compression: number
  exrCodec?: 'ZIP' | 'PIZ' | 'RLE' | 'ZIPS' | 'BXR' | 'DWAA' | 'DWAB'
  tiffCodec?: 'NONE' | 'PACKBITS' | 'DEFLATE' | 'LZW'
  denoiser?: 'NONE' | 'OPTIX' | 'OPENIMAGEDENOISE' | 'NLM'
  selectedFrame?: number
  creditsPerFrame: number
  scene?: string
  camera?: string
}

export interface Job {
  jobId: string
  projectId: string
  userId: string
  blendFileName: string
  blendFileKey: string
  blendFileUrl: string
  type: 'image' | 'animation'
  status: 'pending' | 'pending_payment' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  settings: {
    engine: string
    device: string
    samples: number
    resolutionX: number
    resolutionY: number
    tileSize: number
    outputFormat: string
    colorMode?: string
    colorDepth?: string
    compression?: number
    exrCodec?: string
    tiffCodec?: string
    scene?: string
    camera?: string
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
  name?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  renderTime?: number
  userRerenderCount?: number
  userRerenderMax?: number
  rerenderedHistory?: number[]
}

interface JobStore {
  jobs: Job[]
  currentJob: Job | null
  isLoading: boolean
  isUploading: boolean
  uploadProgress: number
  uploadStage: string
  error: string | null
  webSocketConnected: boolean
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }


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
  approveJob: (jobId: string) => Promise<boolean>
  selectFrames: (jobId: string, frames: number[]) => Promise<boolean>
  getDashboardStats: () => Promise<{
    totalJobs: number
    activeJobs: number
    processingJobs: number
    pendingJobs: number
    completedJobs: number
    failedJobs: number
    completedToday: number
    totalRenderTime: number
    totalCreditsUsed: number
    totalFramesRendered: number
    avgRenderTimePerFrame: number
    framesRenderedToday: number
  }>
  createJobMultipart: (
    file: File,
    jobData: {
      name: string
      description: string
      projectId: string
      type: 'image' | 'animation'
      settings: JobSettings
      startFrame: number
      endFrame: number
      selectedFrame: number
      userId?: string
    }
  ) => Promise<{ success: boolean; data?: any; error?: string }>


  // Real-time updates
  updateJobProgress: (jobId: string, updates: Partial<Job>) => void
  addJob: (job: Job) => void
  removeJob: (jobId: string) => void

  // WebSocket
  setWebSocketConnected: (connected: boolean) => void

  setUploadProgress: (progress: number) => void
  setUploadStage: (stage: string) => void
  resetUploadState: () => void

  // Utility
  refreshJobs: () => Promise<void>
  clearError: () => void
  clearCurrentJob: () => void
}

const jobStore = create<JobStore>((set, get) => ({
  jobs: [],
  currentJob: null,
  isLoading: false,
  isUploading: false,
  uploadProgress: 0,
  uploadStage: 'idle',
  error: null,
  webSocketConnected: false,
  pagination: {
    total: 0,
    page: 1,
    limit: 15,
    pages: 0
  },

  createJob: async (formData: FormData) => {
    try {
      set({ isLoading: true, error: null })

      const response = await axiosInstance.post('/jobs/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000,
      })

      if (response.data.success) {
        const newJob: Job = {
          jobId: response.data.jobId,
          projectId: response.data.projectId,
          userId: response.data.userId || '',
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
  createJobMultipart: async (file, jobData) => {
    try {
      console.log('🎯 Starting multipart job creation...')
      console.log('📄 File info:', {
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        type: file.type
      })
      console.log('⚙️ Job settings:', jobData)

      set({
        isUploading: true,
        uploadProgress: 0,
        uploadStage: 'preparing',
        error: null
      })

      // Upload the file using the multipart service
      const result = await uploadService.uploadFileWithMultipart(
        file,
        {
          name: jobData.name,
          description: jobData.description || '',
          projectId: jobData.projectId,
          type: jobData.type,
          startFrame: jobData.startFrame,
          endFrame: jobData.endFrame,
          selectedFrame: jobData.selectedFrame,
          userId: jobData.userId,
          settings: jobData.settings
        },
        (stage, progress) => {
          console.log(`📈 Progress update: ${stage} - ${progress}%`)
          set({
            uploadStage: stage,
            uploadProgress: progress
          })

          // Show toast notifications for major milestones
          if (stage === 'uploading' && progress % 25 === 0) {
            toast.loading(`Uploading: ${progress}% complete`, {
              id: 'upload-progress'
            })
          } else if (stage === 'completed') {
            toast.dismiss('upload-progress')
            toast.success('File uploaded successfully!')
          }
        }
      )

      if (result.success) {
        console.log('✅ Job creation successful:', result)

        // Check for job ID in different possible locations
        const jobId = result.jobId || result.data?.jobId || result.job?.jobId

        if (!jobId) {
          console.error('❌ No jobId found in response:', result)
          throw new Error('Job created but no job ID returned')
        }

        console.log('🎯 Extracted jobId:', jobId)

        const newJob: Job = {
          jobId: jobId, // ✅ Use the extracted jobId
          projectId: result.projectId || jobData.projectId,
          userId: result.userId || jobData.userId || '',
          blendFileName: file.name,
          blendFileKey: result.fileStructure?.blendFile || result.key,
          blendFileUrl: result.blendFileUrl,
          type: result.type || jobData.type,
          status: result.status || 'pending',
          progress: 0,
          settings: {
            engine: result.settings?.engine || jobData.settings.engine,
            device: result.settings?.device || jobData.settings.device,
            samples: result.settings?.samples || jobData.settings.samples,
            resolutionX: result.settings?.resolutionX || jobData.settings.resolutionX,
            resolutionY: result.settings?.resolutionY || jobData.settings.resolutionY,
            tileSize: result.settings?.tileSize || jobData.settings.tileSize,
            outputFormat: result.settings?.outputFormat || jobData.settings.outputFormat,
            colorMode: result.settings?.colorMode || jobData.settings.colorMode,
            colorDepth: result.settings?.colorDepth || jobData.settings.colorDepth,
            compression: result.settings?.compression ?? jobData.settings.compression,
            exrCodec: result.settings?.exrCodec || jobData.settings.exrCodec,
            tiffCodec: result.settings?.tiffCodec || jobData.settings.tiffCodec,
            scene: result.settings?.scene || jobData.settings.scene,
            camera: result.settings?.camera || jobData.settings.camera,
            denoiser: result.settings?.denoiser || jobData.settings.denoiser,
            creditsPerFrame: result.settings?.creditsPerFrame || jobData.settings.creditsPerFrame
          },
          frames: {
            start: result.settings?.startFrame || jobData.startFrame,
            end: result.settings?.endFrame || jobData.endFrame,
            total: result.totalFrames ||
              (jobData.type === 'animation'
                ? (jobData.endFrame - jobData.startFrame + 1)
                : 1),
            selected: result.selectedFrames || [],
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

        console.log('📋 Created job object with ID:', newJob.jobId)

        set(state => ({
          jobs: [newJob, ...state.jobs],
          currentJob: newJob,
          isUploading: false,
          uploadProgress: 100,
          uploadStage: 'completed'
        }))

        toast.success('Job created successfully!')

        // Return jobId in the result so CreateJob.tsx can navigate to it
        return {
          success: true,
          data: {
            jobId: newJob.jobId,
            ...result
          }
        }
      } else {
        const errorMsg = result.error || 'Failed to create job'
        console.error('❌ Job creation failed:', errorMsg)

        set({
          error: errorMsg,
          isUploading: false,
          uploadStage: 'error'
        })

        toast.error(errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (error: any) {
      console.error('💥 Error creating job with multipart upload:', error)

      let errorMessage = 'Failed to create job'
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.message) {
        errorMessage = error.message
      }

      // Detailed error logging
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })

      set({
        error: errorMessage,
        isUploading: false,
        uploadStage: 'error'
      })

      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  },


  getJob: async (jobId: string) => {
    try {
      set({ isLoading: true, error: null })

      const response = await axiosInstance.get(`/jobs/${jobId}`)

      const job: Job = response.data.job
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

      const response = await axiosInstance.get('/jobs', { params })
      const { jobs = [], pagination } = response.data

      set(state => ({
        jobs,
        pagination: pagination || state.pagination,
        isLoading: false
      }))
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

      const response = await axiosInstance.delete(`/jobs/${jobId}`, {
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

      const response = await axiosInstance.post(`/jobs/${jobId}/select-frames`, { frames })

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

  approveJob: async (jobId: string) => {
    try {
      set({ isLoading: true, error: null })

      const response = await axiosInstance.post(`/jobs/${jobId}/approve`)

      set({ isLoading: false })

      if (response.data.success) {
        // Update job in store
        set(state => ({
          jobs: state.jobs.map(job =>
            job.jobId === jobId
              ? { ...job, status: 'pending', approved: true } // Assuming 'pending' is the status after approval
              : job
          ),
          currentJob: state.currentJob?.jobId === jobId
            ? { ...state.currentJob, status: 'pending', approved: true }
            : state.currentJob
        }))

        toast.success('Job approved successfully')
        return true
      }

      toast.error('Failed to approve job')
      return false
    } catch (error: any) {
      console.error('Error approving job:', error)
      const errorMessage = error.response?.data?.error || 'Failed to approve job'
      set({ error: errorMessage, isLoading: false })
      toast.error(errorMessage)
      return false
    }
  },

  getDashboardStats: async () => {
    try {
      set({ isLoading: true, error: null })

      const response = await axiosInstance.get('/jobs/dashboard/stats')

      set({ isLoading: false })
      return response.data.stats
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error)
      const errorMessage = error.response?.data?.error || 'Failed to fetch dashboard stats'
      set({ error: errorMessage, isLoading: false })

      return {
        totalJobs: 0,
        activeJobs: 0,
        processingJobs: 0,
        pendingJobs: 0,
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
    set(state => {
      // If we're on page 1, we can prepend it
      if (state.pagination.page === 1) {
        const newJobs = [job, ...state.jobs].slice(0, state.pagination.limit || 15)
        return {
          jobs: newJobs,
          currentJob: job,
          pagination: {
            ...state.pagination,
            total: (state.pagination.total || 0) + 1
          }
        }
      }
      // If not on page 1, still update current job and total, but don't mess with list 
      // (it will be refreshed when they go to page 1)
      return {
        currentJob: job,
        pagination: {
          ...state.pagination,
          total: (state.pagination.total || 0) + 1
        }
      }
    })
  },

  removeJob: (jobId: string) => {
    const { pagination, listJobs } = get()
    set(state => ({
      jobs: state.jobs.filter(job => job.jobId !== jobId),
      currentJob: state.currentJob?.jobId === jobId ? null : state.currentJob,
      pagination: {
        ...state.pagination,
        total: Math.max(0, (state.pagination.total || 0) - 1)
      }
    }))

    // Refresh the current page to fill the gap from the next page
    listJobs({ page: pagination.page, limit: pagination.limit })
  },

  setWebSocketConnected: (connected: boolean) => {
    set({ webSocketConnected: connected })
  },
  // NEW: Upload state management
  setUploadProgress: (progress: number) => set({ uploadProgress: progress }),
  setUploadStage: (stage: string) => set({ uploadStage: stage }),
  resetUploadState: () => set({
    isUploading: false,
    uploadProgress: 0,
    uploadStage: 'idle'
  }),

  refreshJobs: async () => {
    const { pagination } = get()
    await get().listJobs({
      limit: pagination.limit || 15,
      page: pagination.page || 1
    })
  },

  clearError: () => set({ error: null }),
  clearCurrentJob: () => set({ currentJob: null })
}))

export default jobStore