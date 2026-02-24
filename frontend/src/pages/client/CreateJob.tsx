// pages/client/CreateJob.tsx - UPDATED for multipart upload
import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  X,
  Settings,
  Cpu,
  Clock,
  DollarSign,
  CheckCircle,
  Loader2,
  Image as ImageIcon,
  Film,
  Gauge,
  Zap,
  Palette,
  ChevronRight,
  ChevronLeft,
  File,
  Play
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import jobStore from '@/stores/jobStore'
import { toast } from 'react-hot-toast'
import { uploadService } from '@/services/uploadService'
// REMOVED: import { createJobFormData, validateJobFormData } from '@/utils/jobFormData'

type Step = 'upload' | 'settings' | 'review' | 'processing'

// UPDATED: Add JobSettings interface
interface JobSettings {
  engine: 'CYCLES' | 'EEVEE'
  device: 'CPU' | 'GPU'
  samples: number
  resolutionX: number
  resolutionY: number
  tileSize: number
  outputFormat: 'PNG' | 'JPEG' | 'EXR' | 'TIFF'
  denoiser?: 'NONE' | 'OPTIX' | 'OPENIMAGEDENOISE' | 'NLM'
  selectedFrame?: number
  creditsPerFrame: number
  blenderVersion?: string
}

interface JobFormData {
  name: string
  description: string
  projectId: string
  type: 'image' | 'animation'
  startFrame: number
  endFrame: number
  selectedFrame: number
  // UPDATED: Use JobSettings interface
  settings: JobSettings
}

// NEW: Form validation helper (moved from utils/jobFormData.ts)
const validateJobForm = (data: Partial<JobFormData>, uploadedFile: File | null): string[] => {
  const errors: string[] = []

  if (!uploadedFile) errors.push('Blender file is required')
  if (!data.name?.trim()) errors.push('Job name is required')
  if (data.type === 'animation') {
    if (!data.startFrame || !data.endFrame) errors.push('Frame range is required for animation')
    if (data.startFrame && data.endFrame && data.startFrame >= data.endFrame) {
      errors.push('Start frame must be less than end frame')
    }
  }
  if (!data.settings?.resolutionX || !data.settings?.resolutionY) errors.push('Resolution is required')
  if (data.settings?.resolutionX && data.settings.resolutionX < 1) errors.push('Width must be greater than 0')
  if (data.settings?.resolutionY && data.settings.resolutionY < 1) errors.push('Height must be greater than 0')
  if (!data.settings?.samples || data.settings.samples < 1) errors.push('Samples must be greater than 0')

  return errors
}

