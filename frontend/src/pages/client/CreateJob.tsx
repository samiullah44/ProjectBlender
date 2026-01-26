// pages/client/CreateJob.tsx
import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  X, 
  File, 
  Settings, 
  Cpu, 
  Clock,
  DollarSign,
  CheckCircle,
  ArrowRight,
  Folder,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'

interface JobFormData {
  name: string
  description: string
  engine: 'cycles' | 'eevee'
  samples: number
  resolution: {
    width: number
    height: number
  }
  frameRange: {
    start: number
    end: number
  }
  outputFormat: 'png' | 'exr' | 'jpg'
}

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  lastModified: number
  preview?: string
}

const CreateJob: React.FC = () => {
  const navigate = useNavigate()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [formData, setFormData] = useState<JobFormData>({
    name: '',
    description: '',
    engine: 'cycles',
    samples: 128,
    resolution: { width: 1920, height: 1080 },
    frameRange: { start: 1, end: 100 },
    outputFormat: 'png'
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setIsUploading(true)
    
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }))

    setUploadedFiles(prev => [...prev, ...newFiles])
    
    // Simulate upload progress
    setTimeout(() => {
      setIsUploading(false)
    }, 2000)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/x-blender': ['.blend'],
      'image/*': ['.png', '.jpg', '.jpeg', '.exr']
    },
    multiple: true
  })

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle job submission
    console.log('Submitting job:', { ...formData, files: uploadedFiles })
    navigate('/client/dashboard')
  }

  const handleInputChange = (field: keyof JobFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const presetResolutions = [
    { label: 'Full HD', width: 1920, height: 1080 },
    { label: '2K', width: 2048, height: 1080 },
    { label: '4K', width: 3840, height: 2160 },
    { label: '8K', width: 7680, height: 4320 }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white py-8"
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Create New <span className="text-blue-400">Render Job</span>
              </h1>
              <p className="text-gray-400">
                Upload your Blender file and configure render settings
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/client/dashboard')}
              className="border-white/20 hover:bg-white/5"
            >
              Cancel
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Upload */}
          <div className="lg:col-span-2 space-y-6">
            {/* File Upload */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-400" />
                    Upload Blender File
                  </CardTitle>
                  <CardDescription>
                    Drag and drop your .blend file or click to browse
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    {...getRootProps()}
                    className={`
                      border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                      transition-all duration-300 hover:border-blue-500/50 hover:bg-white/5
                      ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/20'}
                      ${uploadedFiles.length > 0 ? 'border-blue-500/30 bg-blue-500/5' : ''}
                    `}
                  >
                    <input {...getInputProps()} />
                    
                    {isUploading ? (
                      <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-full h-full border-4 border-blue-500/30 border-t-blue-500 rounded-full"
                          />
                        </div>
                        <p className="text-blue-400">Uploading files...</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                          <Upload className="w-8 h-8 text-blue-400" />
                        </div>
                        <p className="text-lg font-medium mb-2">
                          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                        </p>
                        <p className="text-gray-400 text-sm mb-4">
                          or click to select .blend files
                        </p>
                        <p className="text-xs text-gray-500">
                          Supports .blend files up to 5GB
                        </p>
                      </>
                    )}
                  </div>

                  {/* Uploaded Files List */}
                  <AnimatePresence>
                    {uploadedFiles.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 space-y-3"
                      >
                        <h3 className="font-medium text-sm text-gray-400">Uploaded Files</h3>
                        {uploadedFiles.map((file) => (
                          <motion.div
                            key={file.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                <File className="w-5 h-5 text-blue-400" />
                              </div>
                              <div>
                                <div className="font-medium text-sm truncate max-w-xs">
                                  {file.name}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(file.id)}
                              className="hover:bg-red-500/20 hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>

            {/* Job Details Form */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-purple-400" />
                    Render Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Job Name
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none"
                            placeholder="e.g., Character Animation v3"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Description (Optional)
                          </label>
                          <textarea
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none min-h-[100px]"
                            placeholder="Brief description of this render job..."
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Render Engine
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <Button
                              type="button"
                              variant={formData.engine === 'cycles' ? 'default' : 'outline'}
                              onClick={() => handleInputChange('engine', 'cycles')}
                              className="border-white/20"
                            >
                              <Cpu className="w-4 h-4 mr-2" />
                              Cycles
                            </Button>
                            <Button
                              type="button"
                              variant={formData.engine === 'eevee' ? 'default' : 'outline'}
                              onClick={() => handleInputChange('engine', 'eevee')}
                              className="border-white/20"
                            >
                              <ImageIcon className="w-4 h-4 mr-2" />
                              Eevee
                            </Button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Samples
                          </label>
                          <input
                            type="range"
                            min="32"
                            max="2048"
                            step="32"
                            value={formData.samples}
                            onChange={(e) => handleInputChange('samples', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-sm text-gray-400 mt-1">
                            <span>32</span>
                            <span className="text-blue-400">{formData.samples} samples</span>
                            <span>2048</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resolution & Frames */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Resolution
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {presetResolutions.map((preset) => (
                            <Button
                              key={preset.label}
                              type="button"
                              variant={
                                formData.resolution.width === preset.width &&
                                formData.resolution.height === preset.height
                                  ? 'default'
                                  : 'outline'
                              }
                              onClick={() => handleInputChange('resolution', preset)}
                              className="border-white/20 text-sm"
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Frame Range
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            value={formData.frameRange.start}
                            onChange={(e) => handleInputChange('frameRange', {
                              ...formData.frameRange,
                              start: parseInt(e.target.value)
                            })}
                            className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none"
                            min="1"
                          />
                          <span className="text-gray-400">to</span>
                          <input
                            type="number"
                            value={formData.frameRange.end}
                            onChange={(e) => handleInputChange('frameRange', {
                              ...formData.frameRange,
                              end: parseInt(e.target.value)
                            })}
                            className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none"
                            min={formData.frameRange.start + 1}
                          />
                          <span className="text-sm text-gray-400 ml-2">
                            ({formData.frameRange.end - formData.frameRange.start + 1} frames)
                          </span>
                        </div>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Summary & Actions */}
          <div className="space-y-6">
            {/* Cost Estimate */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    Cost Estimate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Frames to render:</span>
                      <span className="font-medium">
                        {formData.frameRange.end - formData.frameRange.start + 1}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Estimated time:</span>
                      <span className="font-medium">~45 minutes</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Credits required:</span>
                      <span className="text-xl font-bold text-emerald-400">120</span>
                    </div>
                    <div className="pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Your balance:</span>
                        <span className="font-medium text-lg">1,250 credits</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <Button
                      type="submit"
                      onClick={handleSubmit}
                      disabled={uploadedFiles.length === 0 || !formData.name}
                      className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Start Rendering
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full border-white/20 hover:bg-white/5"
                      onClick={() => {
                        // Save as draft functionality
                        console.log('Saved as draft')
                        navigate('/client/dashboard')
                      }}
                    >
                      Save as Draft
                    </Button>

                    <div className="pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>Need help? Check our documentation</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Jobs Preview */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Recent Jobs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => navigate(`/client/jobs/${job.id}`)}
                      >
                        <div>
                          <div className="text-sm font-medium truncate max-w-[150px]">
                            {job.name}
                          </div>
                          <div className="text-xs text-gray-400">{job.status}</div>
                        </div>
                        <div className="text-xs text-gray-400">{job.time}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const recentJobs = [
  { id: '1', name: 'Character Animation', status: 'Completed', time: '2h ago' },
  { id: '2', name: 'Product Visualization', status: 'Rendering', time: '5h ago' },
  { id: '3', name: 'Architectural Render', status: 'Queued', time: '1d ago' },
]

export default CreateJob