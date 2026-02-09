// services/multipartUploader.ts
import { axiosInstance } from '@/lib/axios'
import { toast } from 'react-hot-toast'

export interface UploadPart {
  partNumber: number
  url: string
  uploaded?: boolean
  etag?: string
}

export interface PartETag {
  PartNumber: number
  ETag: string
}

export interface MultipartUploadResult {
  key: string
  uploadId: string
  parts: PartETag[]
}

export interface UploadProgressCallback {
  (stage: string, progress: number, details?: string): void
}

export class MultipartUploader {
  private readonly CONCURRENCY = 5 // Upload 5 parts at a time
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 1000
  private readonly CHUNK_SIZE = 20 * 1024 * 1024 // 20MB chunks
  
  /**
   * Calculate optimal chunk size based on file size
   */
  private calculateOptimalChunkSize(fileSize: number): number {
    const sizeMB = fileSize / (1024 * 1024)
    
    if (sizeMB <= 20) {
      return fileSize // Single part for small files
    } else if (sizeMB <= 200) {
      return 10 * 1024 * 1024 // 10MB chunks
    } else if (sizeMB <= 500) {
      return 20 * 1024 * 1024 // 20MB chunks
    } else {
      return 30 * 1024 * 1024 // 30MB chunks
    }
  }
  
  /**
   * Calculate number of parts based on file size and chunk size
   */
  private calculateParts(fileSize: number): number {
    const chunkSize = this.calculateOptimalChunkSize(fileSize)
    return Math.ceil(fileSize / chunkSize)
  }
  
  /**
   * Upload a single part with retry logic
   */
  private async uploadSinglePart(
    partNumber: number,
    chunk: Blob,
    url: string,
    onPartProgress?: (progress: number) => void
  ): Promise<PartETag> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`📤 Uploading part ${partNumber}, attempt ${attempt}`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minute timeout
        
