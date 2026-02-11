// App.tsx
import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'

// Public Pages
import HomePage from '@/pages/public/Home'
import Navbar from '@/components/layout/NavBar'
import LoginPage from '@/pages/public/Login'
import RegisterPage from '@/pages/public/Register'
import OAuthCallback from '@/pages/public/OAuthCallback'
import VerifyEmailPage from '@/pages/public/VerifyEmail'

// Client Pages
import ClientDashboard from '@/pages/client/Dashboard'
import CreateJob from '@/pages/client/CreateJob'
import JobDetails from '@/pages/client/JobDetails' // Add this import
// import ClientSettings from '@/pages/client/Settings'

// Node Pages
// import NodeDashboard from '@/pages/node/Dashboard'
// import NodeEarnings from '@/pages/node/Earnings'
// import NodeMachines from '@/pages/node/Machines'

// Admin Pages
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminJobs from '@/pages/admin/Jobs'
import AdminJobDetails from '@/pages/admin/JobDetails'

// Protected Route Component
import { ProtectedRoute } from '@/components/layout/ProtectedLayout'
import { useAuthStore } from '@/stores/authStore'

// Styles
import '@/index.css'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const AuthInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getProfile } = useAuthStore()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      getProfile().catch(() => {
        localStorage.removeItem('token')
      })
    }
  }, [getProfile])

  return <>{children}</>
}

// Main Layout component with Navbar
const MainLayout = () => {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="mx-auto">
        <Outlet />
      </main>
    </div>
  )
}

// Auth Layout (without Navbar)
const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-gray-950">
      <Outlet />
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <Router>
          <Routes>
            {/* Auth Routes (without Navbar) */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/callback" element={<OAuthCallback />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              {/* <Route path="/forgot-password" element={<ForgotPasswordPage />} /> */}
              {/* <Route path="/reset-password" element={<ResetPasswordPage />} /> */}
            </Route>
            {/* Public Routes with Navbar */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
              {/* <Route path="/login" element={<LoginPage />} /> */}
              {/* <Route path="/register" element={<RegisterPage />} /> */}

              {/* Dashboard Route */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['client', 'admin', 'node_provider']}>
                    <ClientDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Client Routes */}
              <Route
                path="/client/*"
                element={
                  <ProtectedRoute allowedRoles={['client', 'admin']}>
                    <Routes>
                      <Route path="/dashboard" element={<ClientDashboard />} />
                      <Route path="/create-job" element={<CreateJob />} />
                      <Route path="/jobs/:jobId" element={<JobDetails />} /> {/* Add this route */}
                      {/* <Route path="/jobs" element={<ClientJobs />} /> */}
                      {/* <Route path="/settings" element={<ClientSettings />} /> */}
                      {/* <Route path="/billing" element={<Billing />} /> */}
                    </Routes>
                  </ProtectedRoute>
                }
              />

              {/* Node Provider Routes */}
              <Route
                path="/node/*"
                element={
                  <ProtectedRoute allowedRoles={['node_provider', 'admin']}>
                    <Routes>
                      {/* <Route path="/dashboard" element={<NodeDashboard />} /> */}
                      {/* <Route path="/earnings" element={<NodeEarnings />} /> */}
                      {/* <Route path="/machines" element={<NodeMachines />} /> */}
                    </Routes>
                  </ProtectedRoute>
                }
              />

              {/* Admin Routes */}
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Routes>
                      <Route path="/dashboard" element={<AdminDashboard />} />
                      <Route path="/jobs" element={<AdminJobs />} />
                      <Route path="/jobs/:jobId" element={<AdminJobDetails />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthInitializer>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />

      {/* React Query Devtools */}
      {import.meta.env.VITE_NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}

    </QueryClientProvider>
  )
}

export default App