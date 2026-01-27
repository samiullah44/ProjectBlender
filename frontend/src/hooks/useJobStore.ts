// hooks/useJobStore.ts
import { useCallback } from 'react'
import usejobStore from '@/stores/jobStore'

export const useJobStore = () => {
  const store = usejobStore()

  const createJob = useCallback(async (formData: FormData) => {
    return await store.createJob(formData)
  }, [store.createJob])

  const getJob = useCallback(async (jobId: string) => {
    return await store.getJob(jobId)
  }, [store.getJob])

  const listJobs = useCallback(async (params?: { projectId?: string; status?: string; page?: number; limit?: number }) => {
    return await store.listJobs(params)
  }, [store.listJobs])

  const cancelJob = useCallback(async (jobId: string, cleanupS3?: boolean) => {
    return await store.cancelJob(jobId, cleanupS3)
  }, [store.cancelJob])

  return {
    // State
    jobs: store.jobs,
    isLoading: store.isLoading,
    error: store.error,
    
    // Actions
    createJob,
    getJob,
    listJobs,
    cancelJob,
    uploadBlendFile: store.uploadBlendFile,
    
    // State updaters
    setJobs: store.setJobs,
    setLoading: store.setLoading,
    setError: store.setError,
    clearError: store.clearError,
    clearJobs: store.clearJobs
  }
}