        const response = await fetch(url, {
          method: 'PUT',
          body: chunk,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/octet-stream',
          }
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`Failed to upload part ${partNumber}: ${response.status}`)
        }
        
        const etag = response.headers.get('ETag')?.replace(/"/g, '')
        if (!etag) {
          throw new Error(`No ETag received for part ${partNumber}`)
        }
        
        console.log(`✅ Part ${partNumber} uploaded successfully, ETag: ${etag}`)
        
        if (onPartProgress) {
          onPartProgress(100)
        }
        
        return {
          PartNumber: partNumber,
          ETag: etag
        }
      } catch (error: any) {
        lastError = error
        console.warn(`⚠️ Part ${partNumber} attempt ${attempt} failed:`, error.message)
        
        if (attempt < this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt))
        }
      }
    }
    
    throw lastError || new Error(`Failed to upload part ${partNumber} after ${this.MAX_RETRIES} attempts`)
  }
  
  /**
   * Upload parts in batches with 5-part concurrency
   */
  private async uploadPartsInBatches(
    file: File,
    presignedUrls: Array<{ partNumber: number; url: string }>,
    onProgress: (progress: number) => void,
    onBatchProgress?: (batchNumber: number, totalBatches: number) => void
  ): Promise<PartETag[]> {
    const partsCount = presignedUrls.length
    const totalSize = file.size
    const chunkSize = this.calculateOptimalChunkSize(file.size)
    const partETags: PartETag[] = []
    
    console.log(`📊 Starting upload: ${partsCount} parts, ${(totalSize / (1024 * 1024)).toFixed(2)}MB total`)
    
    // Calculate total batches
    const totalBatches = Math.ceil(partsCount / this.CONCURRENCY)
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * this.CONCURRENCY
      const batchEnd = Math.min(batchStart + this.CONCURRENCY, partsCount)
      const batchSize = batchEnd - batchStart
      
      console.log(`🔄 Starting batch ${batchIndex + 1}/${totalBatches} (parts ${batchStart + 1}-${batchEnd})`)
      
      if (onBatchProgress) {
        onBatchProgress(batchIndex + 1, totalBatches)
      }
      
      // Create batch promises
      const batchPromises: Promise<PartETag>[] = []
      
      for (let i = batchStart; i < batchEnd; i++) {
        const partInfo = presignedUrls[i]
        const start = (partInfo.partNumber - 1) * chunkSize
        const end = Math.min(start + chunkSize, totalSize)
        const chunk = file.slice(start, end)
        
        batchPromises.push(
          this.uploadSinglePart(partInfo.partNumber, chunk, partInfo.url)
        )
      }
      
      // Upload batch with concurrency
      try {
        const batchResults = await Promise.all(batchPromises)
        partETags.push(...batchResults)
        
        // Calculate progress
        const completedParts = partETags.length
        const progress = Math.round((completedParts / partsCount) * 100)
        onProgress(progress)
        
        console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} completed: ${batchResults.length} parts uploaded`)
      } catch (error) {
        console.error(`❌ Batch ${batchIndex + 1} failed:`, error)
        throw error
      }
    }
    
    // Sort parts by PartNumber (required by S3)
    return partETags.sort((a, b) => a.PartNumber - b.PartNumber)
  }
  
  /**
   * Main upload method
   */
// services/multipartUploader.ts - FIX THE completeResponse handling
async uploadFile(
  file: File,
  initiateUploadUrl: string,
  completeUploadUrl: string,
  additionalData: any,
  onProgress: UploadProgressCallback
): Promise<any> {
  const filename = file.name
  const fileSize = file.size
  
  try {
    // Stage 1: Calculate parts and initiate upload
    onProgress('initiating', 0, `Calculating parts for ${(fileSize / (1024 * 1024)).toFixed(2)}MB file...`)
    
    const parts = this.calculateParts(fileSize)
    console.log(`📦 File: ${filename}, Size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB, Parts: ${parts}`)
    
    // Call backend to initiate multipart upload
    onProgress('initiating', 10, 'Requesting upload URLs from server...')
    const initiateResponse = await axiosInstance.post(initiateUploadUrl, {
      filename,
      parts,
      ...additionalData
    })
    
    if (!initiateResponse.data.success) {
      throw new Error(initiateResponse.data.error || 'Failed to initiate upload')
    }
    
    const { key, uploadId, presignedUrls } = initiateResponse.data
    console.log(`✅ Upload initiated: key=${key}, uploadId=${uploadId}, ${presignedUrls.length} parts`)
    
    // Stage 2: Upload parts in batches
    onProgress('uploading', 20, `Uploading ${presignedUrls.length} parts...`)
    
    const uploadedParts = await this.uploadPartsInBatches(
      file,
      presignedUrls,
      (progress) => {
        // Map to 20-80% range
        const mappedProgress = 20 + (progress * 0.6)
        onProgress('uploading', mappedProgress, `${progress}% complete`)
      },
      (batchNumber, totalBatches) => {
        console.log(`🔄 Batch ${batchNumber}/${totalBatches} in progress`)
      }
    )
    
    console.log(`✅ All ${uploadedParts.length} parts uploaded successfully`)
    
    // Stage 3: Complete upload
    onProgress('completing', 85, 'Finalizing upload...')
    
    const completeResponse = await axiosInstance.post(completeUploadUrl, {
      key,
      uploadId,
      parts: uploadedParts,
      filename,
      ...additionalData
    })
    
    console.log('✅ Complete upload response:', completeResponse.data)
    
    if (!completeResponse.data.success) {
      throw new Error(completeResponse.data.error || 'Failed to complete upload')
    }
    
    onProgress('completed', 100, 'Upload completed successfully!')
    
    // Return the complete backend response which includes jobId
    return completeResponse.data
    
  } catch (error: any) {
    console.error('❌ Multipart upload failed:', error)
    
    // Attempt cleanup if we have key and uploadId
    if (error.key && error.uploadId) {
      try {
        await axiosInstance.delete('/jobs/upload/abort', {
          data: { key: error.key, uploadId: error.uploadId }
        })
        console.log('🧹 Upload aborted and cleaned up')
      } catch (cleanupError) {
        console.error('Failed to abort upload:', cleanupError)
      }
    }
    
    onProgress('error', 0, error.message || 'Upload failed')
    throw error
  }
}
}

// Singleton instance
export const multipartUploader = new MultipartUploader()