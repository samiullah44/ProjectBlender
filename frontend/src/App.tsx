import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { analytics } from '@/services/analytics'
import { useAnalytics } from '@/hooks/useAnalytics'
import SplashScreen from '@/components/ui/SplashScreen'

// Layouts and Core Components (Keep static)
import Navbar from '@/components/layout/NavBar'
import TopBar from '@/components/layout/TopBar'
import Footer from '@/components/layout/Footer'
import WaitlistPopup from '@/components/ui/WaitlistPopup'
import ScrollToTop from '@/components/layout/ScrollToTop'
import { ProtectedRoute } from '@/components/layout/ProtectedLayout'

// Lazy loaded Public Pages
const HomePage = React.lazy(() => import('@/pages/public/Home'))
const FeaturesPage = React.lazy(() => import('@/pages/public/Features'))
const FeaturesGPUPage = React.lazy(() => import('@/pages/public/FeaturesGPU'))
const FeaturesNetworkPage = React.lazy(() => import('@/pages/public/FeaturesNetwork'))
const FeaturesAnalyticsPage = React.lazy(() => import('@/pages/public/FeaturesAnalytics'))
const HowItWorksPage = React.lazy(() => import('@/pages/public/HowItWorks'))

// Lazy loaded Admin Pages
const AdminLogin = React.lazy(() => import('@/pages/admin/AdminLogin'))
const AdminDashboard = React.lazy(() => import('@/pages/admin/Dashboard'))
const AdminJobs = React.lazy(() => import('@/pages/admin/Jobs'))
const AdminJobDetails = React.lazy(() => import('@/pages/admin/JobDetails'))
const AdminApplications = React.lazy(() => import('@/pages/admin/Applications'))
const AdminNodes = React.lazy(() => import('@/pages/admin/Nodes'))
const AdminAnalytics = React.lazy(() => import('@/pages/admin/Analytics'))
const AdminUserAnalyticsDetail = React.lazy(() => import('@/pages/admin/UserAnalyticsDetail'))
const NodeDetails = React.lazy(() => import('@/pages/node/NodeDetails'))

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
  const { getProfile, user } = useAuthStore()

  useEffect(() => {
    analytics.init()
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      getProfile().catch(() => {
        localStorage.removeItem('token')
      })
    }
  }, [getProfile])

  // Sync user identity once profile is loaded
  useEffect(() => {
    if (user) {
      analytics.setRole(user.role)
      analytics.identify(user.email, user.name, user.id)
    }
  }, [user])

  return <>{children}</>
}

// Loading Fallback Component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
  </div>
)

// Main Layout component with Navbar, Footer, and Popup
const MainLayout = () => {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false)
  const [showTopBar, setShowTopBar] = useState(false)

  useEffect(() => {
    const status = localStorage.getItem('waitlist_status')
    const dismissedAt = localStorage.getItem('waitlist_dismissed_at')

    if (status === 'subscribed') {
      setShowTopBar(true);
      return;
    }

    if (status === 'dismissed') {
      if (dismissedAt) {
        const daysPassed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
        if (daysPassed < 2) {
          setShowTopBar(true);
          return;
        }
      } else {
        setShowTopBar(true);
        return;
      }
    }

    let isTriggered = false;

    // Trigger after 3 seconds if not seen
    const timer = setTimeout(() => {
      if (!isTriggered) {
        setIsWaitlistOpen(true);
        isTriggered = true;
      }
    }, 3000);

    // Track scroll 30%
    const handleScroll = () => {
      if (!isTriggered && document.documentElement.scrollTop > document.documentElement.scrollHeight * 0.3) {
        setIsWaitlistOpen(true);
        isTriggered = true;
        window.removeEventListener('scroll', handleScroll);
      }
    };

    // Exit intent
    const handleMouseLeave = (e: MouseEvent) => {
      if (!isTriggered && e.clientY <= 0) {
        setIsWaitlistOpen(true);
        isTriggered = true;
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
    };

    // Custom Event listener for NavBar
    const handleOpenWaitlist = () => {
      setIsWaitlistOpen(true);
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('open-waitlist', handleOpenWaitlist);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('open-waitlist', handleOpenWaitlist);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleCloseWaitlist = () => {
    setIsWaitlistOpen(false);
    const status = localStorage.getItem('waitlist_status');
    if (status !== 'subscribed') {
      localStorage.setItem('waitlist_status', 'dismissed');
      localStorage.setItem('waitlist_dismissed_at', Date.now().toString());
    }
    setShowTopBar(true);
  };

  const handleSubscribe = () => {
    localStorage.setItem('waitlist_status', 'subscribed');
    setShowTopBar(true);
    setIsWaitlistOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="sticky top-0 z-50">
        <TopBar isVisible={showTopBar} onReopen={() => setIsWaitlistOpen(true)} />
        <Navbar hideWaitlist={showTopBar} />
      </div>
      <main className="mx-auto flex-1 w-full">
        <React.Suspense fallback={<PageLoader />}>
          <Outlet />
        </React.Suspense>
      </main>
      <Footer />
      <WaitlistPopup
        isOpen={isWaitlistOpen}
        onClose={handleCloseWaitlist}
        onSubscribe={handleSubscribe}
      />
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

// Component that lives INSIDE <Router> so it can use useLocation
const AnalyticsTracker = () => {
  useAnalytics()
  return null
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    // Show splash only once per session
    return !sessionStorage.getItem('splash_shown');
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem('splash_shown', 'true');
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
        <Router>
          <ScrollToTop />
          <AnalyticsTracker />
          <Routes>
            {/* Hidden Admin Login — not linked anywhere publicly */}
            <Route element={<AuthLayout />}>
              <Route path="/admin/login" element={<AdminLogin />} />
              {/* Disabled auth routes → redirect home */}
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/register" element={<Navigate to="/" replace />} />
              <Route path="/auth/callback" element={<Navigate to="/" replace />} />
              <Route path="/verify-email" element={<Navigate to="/" replace />} />
            </Route>

            {/* Public Marketing Routes with Navbar */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/features/gpu" element={<FeaturesGPUPage />} />
              <Route path="/features/network" element={<FeaturesNetworkPage />} />
              <Route path="/features/analytics" element={<FeaturesAnalyticsPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />

              {/* Disabled user-facing routes → redirect home */}
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/apply-node-provider" element={<Navigate to="/" replace />} />
              <Route path="/notifications" element={<Navigate to="/" replace />} />
              <Route path="/client/*" element={<Navigate to="/" replace />} />
              <Route path="/node/*" element={<Navigate to="/" replace />} />

              {/* Admin Routes — accessible only to admins */}
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
                      <Route path="/analytics" element={<AdminAnalytics />} />
                      <Route path="/analytics/users/:userId" element={<AdminUserAnalyticsDetail />} />
                      <Route path="/analytics/user/:userId" element={<AdminUserAnalyticsDetail />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback */}
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