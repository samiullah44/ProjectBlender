// App.tsx
import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'

// Public Pages
import HomePage from '@/pages/public/Home'
import Navbar from '@/components/layout/NavBar'
// import LoginPage from '@/pages/public/Login'
// import RegisterPage from '@/pages/public/Register'

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
// import AdminDashboard from '@/pages/admin/Dashboard'
// import AdminNodes from '@/pages/admin/Nodes'
// import AdminJobs from '@/pages/admin/Jobs'

// Protected Route Component
import { ProtectedRoute } from '@/components/layout/ProtectedLayout'

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
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
                    {/* <Route path="/dashboard" element={<AdminDashboard />} /> */}
                    {/* <Route path="/nodes" element={<AdminNodes />} /> */}
                    {/* <Route path="/jobs" element={<AdminJobs />} /> */}
                  </Routes>
                </ProtectedRoute>
              } 
            />
          </Route>

          {/* Fallback Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />

      {/* React Query Devtools */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App