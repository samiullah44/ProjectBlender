// utils/jobFormData.ts
interface JobFormDataOptions {
  name: string
  description?: string
  projectId?: string
  type: 'image' | 'animation'
  engine: 'CYCLES' | 'EEVEE'
  device: 'CPU' | 'GPU'
  samples: number
  resolutionX: number
  resolutionY: number
  startFrame?: number
  endFrame?: number
  framesPerNode?: number
  denoiser?: 'NONE' | 'OPTIX' | 'OPENIMAGEDENOISE' | 'NLM'
  tileSize?: number
  outputFormat: 'PNG' | 'JPEG' | 'EXR' | 'TIFF'
  creditsPerFrame?: number
  blendFile: File
}

export const createJobFormData = (options: JobFormDataOptions): FormData => {
  const formData = new FormData()
  
  // Add the blend file
  formData.append('blendFile', options.blendFile)
  
  // Add all form fields
  const fields = [
    'name',
    'description',
    'projectId',
    'type',
    'engine',
    'device',
    'samples',
    'resolutionX',
    'resolutionY',
    'startFrame',
    'endFrame',
    'framesPerNode',
    'denoiser',
    'tileSize',
    'outputFormat',
    'creditsPerFrame'
  ] as const
  
  fields.forEach(field => {
    const value = options[field]
    if (value !== undefined && value !== null) {
      formData.append(field, value.toString())
    }
  })
  
  return formData
}

// Helper function to validate job form data
export const validateJobFormData = (data: Partial<JobFormDataOptions>): string[] => {
  const errors: string[] = []
  
  if (!data.name?.trim()) errors.push('Job name is required')
  if (!data.blendFile) errors.push('Blender file is required')
  if (data.type === 'animation') {
    if (!data.startFrame || !data.endFrame) errors.push('Frame range is required for animation')
    if (data.startFrame && data.endFrame && data.startFrame >= data.endFrame) {
      errors.push('Start frame must be less than end frame')
    }
  }
  if (!data.resolutionX || !data.resolutionY) errors.push('Resolution is required')
  if (data.resolutionX && data.resolutionX < 1) errors.push('Width must be greater than 0')
  if (data.resolutionY && data.resolutionY < 1) errors.push('Height must be greater than 0')
  if (!data.samples || data.samples < 1) errors.push('Samples must be greater than 0')
  
  return errors
}