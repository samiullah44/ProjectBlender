// services/uploadService.ts - UPDATED
import { axiosInstance } from '@/lib/axios'
import { toast } from 'react-hot-toast'
import { multipartUploader, type UploadProgressCallback } from './multipartUploader'

export interface JobSettings {
  engine: 'CYCLES' | 'EEVEE'
  device: 'CPU' | 'GPU'
  samples: number
  resolutionX: number
  resolutionY: number
  tileSize: number
  denoiser?: 'NONE' | 'OPTIX' | 'OPENIMAGEDENOISE' | 'NLM'
  outputFormat: 'PNG' | 'JPEG' | 'EXR' | 'TIFF'
  creditsPerFrame: number
}

export interface JobUploadData {
  name: string
  description: string
  projectId: string
  type: 'image' | 'animation'
  startFrame: number
  endFrame: number
  selectedFrame: number
  userId?: string
  settings: JobSettings
}

class UploadService {
  /**
   * Main upload method using multipart uploader
   */
  // services/uploadService.ts - FIX THE RETURN LOGIC
  async uploadFileWithMultipart(
    file: File,
    jobData: JobUploadData,
    onProgress: (stage: string, progress: number) => void
  ): Promise<any> {
    try {
      const filename = file.name
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)

      console.log(`🚀 Starting multipart upload for ${filename} (${fileSizeMB}MB)`)
      console.log('📝 Job data:', jobData)

      // Create a wrapper for progress callback
      const progressCallback: UploadProgressCallback = (stage, progress, details) => {
        console.log(`📊 ${stage.toUpperCase()}: ${progress}% - ${details || ''}`)
        onProgress(stage, progress)
      }

      // Prepare additional data for multipart upload
      const additionalData = {
        jobSettings: jobData.settings,
        projectId: jobData.projectId,
        type: jobData.type,
        startFrame: jobData.startFrame,
        endFrame: jobData.endFrame,
        selectedFrame: jobData.selectedFrame,
        name: jobData.name,
        description: jobData.description,
        filename: filename // ADD THIS - this was missing!
      }

      console.log('📤 Sending to multipart uploader with data:', additionalData)

      // Use the multipart uploader
      const result = await multipartUploader.uploadFile(
        file,
        '/jobs/upload/initiate',
        '/jobs/upload/complete',
        additionalData,
        progressCallback
      )

      console.log('✅ Multipart upload completed:', result)

      // The multipartUploader returns just the upload info (key, uploadId, parts)
      // But we need to return the complete backend response which includes jobId
      // The result should already have the backend response merged in

      console.log('✅ Upload completed with result:', result)

      // Return the complete result from multipartUploader
      // which should include the backend response
      return result

    } catch (error: any) {
      console.error('❌ Upload service error:', error)

      // Enhanced error logging
      if (error.response) {
        console.error('Response error:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        })
      } else if (error.request) {
        console.error('No response received:', error.request)
      } else {
        console.error('Error message:', error.message)
      }

      throw new Error(error.response?.data?.error || error.message || 'Upload failed')
    }
  }

  /**
   * Simple upload for testing (bypass multipart)
   */
  async simpleUpload(file: File, jobData: JobUploadData): Promise<any> {
    try {
      console.log('🔄 Using simple upload for testing')

      const formData = new FormData()
      formData.append('blendFile', file)
      formData.append('name', jobData.name)
      formData.append('description', jobData.description)
      formData.append('projectId', jobData.projectId)
      formData.append('type', jobData.type)
      formData.append('startFrame', jobData.startFrame.toString())
      formData.append('endFrame', jobData.endFrame.toString())
      formData.append('selectedFrame', jobData.selectedFrame.toString())
      // userId is extracted from auth token on the backend, no need to send it
      formData.append('settings', JSON.stringify(jobData.settings))

      const response = await axiosInstance.post('/jobs/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      })

      return response.data

    } catch (error: any) {
      console.error('Simple upload error:', error)
      throw error
    }
  }

  /**
   * Abort upload (cleanup)
   */
  async abortUpload(key: string, uploadId: string): Promise<void> {
    try {
      await axiosInstance.delete('/jobs/upload/abort', {
        data: { key, uploadId }
      })
      console.log('🧹 Upload aborted successfully')
    } catch (error) {
      console.error('Failed to abort upload:', error)
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async initiateUpload(filename: string, parts: number): Promise<any> {
    const response = await axiosInstance.post('/jobs/upload/initiate', {
      filename,
      parts
    })

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to initiate upload')
    }

    return response.data
  }

  /**
   * Legacy method for backward compatibility
   */
  async completeUpload(data: any): Promise<any> {
    const response = await axiosInstance.post('/jobs/upload/complete', data)

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to complete upload')
    }

    return response.data
  }
}

export const uploadService = new UploadService()