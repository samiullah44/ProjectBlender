import React from 'react'

/**
 * Skeleton placeholder shown while a lazy-loaded route is being fetched.
 * Uses CSS animations only (no Framer Motion) to avoid adding to the initial bundle.
 */
export const PageSkeleton: React.FC = () => (
  <div className="min-h-[60vh] w-full animate-pulse px-6 py-16">
    {/* Hero-like block */}
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="h-4 w-24 rounded-full bg-white/10" />
      <div className="h-10 w-3/4 rounded-xl bg-white/10" />
      <div className="h-10 w-1/2 rounded-xl bg-white/10" />
      <div className="h-4 w-full rounded-full bg-white/5" />
      <div className="h-4 w-5/6 rounded-full bg-white/5" />
      <div className="flex gap-4 pt-4">
        <div className="h-12 w-36 rounded-2xl bg-white/10" />
        <div className="h-12 w-36 rounded-2xl bg-white/5" />
      </div>
    </div>
    {/* Card grid */}
    <div className="max-w-5xl mx-auto mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 rounded-2xl bg-white/5" />
      ))}
    </div>
  </div>
)

/**
 * Minimal spinner for small inline suspense boundaries.
 */
export const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
  </div>
)

/**
 * Error fallback shown when a lazy-loaded chunk fails to load.
 */
export const LazyErrorFallback: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
    <p className="text-gray-400 text-lg">Failed to load this page.</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
      >
        Try again
      </button>
    )}
  </div>
)
