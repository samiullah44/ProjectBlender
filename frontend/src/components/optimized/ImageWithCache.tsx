// components/optimized/ImageWithCache.tsx
import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface ImageWithCacheProps {
  src: string
  alt: string
  className?: string
  fallbackSrc?: string
  onClick?: () => void
  priority?: boolean
}

// Simple in-memory cache for images
const imageCache = new Map<string, HTMLImageElement>()

const ImageWithCache: React.FC<ImageWithCacheProps> = ({
  src,
  alt,
  className = '',
  fallbackSrc = 'https://via.placeholder.com/300x300/1f2937/9ca3af?text=Loading...',
  onClick,
  priority = false,
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(fallbackSrc)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (!src) {
      setHasError(true)
      setCurrentSrc(fallbackSrc)
      return
    }

    // Check cache first
    if (imageCache.has(src)) {
      const cachedImg = imageCache.get(src)!
      setCurrentSrc(cachedImg.src)
      setIsLoading(false)
      return
    }

    // Reset states
    setIsLoading(true)
    setHasError(false)

    // Create new image for preloading
    const img = new Image()
    img.src = src

    const handleLoad = () => {
      // Add to cache
      imageCache.set(src, img)
      setCurrentSrc(src)
      setIsLoading(false)
    }

    const handleError = () => {
      setHasError(true)
      setCurrentSrc(fallbackSrc)
      setIsLoading(false)
    }

    img.addEventListener('load', handleLoad)
    img.addEventListener('error', handleError)

    // If priority is true, load immediately (image loads automatically when src is set)

    return () => {
      img.removeEventListener('load', handleLoad)
      img.removeEventListener('error', handleError)
    }
  }, [src, fallbackSrc, priority])

  // Setup intersection observer for lazy loading
  useEffect(() => {
    if (!imgRef.current || priority) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = new Image()
            img.src = src
            img.onload = () => {
              imageCache.set(src, img)
              setCurrentSrc(src)
              setIsLoading(false)
            }
            img.onerror = () => {
              setHasError(true)
              setCurrentSrc(fallbackSrc)
              setIsLoading(false)
            }
            
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '100px' }
    )

    observer.observe(imgRef.current)
    observerRef.current = observer

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [src, fallbackSrc, priority])

  return (
    <div className="relative">
      {isLoading && (
        <div className={`absolute inset-0 flex items-center justify-center bg-gray-900/50 ${className}`}>
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        </div>
      )}
      
      <motion.img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={onClick}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: isLoading ? 0 : 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        loading={priority ? 'eager' : 'lazy'}
        onError={() => {
          if (!hasError) {
            setHasError(true)
            setCurrentSrc(fallbackSrc)
            setIsLoading(false)
          }
        }}
      />
    </div>
  )
}

export default ImageWithCache