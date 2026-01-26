// components/layout/ProtectedLayout.tsx
import React from 'react'
import { Navigate } from 'react-router-dom'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: string[]
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles 
}) => {
  // Get user from your auth context
  const currentUser = {
    role: 'client' // Replace with actual user from auth context
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}