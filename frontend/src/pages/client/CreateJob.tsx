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
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import jobStore from '@/stores/jobStore'
import { toast } from 'react-hot-toast'
import { uploadService } from '@/services/uploadService'
import { axiosInstance } from '@/lib/axios'
import { useRenderNetwork } from '@/hooks/useRenderNetwork'
import { useAuthStore } from '@/stores/authStore'
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
  outputFormat: 'PNG' | 'JPEG' | 'EXR' | 'TIFF' | 'TARGA' | 'BMP' | 'OPEN_EXR'
  colorMode: 'BW' | 'RGB' | 'RGBA'
  colorDepth: '8' | '16' | '32'
  compression: number
  exrCodec?: 'ZIP' | 'PIZ' | 'RLE' | 'ZIPS' | 'BXR' | 'DWAA' | 'DWAB'
  tiffCodec?: 'NONE' | 'PACKBITS' | 'DEFLATE' | 'LZW'
  denoiser?: 'NONE' | 'OPTIX' | 'OPENIMAGEDENOISE' | 'NLM'
  selectedFrame?: number
  creditsPerFrame: number
  blenderVersion?: string
  scene?: string
  camera?: string
}

interface JobFormData {
  name: string
  description: string
  projectId: string
  type: 'image' | 'animation'
  startFrame: number
  endFrame: number
  selectedFrame: number
  settings: JobSettings
}

