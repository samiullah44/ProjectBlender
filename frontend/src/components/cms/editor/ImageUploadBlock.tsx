import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Editor } from '@tiptap/react'
import toast from 'react-hot-toast'
import { ImageIcon, Loader2, AlertCircle, Upload } from 'lucide-react'

interface ImageUploadBlockProps {
  editor: Editor
}

type UploadState = 'idle' | 'uploading' | 'error'

export function ImageUploadBlock({ editor }: ImageUploadBlockProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const uploadFile = useCallback(
    async (file: File) => {
      setUploadState('uploading')
      setErrorMessage(null)

      const formData = new FormData()
      formData.append('image', file)

      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/cms/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error ?? 'Upload failed')
        }

        // Insert image into editor at current cursor position
        editor.chain().focus().setImage({ src: data.url }).run()
        setUploadState('idle')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Image upload failed'
        setErrorMessage(message)
        setUploadState('error')
        toast.error(message)
      }
    },
    [editor]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        uploadFile(file)
      }
    },
    [uploadFile]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'image/webp': [],
    },
    maxSize: 10 * 1024 * 1024, // 10 MB
    multiple: false,
    disabled: uploadState === 'uploading',
    onDropRejected: (rejections) => {
      const reason = rejections[0]?.errors[0]
      const message =
        reason?.code === 'file-too-large'
          ? 'File exceeds 10 MB limit'
          : reason?.code === 'file-invalid-type'
          ? 'Only JPEG, PNG, GIF, and WebP images are allowed'
          : 'File rejected'
      setErrorMessage(message)
      setUploadState('error')
      toast.error(message)
    },
  })

  if (uploadState === 'uploading') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-gray-800/50 px-4 py-3 text-sm text-gray-400">
        <Loader2 size={16} className="animate-spin text-indigo-400 shrink-0" />
        <span>Uploading image…</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
            : 'border-white/10 bg-gray-800/30 text-gray-400 hover:border-white/20 hover:bg-gray-800/50 hover:text-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex items-center gap-2">
          {isDragActive ? (
            <Upload size={20} className="text-indigo-400" />
          ) : (
            <ImageIcon size={20} />
          )}
          <span className="text-sm font-medium">
            {isDragActive ? 'Drop image here' : 'Drag & drop an image, or click to browse'}
          </span>
        </div>
        <p className="text-xs text-gray-500">JPEG, PNG, GIF, WebP — max 10 MB</p>
      </div>

      {uploadState === 'error' && errorMessage && (
        <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  )
}