const CreateJob: React.FC = () => {
  const navigate = useNavigate()
  // UPDATED: Get multipart upload method and upload state
  const {
    createJobMultipart,
    isUploading,
    uploadProgress,
    uploadStage
  } = jobStore()

  const [currentStep, setCurrentStep] = useState<Step>('upload')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  // UPDATED: Initialize form data with settings object
  const [formData, setFormData] = useState<JobFormData>({
    name: '',
    description: '',
    projectId: 'default-project',
    type: 'animation',
    startFrame: 1,
    endFrame: 100,
    selectedFrame: 1,
    settings: {
      engine: 'CYCLES',
      device: 'GPU',
      samples: 128,
      resolutionX: 1920,
      resolutionY: 1080,
      tileSize: 256,
      outputFormat: 'PNG',
      denoiser: 'OPTIX',
      creditsPerFrame: 1,
      blenderVersion: '4.5.0'
    }
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      if (file.size > (500 * 1024 * 1024)) {
        toast.error('File size exceeds 500MB limit')
        return
      }
      setUploadedFile(file)
      if (!formData.name.trim()) {
        setFormData(prev => ({
          ...prev,
          name: file.name.replace('.blend', '')
        }))
      }
      toast.success('File uploaded successfully')
    }
  }, [formData.name])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/x-blender': ['.blend'],
      'application/octet-stream': ['.blend'],
      'application/zip': ['.blend']
    },
    multiple: false,
    maxSize: 500 * 1024 * 1024,
  })

  // UPDATED: Handle settings changes
  const handleInputChange = (field: keyof JobFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // UPDATED: Handle settings changes
  const handleSettingsChange = (field: keyof JobSettings, value: any) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: value
      }
    }))
  }

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 'upload':
        if (!uploadedFile) {
          toast.error('Please upload a Blender file')
          return false
        }
        return true
      case 'settings':
        const errors = validateJobForm(formData, uploadedFile)
        if (errors.length > 0) {
          errors.forEach(error => toast.error(error))
          return false
        }
        return true
      case 'review':
        return true
      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateCurrentStep()) {
      const steps: Step[] = ['upload', 'settings', 'review', 'processing']
      const currentIndex = steps.indexOf(currentStep)
      if (currentIndex < steps.length - 1) {
        setCurrentStep(steps[currentIndex + 1])
      }
    }
  }

  const prevStep = () => {
    const steps: Step[] = ['upload', 'settings', 'review', 'processing']
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1])
    }
  }
  // In your CreateJob.tsx - Update the handleSubmit function

  const handleSubmit = async () => {
    if (!uploadedFile) {
      toast.error('No file uploaded')
      return
    }

    console.log('🚀 Submitting job creation...')
    console.log('📄 File:', uploadedFile.name, `${(uploadedFile.size / (1024 * 1024)).toFixed(2)}MB`)
    console.log('⚙️ Form data:', formData)

    try {
      console.log('🔄 Calling createJobMultipart...')

      // Use multipart upload method
      const result = await createJobMultipart(uploadedFile, {
        name: formData.name,
        description: formData.description,
        projectId: formData.projectId,
        type: formData.type,
        startFrame: formData.startFrame,
        endFrame: formData.endFrame,
        selectedFrame: formData.selectedFrame,
        settings: formData.settings
      })

      console.log('📤 Upload result:', result)

      if (result.success) {
        console.log('✅ Job created successfully')
        setCurrentStep('processing')

        // Get jobId from result (check multiple possible locations)
        const jobId = result.data?.jobId || result.data?.data?.jobId

        if (jobId) {
          console.log('🎯 Navigating to job details:', jobId)

          // Show success message for 2 seconds then navigate
          setTimeout(() => {
            navigate(`/client/jobs/${jobId}`)
          }, 2000)
        } else {
          console.error('❌ No jobId found in response:', result)
          // Fallback: navigate to dashboard and show message
          setTimeout(() => {
            navigate('/client/dashboard')
            toast.success('Job created! Check dashboard for details.')
          }, 2000)
        }
      } else {
        console.error('❌ Job creation failed:', result.error)

        // Try fallback to simple upload
        console.log('🔄 Trying fallback simple upload...')
        try {
          const simpleResult = await uploadService.simpleUpload(uploadedFile, {
            name: formData.name,
            description: formData.description,
            projectId: formData.projectId,
            type: formData.type,
            startFrame: formData.startFrame,
            endFrame: formData.endFrame,
            selectedFrame: formData.selectedFrame,
            settings: formData.settings
          })

          if (simpleResult.success) {
            toast.success('Job created with simple upload!')
            setCurrentStep('processing')

            if (simpleResult.jobId) {
              setTimeout(() => {
                navigate(`/client/jobs/${simpleResult.jobId}`)
              }, 2000)
            }
          } else {
            setCurrentStep('review')
            toast.error(simpleResult.error || 'Failed to create job')
          }
        } catch (fallbackError: any) {
          console.error('Fallback upload failed:', fallbackError)
          setCurrentStep('review')
          toast.error(fallbackError.message || 'All upload methods failed')
        }
      }
    } catch (error: any) {
      console.error('💥 Job submission error:', error)
      setCurrentStep('review')
      toast.error(error.message || 'An unexpected error occurred')
    }
  }

  const calculateEstimatedCost = () => {
    const frames = formData.type === 'animation'
      ? (formData.endFrame - formData.startFrame + 1)
      : 1

    const complexityFactor = formData.settings.samples / 128
    const resolutionFactor = (formData.settings.resolutionX * formData.settings.resolutionY) / (1920 * 1080)

    let baseCost = frames * formData.settings.creditsPerFrame
    baseCost *= complexityFactor
    baseCost *= resolutionFactor

    // Engine factor
    if (formData.settings.engine === 'CYCLES') baseCost *= 1.2
    if (formData.settings.device === 'GPU') baseCost *= 0.8

    return Math.ceil(baseCost)
  }

  const estimatedCost = calculateEstimatedCost()
  const totalFrames = formData.type === 'animation'
    ? formData.endFrame - formData.startFrame + 1
    : 1

  // Steps configuration
  const steps = [
    { id: 'upload', title: 'Upload File', icon: Upload },
    { id: 'settings', title: 'Settings', icon: Settings },
    { id: 'review', title: 'Review', icon: CheckCircle },
    { id: 'processing', title: 'Processing', icon: Loader2 }
  ]

  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-400" />
                  Upload Blender File
                </CardTitle>
                <CardDescription>
                  Drag and drop your .blend file or click to browse (Max 500MB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
                    transition-all duration-300 hover:border-blue-500/50 hover:bg-white/5
                    ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/20'}
                    ${uploadedFile ? 'border-blue-500/30 bg-blue-500/5' : ''}
                  `}
                >
                  <input {...getInputProps()} />

                  {uploadedFile ? (
                    <div className="space-y-4">
                      <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                        <CheckCircle className="w-10 h-10 text-emerald-400" />
                      </div>
                      <p className="text-lg font-medium">File uploaded successfully</p>
                      <p className="text-gray-400 text-sm">
                        {uploadedFile.name} ({(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </p>
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setUploadedFile(null)
                        }}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Remove File
                      </Button>
                    </div>
                  ) : isDragActive ? (
                    <>
                      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                        <Upload className="w-10 h-10 text-blue-400" />
                      </div>
                      <p className="text-xl font-medium text-blue-400 mb-2">Drop file here</p>
                      <p className="text-gray-400">Release to upload</p>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                        <Upload className="w-10 h-10 text-blue-400" />
                      </div>
                      <p className="text-xl font-medium mb-3">Drag & drop your .blend file</p>
                      <p className="text-gray-400 mb-6">or click to browse</p>
                      <Button variant="outline" className="border-white/20 hover:bg-white/5">
                        Browse Files
                      </Button>
                      <p className="text-xs text-gray-500 mt-4">Max file size: 500MB</p>
                    </>
                  )}
                </div>

                {uploadedFile && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6"
                  >
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center gap-3">
                        <File className="w-5 h-5 text-blue-400" />
                        <div className="flex-1">
                          <p className="font-medium">{uploadedFile.name}</p>
                          <p className="text-sm text-gray-400">
                            Size: {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => navigate('/client/dashboard')}
                className="border-white/20 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={nextStep}
                disabled={!uploadedFile}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Next: Settings
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        )

      case 'settings':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-400" />
                  Render Settings
                </CardTitle>
                <CardDescription>
                  Configure your rendering parameters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Basic Settings */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Job Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                        placeholder="e.g., Character Animation v3"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors min-h-[100px]"
                        placeholder="Brief description of this render job..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-3">
                        Render Type
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant={formData.type === 'image' ? 'default' : 'outline'}
                          onClick={() => handleInputChange('type', 'image')}
                          className="border-white/20 h-auto py-4"
                        >
                          <ImageIcon className="w-5 h-5 mr-2" />
                          <div className="text-left">
                            <div className="font-medium">Single Image</div>
                            <div className="text-xs text-gray-400">Render one frame</div>
                          </div>
                        </Button>
                        <Button
                          type="button"
                          variant={formData.type === 'animation' ? 'default' : 'outline'}
                          onClick={() => handleInputChange('type', 'animation')}
                          className="border-white/20 h-auto py-4"
                        >
                          <Film className="w-5 h-5 mr-2" />
                          <div className="text-left">
                            <div className="font-medium">Animation</div>
                            <div className="text-xs text-gray-400">Render frame sequence</div>
                          </div>
                        </Button>
                      </div>
                    </div>

                    {formData.type === 'image' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Frame to Render
                        </label>
                        <input
                          type="number"
                          value={formData.selectedFrame}
                          onChange={(e) => handleInputChange('selectedFrame', parseInt(e.target.value) || 1)}
                          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                          min="1"
                        />
                      </div>
                    )}

                    {formData.type === 'animation' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Frame Range
                          </label>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <input
                                type="number"
                                value={formData.startFrame}
                                onChange={(e) => handleInputChange('startFrame', parseInt(e.target.value) || 1)}
                                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                                min="1"
                              />
                              <div className="text-xs text-gray-400 mt-1">Start</div>
                            </div>
                            <span className="text-gray-400">to</span>
                            <div className="flex-1">
                              <input
                                type="number"
                                value={formData.endFrame}
                                onChange={(e) => handleInputChange('endFrame', parseInt(e.target.value) || 1)}
                                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                                min={formData.startFrame + 1}
                              />
                              <div className="text-xs text-gray-400 mt-1">End</div>
                            </div>
                          </div>
                          <div className="text-sm text-gray-400 mt-2">
                            Total: {totalFrames} frames
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Advanced Settings */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Render Engine
                      </label>
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant={formData.settings.engine === 'CYCLES' ? 'default' : 'outline'}
                          onClick={() => handleSettingsChange('engine', 'CYCLES')}
                          className="w-full justify-start border-white/20 h-auto py-4"
                        >
                          <Palette className="w-5 h-5 mr-3 text-purple-400" />
                          <div className="text-left">
                            <div className="font-medium">Cycles</div>
                            <div className="text-xs text-gray-400">Physically-based path tracer</div>
                          </div>
                        </Button>
                        <Button
                          type="button"
                          variant={formData.settings.engine === 'EEVEE' ? 'default' : 'outline'}
                          onClick={() => handleSettingsChange('engine', 'EEVEE')}
                          className="w-full justify-start border-white/20 h-auto py-4"
                        >
                          <Zap className="w-5 h-5 mr-3 text-amber-400" />
                          <div className="text-left">
                            <div className="font-medium">Eevee</div>
                            <div className="text-xs text-gray-400">Real-time renderer</div>
                          </div>
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Blender Version
                      </label>
                      <select
                        value={formData.settings.blenderVersion || '4.5.0'}
                        onChange={(e) => handleSettingsChange('blenderVersion', e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-white/10 focus:border-blue-500 focus:outline-none transition-colors appearance-none"
                      >
                        {/* Blender 5.0 */}
                        <optgroup label="Blender 5.0">
                          <option value="5.0.0">5.0.0</option>
                          <option value="5.0.1">5.0.1</option>
                        </optgroup>

                        {/* Blender 4.5 LTS */}
                        <optgroup label="Blender 4.5 LTS">
                          <option value="4.5.0">4.5.0 (Default)</option>
                          <option value="4.5.1">4.5.1</option>
                          <option value="4.5.2">4.5.2</option>
                          <option value="4.5.3">4.5.3</option>
                        </optgroup>

                        {/* Blender 4.4 */}
                        <optgroup label="Blender 4.4">
                          <option value="4.4.0">4.4.0</option>
                          <option value="4.4.1">4.4.1</option>
                          <option value="4.4.2">4.4.2</option>
                          <option value="4.4.3">4.4.3</option>
                        </optgroup>

                        {/* Blender 4.3 */}
                        <optgroup label="Blender 4.3">
                          <option value="4.3.0">4.3.0</option>
                          <option value="4.3.1">4.3.1</option>
                          <option value="4.3.2">4.3.2</option>
                        </optgroup>

                        {/* Blender 4.2 LTS */}
                        <optgroup label="Blender 4.2 LTS">
                          <option value="4.2.0">4.2.0</option>
                          <option value="4.2.1">4.2.1</option>
                          <option value="4.2.2">4.2.2</option>
                          <option value="4.2.3">4.2.3</option>
                          <option value="4.2.4">4.2.4</option>
                          <option value="4.2.5">4.2.5</option>
                          <option value="4.2.6">4.2.6</option>
                          <option value="4.2.7">4.2.7</option>
                          <option value="4.2.8">4.2.8</option>
                          <option value="4.2.9">4.2.9</option>
                          <option value="4.2.10">4.2.10</option>
                          <option value="4.2.11">4.2.11</option>
                          <option value="4.2.12">4.2.12</option>
                          <option value="4.2.13">4.2.13</option>
                          <option value="4.2.14">4.2.14</option>
                          <option value="4.2.15">4.2.15</option>
                          <option value="4.2.16">4.2.16</option>
                          <option value="4.2.17">4.2.17</option>
                          <option value="4.2.18">4.2.18</option>
                          <option value="4.2.19">4.2.19</option>
                          <option value="4.2.20">4.2.20</option>
                          <option value="4.2.21">4.2.21</option>
                          <option value="4.2.22">4.2.22</option>
                          <option value="4.2.23">4.2.23</option>
                          <option value="4.2.24">4.2.24</option>
                          <option value="4.2.25">4.2.25</option>
                        </optgroup>

                        {/* Blender 4.1 */}
                        <optgroup label="Blender 4.1">
                          <option value="4.1.0">4.1.0</option>
                          <option value="4.1.1">4.1.1</option>
                        </optgroup>

                        {/* Blender 4.0 */}
                        <optgroup label="Blender 4.0">
                          <option value="4.0.0">4.0.0</option>
                          <option value="4.0.1">4.0.1</option>
                          <option value="4.0.2">4.0.2</option>
                        </optgroup>

                        {/* Blender 3.6 LTS */}
                        <optgroup label="Blender 3.6 LTS">
                          <option value="3.6.0">3.6.0</option>
                          <option value="3.6.1">3.6.1</option>
                          <option value="3.6.2">3.6.2</option>
                          <option value="3.6.3">3.6.3</option>
                          <option value="3.6.4">3.6.4</option>
                          <option value="3.6.5">3.6.5</option>
                          <option value="3.6.6">3.6.6</option>
                          <option value="3.6.7">3.6.7</option>
                          <option value="3.6.8">3.6.8</option>
                          <option value="3.6.9">3.6.9</option>
                          <option value="3.6.10">3.6.10</option>
                          <option value="3.6.11">3.6.11</option>
                          <option value="3.6.12">3.6.12</option>
                          <option value="3.6.13">3.6.13</option>
                          <option value="3.6.14">3.6.14</option>
                          <option value="3.6.15">3.6.15</option>
                          <option value="3.6.16">3.6.16</option>
                          <option value="3.6.17">3.6.17</option>
                          <option value="3.6.18">3.6.18</option>
                        </optgroup>

                        {/* Blender 3.5 */}
                        <optgroup label="Blender 3.5">
                          <option value="3.5.0">3.5.0</option>
                          <option value="3.5.1">3.5.1</option>
                        </optgroup>

                        {/* Blender 3.4 */}
                        <optgroup label="Blender 3.4">
                          <option value="3.4.0">3.4.0</option>
                          <option value="3.4.1">3.4.1</option>
                        </optgroup>

                        {/* Blender 3.3 LTS */}
                        <optgroup label="Blender 3.3 LTS">
                          <option value="3.3.0">3.3.0</option>
                          <option value="3.3.1">3.3.1</option>
                          <option value="3.3.2">3.3.2</option>
                          <option value="3.3.3">3.3.3</option>
                          <option value="3.3.4">3.3.4</option>
                          <option value="3.3.5">3.3.5</option>
                          <option value="3.3.6">3.3.6</option>
                          <option value="3.3.7">3.3.7</option>
                          <option value="3.3.8">3.3.8</option>
                          <option value="3.3.9">3.3.9</option>
                          <option value="3.3.10">3.3.10</option>
                          <option value="3.3.11">3.3.11</option>
                          <option value="3.3.12">3.3.12</option>
                          <option value="3.3.13">3.3.13</option>
                          <option value="3.3.14">3.3.14</option>
                          <option value="3.3.15">3.3.15</option>
                          <option value="3.3.16">3.3.16</option>
                          <option value="3.3.17">3.3.17</option>
                          <option value="3.3.18">3.3.18</option>
                          <option value="3.3.19">3.3.19</option>
                          <option value="3.3.20">3.3.20</option>
                          <option value="3.3.21">3.3.21</option>
                        </optgroup>

                        {/* Blender 3.2 */}
                        <optgroup label="Blender 3.2">
                          <option value="3.2.0">3.2.0</option>
                          <option value="3.2.1">3.2.1</option>
                          <option value="3.2.2">3.2.2</option>
                        </optgroup>

                        {/* Blender 3.1 */}
                        <optgroup label="Blender 3.1">
                          <option value="3.1.0">3.1.0</option>
                          <option value="3.1.1">3.1.1</option>
                          <option value="3.1.2">3.1.2</option>
                        </optgroup>

                        {/* Blender 3.0 */}
                        <optgroup label="Blender 3.0">
                          <option value="3.0.0">3.0.0</option>
                          <option value="3.0.1">3.0.1</option>
                        </optgroup>

                        {/* Blender 2.93 LTS */}
                        <optgroup label="Blender 2.93 LTS">
                          <option value="2.93.0">2.93.0</option>
                          <option value="2.93.1">2.93.1</option>
                          <option value="2.93.2">2.93.2</option>
                          <option value="2.93.3">2.93.3</option>
                          <option value="2.93.4">2.93.4</option>
                          <option value="2.93.5">2.93.5</option>
                          <option value="2.93.6">2.93.6</option>
                          <option value="2.93.7">2.93.7</option>
                          <option value="2.93.8">2.93.8</option>
                          <option value="2.93.9">2.93.9</option>
                          <option value="2.93.10">2.93.10</option>
                          <option value="2.93.11">2.93.11</option>
                          <option value="2.93.12">2.93.12</option>
                          <option value="2.93.13">2.93.13</option>
                          <option value="2.93.14">2.93.14</option>
                          <option value="2.93.15">2.93.15</option>
                          <option value="2.93.16">2.93.16</option>
                          <option value="2.93.17">2.93.17</option>
                          <option value="2.93.18">2.93.18</option>
                        </optgroup>

                        {/* Blender 2.92 */}
                        <optgroup label="Blender 2.92">
                          <option value="2.92.0">2.92.0</option>
                        </optgroup>

                        {/* Blender 2.91 */}
                        <optgroup label="Blender 2.91">
                          <option value="2.91.0">2.91.0</option>
                          <option value="2.91.1">2.91.1</option>
                          <option value="2.91.2">2.91.2</option>
                        </optgroup>

                        {/* Blender 2.90 */}
                        <optgroup label="Blender 2.90">
                          <option value="2.90.0">2.90.0</option>
                          <option value="2.90.1">2.90.1</option>
                        </optgroup>
                      </select>
                      <div className="text-xs text-gray-400 mt-1">
                        Select the exact patch version used to create your project.
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Device
                      </label>
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant={formData.settings.device === 'GPU' ? 'default' : 'outline'}
                          onClick={() => handleSettingsChange('device', 'GPU')}
                          className="w-full justify-start border-white/20 h-auto py-4"
                        >
                          <Gauge className="w-5 h-5 mr-3 text-emerald-400" />
                          <div className="text-left">
                            <div className="font-medium">GPU</div>
                            <div className="text-xs text-gray-400">Faster, uses CUDA/OPTIX</div>
                          </div>
                        </Button>
                        <Button
                          type="button"
                          variant={formData.settings.device === 'CPU' ? 'default' : 'outline'}
                          onClick={() => handleSettingsChange('device', 'CPU')}
                          className="w-full justify-start border-white/20 h-auto py-4"
                        >
                          <Cpu className="w-5 h-5 mr-3 text-blue-400" />
                          <div className="text-left">
                            <div className="font-medium">CPU</div>
                            <div className="text-xs text-gray-400">Slower, more compatible</div>
                          </div>
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Resolution X
                        </label>
                        <input
                          type="number"
                          value={formData.settings.resolutionX}
                          onChange={(e) => handleSettingsChange('resolutionX', parseInt(e.target.value) || 1920)}
                          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                          min="1"
                          max="16384"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Resolution Y
                        </label>
                        <input
                          type="number"
                          value={formData.settings.resolutionY}
                          onChange={(e) => handleSettingsChange('resolutionY', parseInt(e.target.value) || 1080)}
                          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                          min="1"
                          max="16384"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Samples: {formData.settings.samples}
                      </label>
                      <input
                        type="range"
                        min="32"
                        max="2048"
                        step="32"
                        value={formData.settings.samples}
                        onChange={(e) => handleSettingsChange('samples', parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>32</span>
                        <span>128</span>
                        <span>512</span>
                        <span>2048</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={prevStep}
                className="border-white/20 hover:bg-white/5"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <Button
                onClick={nextStep}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Next: Review
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        )

      case 'review':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Review & Confirm
                </CardTitle>
                <CardDescription>
                  Review your settings before starting the render
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Job Summary */}
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <h3 className="font-medium mb-4">Job Details</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">File:</span>
                          <span className="font-medium">{uploadedFile?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Type:</span>
                          <span className="font-medium capitalize">{formData.type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Frames:</span>
                          <span className="font-medium">
                            {formData.type === 'animation'
                              ? `${totalFrames} (${formData.startFrame}-${formData.endFrame})`
                              : `Frame ${formData.selectedFrame}`
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Resolution:</span>
                          <span className="font-medium">
                            {formData.settings.resolutionX} × {formData.settings.resolutionY}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <h3 className="font-medium mb-4">Render Settings</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Engine:</span>
                          <span className="font-medium">{formData.settings.engine}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Blender Version:</span>
                          <span className="font-medium">{formData.settings.blenderVersion || '4.5.0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Device:</span>
                          <span className="font-medium">{formData.settings.device}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Samples:</span>
                          <span className="font-medium">{formData.settings.samples}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Output Format:</span>
                          <span className="font-medium">{formData.settings.outputFormat}</span>
                        </div>
                        {formData.settings.denoiser && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Denoiser:</span>
                            <span className="font-medium">{formData.settings.denoiser}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cost & Time Estimate */}
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-white/10">
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        Cost Estimate
                      </h3>
                      <div className="space-y-4">
                        <div className="text-center mb-6">
                          <div className="text-3xl font-bold text-emerald-400 mb-1">
                            {estimatedCost} credits
                          </div>
                          <div className="text-sm text-gray-400">
                            Estimated cost for this job
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Frames:</span>
                            <span>{totalFrames} × {formData.settings.creditsPerFrame} credits</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Complexity:</span>
                            <span>{(formData.settings.samples / 128).toFixed(2)}×</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Resolution:</span>
                            <span>
                              {((formData.settings.resolutionX * formData.settings.resolutionY) / (1920 * 1080)).toFixed(2)}×
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Engine:</span>
                            <span>{formData.settings.engine === 'CYCLES' ? '1.2×' : '1.0×'}</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-white/10">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Your balance:</span>
                            <span className="font-medium">1,250 credits</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            After this job: {1250 - estimatedCost} credits remaining
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        Time Estimate
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Estimated time:</span>
                          <span className="font-medium">
                            {formData.type === 'animation'
                              ? `${Math.ceil(totalFrames * 0.5)} minutes`
                              : '2-5 minutes'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={prevStep}
                className="border-white/20 hover:bg-white/5"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Back to Settings
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isUploading}
                className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Uploading & Creating Job...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Start Rendering
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )

      case 'processing':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
              {isUploading ? (
                <Loader2 className="w-16 h-16 text-emerald-400 animate-spin" />
              ) : (
                <CheckCircle className="w-16 h-16 text-emerald-400" />
              )}
            </div>

            <h2 className="text-2xl font-bold mb-4">
              {isUploading ? 'Uploading Your File...' : 'Job Created Successfully!'}
            </h2>

            {isUploading ? (
              <>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                  {uploadStage === 'preparing' && 'Preparing upload...'}
                  {uploadStage === 'uploading' && `Uploading ${uploadProgress}% complete`}
                  {uploadStage === 'creating' && 'Creating job in database...'}
                </p>

                <Progress value={uploadProgress} className="max-w-md mx-auto mb-6" />

                <div className="space-y-2 text-sm text-gray-400">
                  <p>{uploadProgress >= 10 ? '✓' : '⏳'} Preparing upload</p>
                  <p>{uploadProgress >= 50 ? '✓' : '⏳'} Uploading file parts</p>
                  <p>{uploadProgress >= 90 ? '✓' : '⏳'} Finalizing upload</p>
                  <p>{uploadStage === 'completed' ? '✓' : '⏳'} Creating job record</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                  Your render job has been created and is being processed.
                  Redirecting to job details...
                </p>
                <Progress value={100} className="max-w-md mx-auto mb-6" />
              </>
            )}
          </motion.div>
        )
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white py-8"
    >
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Create New <span className="text-blue-400">Render Job</span>
              </h1>
              <p className="text-gray-400">
                Follow the steps to configure and start your rendering job
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/client/dashboard')}
                className="border-white/20 hover:bg-white/5"
              >
                Cancel
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 -translate-y-1/2 z-0" />
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -translate-y-1/2 z-0 transition-all duration-500"
              style={{
                width: `${(steps.findIndex(s => s.id === currentStep) / (steps.length - 1)) * 100}%`
              }}
            />

            {/* Steps */}
            {steps.map((step, index) => {
              const currentIndex = steps.findIndex(s => s.id === currentStep)
              const isActive = step.id === currentStep
              const isCompleted = index < currentIndex
              const isUpcoming = index > currentIndex

              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center
                      transition-all duration-300
                      ${isActive
                        ? 'bg-blue-500 border-2 border-blue-500 shadow-lg shadow-blue-500/30'
                        : isCompleted
                          ? 'bg-emerald-500 border-2 border-emerald-500'
                          : 'bg-gray-800 border-2 border-white/20'
                      }
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6 text-white" />
                    ) : (
                      <step.icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    )}
                  </div>
                  <span className={`mt-2 text-sm font-medium ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                    {step.title}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">Step {index + 1}</span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

export default CreateJob