// NEW: Form validation helper (moved from utils/jobFormData.ts)
const validateJobForm = (data: Partial<JobFormData>, uploadedFile: File | null): string[] => {
  const errors: string[] = []

  if (!uploadedFile) errors.push('Blender file or Zip archive is required')
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
    uploadStage,
    cancelJob
  } = jobStore()

  const { creditedAmount, isRefreshing, fetchCreditBalance, lockPayment, cancelJobOnchain } = useRenderNetwork()
  const { getProfile } = useAuthStore()

  const [currentStep, setCurrentStep] = useState<Step>('upload')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isLocking, setIsLocking] = useState(false)

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
      colorMode: 'RGBA',
      colorDepth: '8',
      compression: 0,
      denoiser: 'OPTIX',
      creditsPerFrame: 1,
      blenderVersion: '4.5.0'
    }
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip'
      const maxSize = isZip ? 2 * 1024 * 1024 * 1024 : 500 * 1024 * 1024;
      const displaySize = isZip ? '2GB' : '500MB';
      
      if (file.size > maxSize) {
        toast.error(`File size exceeds ${displaySize} limit`)
        return
      }
      setUploadedFile(file)
      if (!formData.name.trim()) {
        setFormData(prev => ({
          ...prev,
          name: file.name.replace('.blend', '').replace('.zip', '')
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
      'application/zip': ['.zip']
    },
    multiple: false,
    maxSize: 2 * 1024 * 1024 * 1024,
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
      // Pre-check on-chain credits BEFORE starting S3 upload/job creation.
      // Otherwise we might create the job/upload files and only fail later on lock_payment.
      const freshBalance = await fetchCreditBalance()
      if (freshBalance < estimatedCost) {
        toast.error(`Insufficient credits: ${freshBalance.toFixed(2)} available, ${estimatedCost} required.`)
        return
      }

      console.log('🔄 Calling createJobMultipart...')

      // Switch to processing view immediately so the user can see realtime upload progress
      setCurrentStep('processing')

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

        // Get jobId from result (check multiple possible locations)
        const jobId = result.data?.jobId || result.data?.data?.jobId

        if (jobId) {
          let didLockOnchain = false
          try {
            setIsLocking(true)
            toast.loading('Confirming on-chain payment lock...', { id: 'payment-lock' })
            
            const { tx, escrowAddress, escrowJobId } = await lockPayment(jobId, estimatedCost)
            didLockOnchain = true
            toast.success('On-chain payment locked!', { id: 'payment-lock' })

            // 3. Sync with backend
            toast.loading('Finalizing job activation...', { id: 'backend-sync' })
            await axiosInstance.post(`/jobs/${jobId}/lock-onchain`, {
              txSignature: tx,
              escrowAddress,
              escrowJobId,
              lockedAmount: estimatedCost
            })

            // Backend deducts DB tokenBalance when lock-onchain succeeds.
            // Refresh the frontend store so the navbar shows the correct balance.
            await getProfile()
            toast.success('Job activated and enqueued!', { id: 'backend-sync' })

            console.log('🎯 Navigating to job details:', jobId)
            setTimeout(() => {
              navigate(`/client/jobs/${jobId}`)
            }, 1500)
          } catch (error: any) {
            console.error('Submission error:', error)
            
            if (didLockOnchain) {
              // We locked onchain but backend failed. IMPORTANT: Don't just cancel.
              toast.error('Payment locked but backend sync failed. Please check your Dashboard.', { duration: 5000 })
            } else if (jobId) {
              try {
                await cancelJob(jobId, true)
              } catch (e) {
                console.error('Failed to cleanup job:', e)
              }
            }
            
            toast.error(error?.message || 'Failed to start job')
            setCurrentStep('review')
          } finally {
            setIsLocking(false)
          }
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
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {/* ── Upload Section ─────────────────────────────────── */}
            <div className="relative group">
              {/* Outer Glow Decor */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

              <Card className="relative overflow-hidden bg-gray-950/40 border-white/10 backdrop-blur-xl rounded-3xl p-1 shadow-2xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
                          <Upload className="w-6 h-6" />
                        </span>
                        Source Asset
                      </CardTitle>
                      <CardDescription className="pt-2 text-gray-400">
                        Upload your Blender scene file or a .zip project archive to initiate the distributed rendering process
                      </CardDescription>
                    </div>
                    {/* Size Limit Badge */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase text-center">Max: 2GB (.zip) / 500MB (.blend)</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4">
                  <div
                    {...getRootProps()}
                    className={`
                      relative group/drop overflow-hidden border-2 border-dashed rounded-2xl transition-all duration-500 cursor-pointer
                      ${isDragActive
                        ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                        : uploadedFile
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-white/10 bg-black/40 hover:border-blue-500/40 hover:bg-blue-500/5'
                      }
                    `}
                  >
                    {/* Decorative Background Grid */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                      style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                    <input {...getInputProps()} />

                    <div className="relative py-8 px-6 text-center z-10">
                      {uploadedFile ? (
                        <div className="flex flex-col items-center gap-5">
                          <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
                            <div className="relative w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                              <CheckCircle className="w-10 h-10 text-emerald-400" />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-xl font-bold text-white tracking-tight">File Loaded Successfully</h4>
                            <p className="text-emerald-400/80 font-mono text-sm">SYSTEM_ID: {uploadedFile.name.replace(/\s+/g, '_').toUpperCase()}</p>
                          </div>

                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                setUploadedFile(null)
                              }}
                              className="text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 h-8"
                            >
                              <X className="w-3.5 h-3.5 mr-1.5" />
                              Detach
                            </Button>
                            <div className="w-px h-4 bg-white/10" />
                            <span className="text-[10px] font-bold text-gray-500 tracking-tighter uppercase whitespace-nowrap">
                              Ready for parsing
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-5">
                          {/* Animated Icon Container */}
                          <div className="relative">
                            <div className={`absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full transition-opacity duration-500 ${isDragActive ? 'opacity-100' : 'opacity-0'}`} />
                            <div className={`
                              relative w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500
                              ${isDragActive
                                ? 'bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.4)] rotate-12 scale-110'
                                : 'bg-white/5 border border-white/10 group-hover/drop:bg-blue-600/10 group-hover/drop:border-blue-500/30'
                              }
                            `}>
                              <Upload className={`w-10 h-10 transition-all duration-500 ${isDragActive ? 'text-white scale-125' : 'text-blue-500'}`} />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-2xl font-bold text-white tracking-tight">
                              {isDragActive ? 'Release to Initiate' : 'Drag & Drop .blend or .zip'}
                            </h4>
                            <p className="text-gray-400 text-sm max-w-[280px] leading-relaxed mx-auto">
                              Securely upload your scene or project archive. We'll automatically identify textures and dependencies in .zip.
                            </p>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="h-px w-8 bg-white/10" />
                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">OR</span>
                            <div className="h-px w-8 bg-white/10" />
                          </div>

                          <Button
                            variant="secondary"
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-7 py-4 rounded-xl shadow-lg shadow-blue-900/20 text-sm"
                          >
                            Explore File System
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {uploadedFile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 p-1 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20"
                    >
                      <div className="bg-gray-900/80 backdrop-blur-md rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                            <File className="w-6 h-6 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white truncate max-w-[200px] md:max-w-xs">{uploadedFile.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] tabular-nums font-mono text-gray-400">{(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                              <div className="w-1 h-1 rounded-full bg-gray-600" />
                              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Verified Integrity</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Action Footer ─────────────────────────────────── */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => navigate('/client/dashboard')}
                className="text-gray-400 hover:text-white hover:bg-white/5 px-6"
              >
                Abort
              </Button>
              <Button
                onClick={nextStep}
                disabled={!uploadedFile}
                className={`
                   h-14 px-10 rounded-2xl font-bold transition-all duration-500 flex items-center gap-3
                   ${uploadedFile
                    ? 'bg-white text-black hover:bg-blue-50 shadow-xl shadow-white/5'
                    : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
                  }
                `}
              >
                Next: Settings
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )

      case 'settings':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* ── Header Banner ─────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-900/80 p-6">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/5 to-transparent pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-3">
                    <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-900/40">
                      <Settings className="w-5 h-5 text-white" />
                    </span>
                    Render Configuration
                  </h2>
                  <p className="text-sm text-gray-400">Set up your job details, engine, output format, and quality</p>
                </div>
                {uploadedFile && (
                  <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                    <File className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-300 max-w-[180px] truncate">{uploadedFile.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 1: Job Info + Render Type ──────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Job Details */}
              <div className="rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-sm p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-6 rounded-full bg-blue-500 block" />
                  <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Job Details</h3>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Job Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all text-sm"
                    placeholder="e.g., Character Animation v3"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all text-sm resize-none"
                    placeholder="Brief description of this render job..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Render Type + Frame Range */}
              <div className="rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-sm p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-6 rounded-full bg-purple-500 block" />
                  <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Render Type</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { type: 'image', label: 'Single Image', sub: 'One frame', icon: <ImageIcon className="w-5 h-5" /> },
                    { type: 'animation', label: 'Animation', sub: 'Frame sequence', icon: <Film className="w-5 h-5" /> }
                  ] as const).map(({ type, label, sub, icon }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleInputChange('type', type)}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${formData.type === type
                        ? 'border-blue-500 bg-blue-600/15 text-white shadow-lg shadow-blue-900/20'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                        }`}
                    >
                      <span className={`${formData.type === type ? 'text-blue-400' : 'text-gray-500'}`}>{icon}</span>
                      <div className="text-left">
                        <div className="font-semibold text-sm">{label}</div>
                        <div className="text-xs opacity-60">{sub}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {formData.type === 'image' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Frame Number</label>
                    <input
                      type="number"
                      value={formData.selectedFrame}
                      onChange={(e) => handleInputChange('selectedFrame', parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none transition-all text-sm"
                      min="1"
                    />
                  </div>
                )}

                {formData.type === 'animation' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Frame Range</label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <input
                          type="number"
                          value={formData.startFrame}
                          onChange={(e) => handleInputChange('startFrame', parseInt(e.target.value) || 1)}
                          className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none transition-all text-sm"
                          min="1"
                        />
                        <div className="text-[10px] text-gray-500 mt-1 pl-1">Start frame</div>
                      </div>
                      <div className="text-gray-600 font-bold text-lg mt-[-12px]">→</div>
                      <div className="flex-1">
                        <input
                          type="number"
                          value={formData.endFrame}
                          onChange={(e) => handleInputChange('endFrame', parseInt(e.target.value) || 1)}
                          className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none transition-all text-sm"
                          min={formData.startFrame + 1}
                        />
                        <div className="text-[10px] text-gray-500 mt-1 pl-1">End frame</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      <Film className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs text-blue-300 font-medium">{totalFrames} frames total</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 2: Engine + Device ─────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Engine */}
              <div className="rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-1.5 h-6 rounded-full bg-amber-500 block" />
                  <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Render Engine</h3>
                </div>
                <div className="space-y-2.5">
                  {([
                    { engine: 'CYCLES', icon: <Palette className="w-5 h-5" />, color: 'text-purple-400', title: 'Cycles', sub: 'Physically-based path tracer', tag: 'Photorealistic' },
                    { engine: 'EEVEE', icon: <Zap className="w-5 h-5" />, color: 'text-amber-400', title: 'Eevee', sub: 'Real-time renderer', tag: 'Fast' }
                  ] as const).map(({ engine, icon, color, title, sub, tag }) => (
                    <button
                      key={engine}
                      type="button"
                      onClick={() => handleSettingsChange('engine', engine)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${formData.settings.engine === engine
                        ? 'border-blue-500 bg-blue-600/10 shadow-md shadow-blue-900/20'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                    >
                      <span className={`${color} ${formData.settings.engine === engine ? '' : 'opacity-50'}`}>{icon}</span>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-sm text-white">{title}</div>
                        <div className="text-xs text-gray-500">{sub}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${formData.settings.engine === engine
                        ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                        : 'bg-white/5 border-white/10 text-gray-500'
                        }`}>{tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Device + Blender Version */}
              <div className="rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-sm p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-6 rounded-full bg-emerald-500 block" />
                  <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Device</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { device: 'GPU', icon: <Gauge className="w-5 h-5" />, color: 'text-emerald-400', title: 'GPU', sub: 'CUDA / OPTIX' },
                    { device: 'CPU', icon: <Cpu className="w-5 h-5" />, color: 'text-blue-400', title: 'CPU', sub: 'Compatible' }
                  ] as const).map(({ device, icon, color, title, sub }) => (
                    <button
                      key={device}
                      type="button"
                      onClick={() => handleSettingsChange('device', device)}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${formData.settings.device === device
                        ? 'border-blue-500 bg-blue-600/15 text-white shadow-lg shadow-blue-900/20'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                        }`}
                    >
                      <span className={`${formData.settings.device === device ? color : 'text-gray-600'}`}>{icon}</span>
                      <div className="text-left">
                        <div className="font-semibold text-sm">{title}</div>
                        <div className="text-xs opacity-50">{sub}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Blender Version</label>
                  <select
                    value={formData.settings.blenderVersion || '4.5.0'}
                    onChange={(e) => handleSettingsChange('blenderVersion', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#111827] text-white border border-white/10 focus:border-blue-500 focus:outline-none transition-all text-sm appearance-none"
                  >
                    <optgroup label="Blender 5.0" className="bg-[#111827] text-white">
                      <option value="5.0.0" className="bg-[#111827] text-white">5.0.0</option>
                      <option value="5.0.1" className="bg-[#111827] text-white">5.0.1</option>
                    </optgroup>
                    <optgroup label="Blender 4.5 LTS" className="bg-[#111827] text-white">
                      <option value="4.5.0" className="bg-[#111827] text-white">4.5.0 (Default)</option>
                      <option value="4.5.1" className="bg-[#111827] text-white">4.5.1</option>
                      <option value="4.5.2" className="bg-[#111827] text-white">4.5.2</option>
                      <option value="4.5.3" className="bg-[#111827] text-white">4.5.3</option>
                    </optgroup>
                    <optgroup label="Blender 4.4" className="bg-[#111827] text-white">
                      <option value="4.4.0" className="bg-[#111827] text-white">4.4.0</option>
                      <option value="4.4.1" className="bg-[#111827] text-white">4.4.1</option>
                      <option value="4.4.2" className="bg-[#111827] text-white">4.4.2</option>
                      <option value="4.4.3" className="bg-[#111827] text-white">4.4.3</option>
                    </optgroup>
                    <optgroup label="Blender 4.3" className="bg-[#111827] text-white">
                      <option value="4.3.0" className="bg-[#111827] text-white">4.3.0</option>
                      <option value="4.3.1" className="bg-[#111827] text-white">4.3.1</option>
                      <option value="4.3.2" className="bg-[#111827] text-white">4.3.2</option>
                    </optgroup>
                    <optgroup label="Blender 4.2 LTS" className="bg-[#111827] text-white">
                      {['4.2.0', '4.2.1', '4.2.2', '4.2.3', '4.2.4', '4.2.5', '4.2.6', '4.2.7', '4.2.8', '4.2.9', '4.2.10', '4.2.11', '4.2.12', '4.2.13', '4.2.14', '4.2.15', '4.2.16', '4.2.17', '4.2.18', '4.2.19', '4.2.20', '4.2.21', '4.2.22', '4.2.23', '4.2.24', '4.2.25'].map(v => (
                        <option key={v} value={v} className="bg-[#111827] text-white">{v}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Blender 4.1" className="bg-[#111827] text-white">
                      <option value="4.1.0" className="bg-[#111827] text-white">4.1.0</option>
                      <option value="4.1.1" className="bg-[#111827] text-white">4.1.1</option>
                    </optgroup>
                    <optgroup label="Blender 4.0" className="bg-[#111827] text-white">
                      <option value="4.0.0" className="bg-[#111827] text-white">4.0.0</option>
                      <option value="4.0.1" className="bg-[#111827] text-white">4.0.1</option>
                      <option value="4.0.2" className="bg-[#111827] text-white">4.0.2</option>
                    </optgroup>
                    <optgroup label="Blender 3.6 LTS" className="bg-[#111827] text-white">
                      {['3.6.0', '3.6.1', '3.6.2', '3.6.3', '3.6.4', '3.6.5', '3.6.6', '3.6.7', '3.6.8', '3.6.9', '3.6.10', '3.6.11', '3.6.12', '3.6.13', '3.6.14', '3.6.15', '3.6.16', '3.6.17', '3.6.18'].map(v => (
                        <option key={v} value={v} className="bg-[#111827] text-white">{v}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Blender 3.5 – 2.90" className="bg-[#111827] text-white">
                      {['3.5.0', '3.5.1', '3.4.0', '3.4.1', '3.3.0', '3.3.21', '3.2.0', '3.2.2', '3.1.0', '3.1.2', '3.0.0', '3.0.1', '2.93.0', '2.93.18', '2.92.0', '2.91.0', '2.91.2', '2.90.0', '2.90.1'].map(v => (
                        <option key={v} value={v} className="bg-[#111827] text-white">{v}</option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-[10px] text-gray-600 mt-1.5 pl-1">Match the version used to create your .blend file</p>
                </div>
              </div>
            </div>

            {/* ── Row 3: Resolution + Samples ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Resolution */}
              <div className="rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-sm p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-6 rounded-full bg-cyan-500 block" />
                  <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Resolution</h3>
                </div>
                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2">
                  {([
                    { label: 'HD', w: 1280, h: 720 },
                    { label: 'FHD', w: 1920, h: 1080 },
                    { label: '2K', w: 2560, h: 1440 },
                    { label: '4K', w: 3840, h: 2160 },
                    { label: 'Square', w: 1080, h: 1080 },
                  ]).map(({ label, w, h }) => {
                    const active = formData.settings.resolutionX === w && formData.settings.resolutionY === h
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => { handleSettingsChange('resolutionX', w); handleSettingsChange('resolutionY', h) }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${active
                          ? 'bg-cyan-600/20 border-cyan-500/60 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
                          }`}
                      >
                        {label}
                        <span className="ml-1 opacity-50 text-[9px]">{w}×{h}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Width (px)</label>
                    <input
                      type="number"
                      value={formData.settings.resolutionX}
                      onChange={(e) => handleSettingsChange('resolutionX', parseInt(e.target.value) || 1920)}
                      className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:border-cyan-500 focus:outline-none transition-all text-sm"
                      min="1" max="16384"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Height (px)</label>
                    <input
                      type="number"
                      value={formData.settings.resolutionY}
                      onChange={(e) => handleSettingsChange('resolutionY', parseInt(e.target.value) || 1080)}
                      className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:border-cyan-500 focus:outline-none transition-all text-sm"
                      min="1" max="16384"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-cyan-500/8 border border-cyan-500/15 rounded-lg px-3 py-2">
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs text-cyan-300 font-medium">{formData.settings.resolutionX} × {formData.settings.resolutionY}px</span>
                  <span className="text-[10px] text-gray-500">
                    — {(formData.settings.resolutionX / formData.settings.resolutionY).toFixed(2)}:1 ratio
                  </span>
                </div>
              </div>

              {/* Samples */}
              <div className="rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-sm p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-6 rounded-full bg-rose-500 block" />
                  <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Render Quality</h3>
                </div>
                {/* Sample presets */}
                <div className="flex flex-wrap gap-2">
                  {([
                    { label: 'Preview', v: 64 },
                    { label: 'Draft', v: 128 },
                    { label: 'Good', v: 256 },
                    { label: 'Final', v: 512 },
                    { label: 'Studio', v: 1024 },
                  ]).map(({ label, v }) => {
                    const active = formData.settings.samples === v
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleSettingsChange('samples', v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${active
                          ? 'bg-rose-600/20 border-rose-500/60 text-rose-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
                          }`}
                      >
                        {label}
                        <span className="ml-1 opacity-50 text-[9px]">{v}</span>
                      </button>
                    )
                  })}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Samples</label>
                    <span className="text-lg font-bold text-white tabular-nums">{formData.settings.samples}</span>
                  </div>
                  <input
                    type="range"
                    min="32"
                    max="2048"
                    step="32"
                    value={formData.settings.samples}
                    onChange={(e) => handleSettingsChange('samples', parseInt(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-rose-500 bg-gray-700"
                  />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>32 (fast)</span>
                    <span>512</span>
                    <span>1024</span>
                    <span>2048 (slow)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 4: Professional Output Settings ────────────── */}
            <div className="rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-sm p-5">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-1.5 h-6 rounded-full bg-violet-500 block" />
                <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Professional Output</h3>
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-300 font-medium">Advanced</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                {/* Output Format */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Output Format</label>
                  <div className="relative">
                    <select
                      value={formData.settings.outputFormat}
                      onChange={(e) => handleSettingsChange('outputFormat', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#0f172a] text-white border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 focus:outline-none transition-all text-sm appearance-none pr-8"
                    >
                      <option value="PNG" className="bg-[#0f172a] text-white">PNG — Lossless</option>
                      <option value="OPEN_EXR" className="bg-[#0f172a] text-white">OpenEXR — VFX/HDR</option>
                      <option value="JPEG" className="bg-[#0f172a] text-white">JPEG — Compressed</option>
                      <option value="TIFF" className="bg-[#0f172a] text-white">TIFF — Print Quality</option>
                      <option value="TARGA" className="bg-[#0f172a] text-white">Targa — Game Dev</option>
                      <option value="BMP" className="bg-[#0f172a] text-white">BMP — Legacy</option>
                    </select>
                    <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 rotate-90 pointer-events-none" />
                  </div>
                </div>

                {/* Color Mode */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Color Mode</label>
                  <div className="flex gap-1 p-1 bg-[#0f172a] rounded-xl border border-white/10">
                    {(['BW', 'RGB', 'RGBA'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleSettingsChange('colorMode', mode)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${formData.settings.colorMode === mode
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                          : 'text-gray-500 hover:text-white'
                          }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5 pl-1">
                    {formData.settings.colorMode === 'BW' ? 'Grayscale — smallest file' : formData.settings.colorMode === 'RGB' ? 'Full color — no alpha' : 'Full color + transparency'}
                  </p>
                </div>

                {/* Color Depth */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Bit Depth</label>
                  <div className="flex gap-1 p-1 bg-[#0f172a] rounded-xl border border-white/10">
                    {(['8', '16', '32'] as const).map((depth) => {
                      const is32Disabled = depth === '32' && formData.settings.outputFormat !== 'OPEN_EXR'
                      return (
                        <button
                          key={depth}
                          type="button"
                          disabled={is32Disabled}
                          onClick={() => handleSettingsChange('colorDepth', depth)}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${formData.settings.colorDepth === depth
                            ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                            : 'text-gray-500 hover:text-white'
                            } ${is32Disabled ? 'opacity-25 cursor-not-allowed' : ''}`}
                        >
                          {depth}-bit
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5 pl-1">
                    {formData.settings.colorDepth === '8' ? 'Standard — web & delivery' : formData.settings.colorDepth === '16' ? 'Professional — print & grading' : 'HDR — EXR compositing only'}
                  </p>
                </div>

                {/* Compression */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {formData.settings.outputFormat === 'JPEG' ? 'Quality' : 'Compression'}
                    </label>
                    <span className="text-xs font-bold text-violet-400 tabular-nums">{formData.settings.compression}%</span>
                  </div>
                  <div className="bg-[#0f172a] rounded-xl border border-white/10 px-3 py-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.settings.compression}
                      onChange={(e) => handleSettingsChange('compression', parseInt(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-violet-500 bg-gray-700"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-1.5">
                      <span>{formData.settings.outputFormat === 'JPEG' ? 'Lowest' : 'None (fast)'}</span>
                      <span>{formData.settings.outputFormat === 'JPEG' ? 'Best' : 'Max (slow)'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Navigation Buttons ─────────────────────────────── */}
            <div className="flex justify-between pt-1">
              <Button
                variant="outline"
                onClick={prevStep}
                className="border-white/20 hover:bg-white/5 gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={nextStep}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-900/30 gap-2 px-6"
              >
                Next: Review
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )

      case 'review':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pb-8"
          >
            {/* ── Summary Header ─────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gray-950/40 p-6 backdrop-blur-xl">
              <div className="absolute top-0 right-0 p-4">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Protocol Validated</span>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Final Specification Review</h2>
                  <p className="text-sm text-gray-400">Validate all parameters before committing to the render cluster</p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-2">Job Identifier</span>
                  <span className="text-sm font-mono text-white truncate">{formData.name || 'UNSPECIFIED'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-2">Pipeline Type</span>
                  <span className="text-sm font-bold text-blue-400 uppercase tracking-tight">{formData.type}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-2">Frame Sequence</span>
                  <span className="text-sm font-mono text-white">
                    {formData.type === 'animation'
                      ? `${formData.startFrame} → ${formData.endFrame}`
                      : `SOLO [${formData.selectedFrame}]`
                    }
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-2">Asset Mass</span>
                  <span className="text-sm font-mono text-white">{(uploadedFile?.size ?? 0) / (1024 * 1024) >= 1 ? `${((uploadedFile?.size ?? 0) / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* ── Main Data Grid ─────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Technical Specs */}
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-3xl border border-white/10 bg-gray-900/40 p-1">
                  <div className="bg-black/40 rounded-[22px] p-6 space-y-6">
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5 text-blue-400" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-widest">Engine Parameters</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Render Core</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{formData.settings.engine}</span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">{formData.settings.device} ACCEL</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Input Resolution</p>
                        <p className="text-sm font-bold text-white tabular-nums">{formData.settings.resolutionX} × {formData.settings.resolutionY}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Sample Count</p>
                        <p className="text-sm font-bold text-white tabular-nums">{formData.settings.samples} <span className="text-gray-500 font-normal">SAMPLES/PIXEL</span></p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Output Definition</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white uppercase">{formData.settings.outputFormat}</span>
                          <span className="text-[10px] font-bold text-gray-500">{formData.settings.colorMode} {formData.settings.colorDepth}-BIT</span>
                        </div>
                      </div>

                      {formData.settings.denoiser !== 'NONE' && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-500 uppercase">Noise Mitigation</p>
                          <p className="text-sm font-bold text-emerald-400 uppercase tracking-tight">{formData.settings.denoiser}</p>
                        </div>
                      )}

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Target Version</p>
                        <p className="text-sm font-bold text-gray-300">Blender {formData.settings.blenderVersion || '4.5.0'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Extended Details Card */}
                <div className="rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <Clock className="w-5 h-5 text-purple-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Cluster Distribution Estimate</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/30 border border-white/5">
                      <div className="p-3 rounded-xl bg-purple-600/10 text-purple-400">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">EST_NODE_TIME</p>
                        <p className="text-lg font-bold text-white">
                          {formData.type === 'animation'
                            ? `${Math.ceil(totalFrames * 0.5)}m - ${Math.ceil(totalFrames * 1.5)}m`
                            : '45s - 120s'
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/30 border border-white/5">
                      <div className="p-3 rounded-xl bg-blue-600/10 text-blue-400">
                        <Cpu className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">ALLOCATED_POWER</p>
                        <p className="text-lg font-bold text-white">DYNAMIC_FARM</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Billing Summary */}
              <div className="space-y-6">
                <div className="relative group overflow-hidden rounded-3xl border border-white/10 p-1 transition-all duration-500 hover:border-blue-500/30">
                  <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-600/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

                  <div className="relative bg-gray-950/60 rounded-[22px] p-6 backdrop-blur-md">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Execution Cost</h3>

                    <div className="text-center py-6">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em] block mb-2">Total Tokens Required</span>
                      <div className="text-5xl font-black text-white tabular-nums tracking-tighter">
                        {estimatedCost}
                      </div>
                    </div>

                    <div className="space-y-3 pt-6 border-t border-white/5">
                      <div className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl">
                        <span className="text-xs text-gray-400">Compute Unit Price</span>
                        <span className="text-xs font-bold text-white">1.0 / FRAME</span>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl">
                        <span className="text-xs text-gray-400">Complexity Modifier</span>
                        <span className="text-xs font-bold text-violet-400">{(formData.settings.samples / 128).toFixed(2)}x</span>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl">
                        <span className="text-xs text-gray-400">Engine Overhead</span>
                        <span className="text-xs font-bold text-amber-400">{formData.settings.engine === 'CYCLES' ? '+20%' : '0%'}</span>
                      </div>
                    </div>

                    <div className="mt-8 p-4 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-center">
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Available Credits</p>
                      <p className="text-xl font-bold text-white tabular-nums">
                        {isRefreshing ? '...' : creditedAmount.toFixed(2)}
                      </p>
                      <div className="mt-2 w-full bg-white/5 h-1 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-1000",
                            creditedAmount >= estimatedCost ? "bg-blue-500" : "bg-red-500"
                          )} 
                          style={{ width: `${Math.min(100, (creditedAmount / estimatedCost) * 100)}%` }} 
                        />
                      </div>
                      {creditedAmount < estimatedCost && (
                        <div className="mt-3 space-y-2">
                          <p className="text-[10px] text-red-400 font-medium">Insufficient balance to start job</p>
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => window.dispatchEvent(new Event('open-deposit-modal'))}
                            className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-8 text-[10px] font-bold uppercase tracking-wider"
                          >
                            Deposit tokens
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-3xl border border-white/5 bg-gray-900/40">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-gray-400 italic">
                      "Estimates are based on average scene complexity. Final token consumption may vary ±5% based on actual render cycles used by cluster nodes."
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Action Footer ─────────────────────────────────── */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="ghost"
                onClick={prevStep}
                className="text-gray-400 hover:text-white hover:bg-white/5 gap-2 px-6"
              >
                <ChevronLeft className="w-4 h-4" />
                Adjust Parameters
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isUploading || isLocking || (creditedAmount < estimatedCost && !isRefreshing)}
                className={cn(
                  "relative overflow-hidden group h-16 px-12 rounded-2xl font-black text-lg transition-all active:scale-95 disabled:opacity-50",
                  (creditedAmount < estimatedCost && !isRefreshing) ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "bg-white text-black"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                <span className="relative z-10 flex items-center gap-3 group-hover:text-white transition-colors">
                  {isUploading || isLocking ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      {isLocking ? 'Locking Payment...' : 'Transmitting Manifest...'}
                    </>
                  ) : (
                    <>
                      <Play className="w-6 h-6 fill-current" />
                      {creditedAmount < estimatedCost ? 'Insufficient Credits' : 'Start Job'}
                    </>
                  )}
                </span>
              </Button>
            </div>
          </motion.div>
        )

      case 'processing':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12 px-6 min-h-[500px]"
          >
            {/* ── Progress Visualization ─────────────────────────── */}
            <div className="relative mb-12">
              {/* Outer Pulsing Glow */}
              <div className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-full animate-pulse" />

              {/* Circular Progress Ring */}
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-white/5"
                  />
                  <motion.circle
                    cx="96"
                    cy="96"
                    r="88"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: "0 1000" }}
                    animate={{ strokeDasharray: `${(uploadProgress / 100) * 553} 1000` }}
                    transition={{ type: "spring", stiffness: 50, damping: 15 }}
                    className="text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                  />
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-white tabular-nums tracking-tighter">
                    {uploadProgress}%
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Uploaded</span>
                </div>
              </div>

              {/* Orbital Icons */}
              <div className="absolute -top-4 -right-4 bg-gray-900 border border-white/10 p-2 rounded-xl shadow-xl animate-bounce">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
            </div>

            {/* ── Diagnostic Console ─────────────────────────────── */}
            <div className="w-full max-w-2xl">
              <div className="mb-2 flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live System Handshake</span>
                </div>
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Buffer_Load: Stable</span>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-6 shadow-2xl">
                {/* Scanline Effect */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,128,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20" />

                <div className="relative space-y-4 font-mono text-[11px]">
                  {/* Step 1: Initialization */}
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 ${uploadProgress >= 10 ? 'text-emerald-500' : 'text-blue-500 animate-pulse'}`}>
                      {uploadProgress >= 10 ? '[✓]' : '[ ]'}
                    </span>
                    <div className="flex-1">
                      <p className={uploadProgress >= 10 ? 'text-white' : 'text-gray-500'}>INITIALIZING_ENCRYPTION_LAYER</p>
                      {uploadProgress < 10 && <p className="text-[10px] text-blue-400/60 mt-0.5">Establishing secure RSA-2048 tunnel...</p>}
                    </div>
                  </div>

                  {/* Step 2: Binary Transmission */}
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 ${uploadProgress >= 90 ? 'text-emerald-500' : uploadProgress >= 10 ? 'text-blue-500 animate-pulse' : 'text-gray-700'}`}>
                      {uploadProgress >= 90 ? '[✓]' : uploadProgress >= 10 ? '[>]' : '[ ]'}
                    </span>
                    <div className="flex-1">
                      <p className={uploadProgress >= 10 ? 'text-white' : 'text-gray-500'}>TRANSMITTING_BINARY_ASSETS</p>
                      {uploadProgress >= 10 && uploadProgress < 90 && (
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-[10px] text-blue-400/60 font-bold uppercase">
                            <span>Packet_Stream</span>
                            <span>{Math.floor(uploadProgress * 1.2)}% ACK</span>
                          </div>
                          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                              initial={{ width: "0%" }}
                              animate={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Cluster Handover */}
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 ${uploadStage === 'completed' ? 'text-emerald-500' : uploadProgress >= 90 ? 'text-blue-500 animate-pulse' : 'text-gray-700'}`}>
                      {uploadStage === 'completed' ? '[✓]' : uploadProgress >= 90 ? '[>]' : '[ ]'}
                    </span>
                    <div className="flex-1">
                      <p className={uploadProgress >= 90 ? 'text-white' : 'text-gray-500'}>RENDER_CLUSTER_HANDOVER</p>
                      {uploadProgress >= 90 && uploadStage !== 'completed' && (
                        <p className="text-[10px] text-amber-400/60 mt-0.5 animate-pulse">Assigning compute nodes in EU-CENTRAL-1...</p>
                      )}
                    </div>
                  </div>

                  {/* Step 4: Finalization */}
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 ${uploadStage === 'completed' ? 'text-emerald-500 animate-pulse' : 'text-gray-700'}`}>
                      {uploadStage === 'completed' ? '[>]' : '[ ]'}
                    </span>
                    <div className="flex-1">
                      <p className={uploadStage === 'completed' ? 'text-white' : 'text-gray-500'}>ATOMIC_DATABASE_COMMIT</p>
                      {uploadStage === 'completed' && <p className="text-[10px] text-emerald-400/60 mt-0.5 tracking-wider">SECURE_COMMIT_ID: BF_{Math.floor(Math.random() * 90000 + 10000)}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Status Text ────────────────────────────────────── */}
            <div className="mt-12 text-center space-y-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {uploadStage === 'completed' ? 'Protocol Success!' : 'System Processing...'}
              </h2>
              <p className="text-gray-400 text-sm max-w-[320px] mx-auto leading-relaxed">
                {uploadStage === 'completed'
                  ? 'Your render architecture has been locked. Redirecting to job monitor now.'
                  : 'Distributing scene fragments across the compute matrix. Please maintain connection.'
                }
              </p>
            </div>
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
