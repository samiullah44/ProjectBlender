// App.tsx
import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'

import { Loader2 } from 'lucide-react'

// Layouts and Core Components (Keep static)
import Navbar from '@/components/layout/NavBar'
import ScrollToTop from '@/components/layout/ScrollToTop'
import { ProtectedRoute } from '@/components/layout/ProtectedLayout'

// Lazy loaded Public Pages
const HomePage = React.lazy(() => import('@/pages/public/Home'))
const LoginPage = React.lazy(() => import('@/pages/public/Login'))
const RegisterPage = React.lazy(() => import('@/pages/public/Register'))
const OAuthCallback = React.lazy(() => import('@/pages/public/OAuthCallback'))
const VerifyEmailPage = React.lazy(() => import('@/pages/public/VerifyEmail'))
const NotificationsPage = React.lazy(() => import('@/pages/public/Notifications'))

// Lazy loaded Client Pages
const ClientDashboard = React.lazy(() => import('@/pages/client/Dashboard'))
const CreateJob = React.lazy(() => import('@/pages/client/CreateJob'))
const JobDetails = React.lazy(() => import('@/pages/client/JobDetails'))
const ApplyNodeProvider = React.lazy(() => import('@/pages/client/ApplyNodeProvider'))

// Lazy loaded Node Pages
const NodeDashboard = React.lazy(() => import('@/pages/node/Dashboard'))
const NodeDetails = React.lazy(() => import('@/pages/node/NodeDetails'))
const NodeSetupGuide = React.lazy(() => import('@/pages/node/NodeSetupGuide'))

// Lazy loaded Admin Pages
const AdminDashboard = React.lazy(() => import('@/pages/admin/Dashboard'))
const AdminJobs = React.lazy(() => import('@/pages/admin/Jobs'))
const AdminJobDetails = React.lazy(() => import('@/pages/admin/JobDetails'))
const AdminApplications = React.lazy(() => import('@/pages/admin/Applications'))
const AdminNodes = React.lazy(() => import('@/pages/admin/Nodes'))

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

// Loading Fallback Component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
  </div>
)

// Main Layout component with Navbar
const MainLayout = () => {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="mx-auto">
        <React.Suspense fallback={<PageLoader />}>
          <Outlet />
        </React.Suspense>
      </main>
    </div>
  )
}

// Auth Layout (without Navbar)
const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-gray-950">
      <React.Suspense fallback={<PageLoader />}>
        <Outlet />
      </React.Suspense>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <Router>
          <ScrollToTop />
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
              <Route path="/apply-node-provider" element={
                <ProtectedRoute allowedRoles={['client', 'admin']}>
                  <ApplyNodeProvider />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'node_provider']}>
                  <NotificationsPage />
                </ProtectedRoute>
              } />
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
                      <Route path="/dashboard" element={<NodeDashboard />} />
                      <Route path="/nodes/:nodeId" element={<NodeDetails />} />
                      <Route path="/setup-guide" element={<NodeSetupGuide />} />
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
                      <Route path="/applications" element={<AdminApplications />} />
                      <Route path="/nodes" element={<AdminNodes />} />
                      <Route path="/nodes/:nodeId" element={<NodeDetails />} />
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