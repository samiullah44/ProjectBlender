// hooks/useJobs.ts - FIXED: use axiosInstance for auth token
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import jobStore from '@/stores/jobStore'
import { type Job } from '@/stores/jobStore'
import { axiosInstance } from '@/lib/axios'

// Query keys
export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (filters?: any) => [...jobKeys.lists(), filters || {}] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
  stats: () => [...jobKeys.all, 'stats'] as const,
}

// Fetch functions - using axiosInstance which auto-attaches auth token
const fetchJobs = async (params = {}): Promise<{ jobs: Job[]; pagination: any }> => {
  const response = await axiosInstance.get('/jobs', { params })
  return response.data
}

const fetchJob = async (jobId: string): Promise<Job> => {
  const response = await axiosInstance.get(`/jobs/${jobId}`)
  return response.data
}

const fetchDashboardStats = async () => {
  const response = await axiosInstance.get('/jobs/dashboard/stats')
  return response.data.stats
}

// Hooks
export const useJobs = (params = {}) => {
  return useQuery({
    queryKey: jobKeys.list(params),
    queryFn: () => fetchJobs(params),
  })
}

export const useJob = (jobId?: string) => {
  return useQuery({
    queryKey: jobKeys.detail(jobId || ''),
    queryFn: () => jobId ? fetchJob(jobId) : Promise.reject(new Error('No job ID')),
    enabled: !!jobId,
  })
}

export const useDashboardStats = () => {
  return useQuery({
    queryKey: jobKeys.stats(),
    queryFn: fetchDashboardStats,
  })
}

export const useCreateJob = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (formData: FormData) => jobStore.getState().createJob(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
      queryClient.invalidateQueries({ queryKey: jobKeys.stats() })
    },
  })
}

export const useCancelJob = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ jobId, cleanupS3 = false }: { jobId: string; cleanupS3?: boolean }) =>
      jobStore.getState().cancelJob(jobId, cleanupS3),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(variables.jobId) })
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
    },
  })
}