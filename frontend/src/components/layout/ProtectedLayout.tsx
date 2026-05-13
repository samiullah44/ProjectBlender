// components/layout/ProtectedLayout.tsx
import React, { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: ('client' | 'node_provider' | 'admin' | 'writer')[]
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles
}) => {
  const { isAuthenticated, user, isLoading } = useAuthStore()
  const location = useLocation()
  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Safety valve: if we've been in the loading/waiting state for more than 5 seconds,
  // treat it as unauthenticated to avoid an infinite spinner.
  useEffect(() => {
    const isWaiting = isLoading || (isAuthenticated && !user)
    if (isWaiting) {
      timerRef.current = setTimeout(() => setTimedOut(true), 5000)
    } else {
      setTimedOut(false)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isLoading, isAuthenticated, user])

  // Show loading state while fetching profile or waiting for user object
  if (!timedOut && (isLoading || (isAuthenticated && !user))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-gray-400">Restoring session...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if definitely not authenticated (or timed out waiting)
  if (!isAuthenticated || !user || timedOut) {
    // Clean up any stale state before redirecting
    if (timedOut) {
      useAuthStore.getState().logout(true)
    }
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check role-based access
  const userRoles = (user as any).roles || ((user as any).role ? [(user as any).role] : [])
  if (allowedRoles && !allowedRoles.some(role => userRoles.includes(role))) {
    return <Navigate to="/" replace />
  }

  // Render children if authenticated and authorized
  return <>{children}</>
}
