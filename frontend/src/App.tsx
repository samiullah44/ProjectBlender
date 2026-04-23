// App.tsx
import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'
import { ImpersonationBanner } from './components/admin/ImpersonationBanner'

import { analytics } from '@/services/analytics'
import { useAnalytics } from '@/hooks/useAnalytics'
import SplashScreen from '@/components/ui/SplashScreen'
import { PageSkeleton } from '@/components/ui/PageSkeleton'

// Layouts and Core Components (Keep static)
import Navbar from '@/components/layout/NavBar'
import TopBar from '@/components/layout/TopBar'
import Footer from '@/components/layout/Footer'
import ScrollToTop from '@/components/layout/ScrollToTop'
import { ProtectedRoute } from '@/components/layout/ProtectedLayout'

// Lazy loaded Global Modals
const WaitlistPopup = React.lazy(() => import('@/components/ui/WaitlistPopup'))
const DepositModal = React.lazy(() => import('@/components/ui/DepositModal').then(m => ({ default: m.DepositModal })))
const WithdrawModal = React.lazy(() => import('@/components/ui/WithdrawModal').then(m => ({ default: m.WithdrawModal })))

// Lazy loaded Public Pages
const HomePage = React.lazy(() => import('@/pages/public/Home'))
const FeaturesPage = React.lazy(() => import('@/pages/public/Features'))
const FeaturesGPUPage = React.lazy(() => import('@/pages/public/FeaturesGPU'))
const FeaturesNetworkPage = React.lazy(() => import('@/pages/public/FeaturesNetwork'))
const FeaturesAnalyticsPage = React.lazy(() => import('@/pages/public/FeaturesAnalytics'))
const HowItWorksPage = React.lazy(() => import('@/pages/public/HowItWorks'))
const LoginPage = React.lazy(() => import('@/pages/public/Login'))
const RegisterPage = React.lazy(() => import('@/pages/public/Register'))
const OAuthCallback = React.lazy(() => import('@/pages/public/OAuthCallback'))
const VerifyEmailPage = React.lazy(() => import('@/pages/public/VerifyEmail'))
const NotificationsPage = React.lazy(() => import('@/pages/public/Notifications'))
const ProfilePage = React.lazy(() => import('@/pages/public/Profile'))
const SettingsPage = React.lazy(() => import('@/pages/public/Settings'))
const FAQPage = React.lazy(() => import('@/pages/public/FAQ'))

// New Public Pages
const AboutUsPage = React.lazy(() => import('@/pages/public/AboutUs'))
const ContactPage = React.lazy(() => import('@/pages/public/Contact'))
const BlogPage = React.lazy(() => import('@/pages/public/Blog'))
const ArtistsPage = React.lazy(() => import('@/pages/public/Artists'))
const NodeProvidersPage = React.lazy(() => import('@/pages/public/NodeProviders'))
const ComputeClientsPage = React.lazy(() => import('@/pages/public/ComputeClients'))

// Legal Pages
const TermsOfService = React.lazy(() => import('@/pages/public/TermsOfService'))
const PrivacyPolicy = React.lazy(() => import('@/pages/public/PrivacyPolicy'))
const RiskDisclosure = React.lazy(() => import('@/pages/public/RiskDisclosure'))
const RefundPolicy = React.lazy(() => import('@/pages/public/RefundPolicy'))
const AcceptableUse = React.lazy(() => import('@/pages/public/AcceptableUse'))

// Lazy loaded Client Pages
const ForgotPasswordPage = React.lazy(() => import('@/pages/public/ForgotPassword'))
const ResetPasswordPage = React.lazy(() => import('@/pages/public/ResetPassword'))
const ClientDashboard = React.lazy(() => import('@/pages/client/Dashboard'))
const CreateJob = React.lazy(() => import('@/pages/client/CreateJob'))
const JobDetails = React.lazy(() => import('@/pages/client/JobDetails'))
const ApplyNodeProvider = React.lazy(() => import('@/pages/client/ApplyNodeProvider'))
const ClientBilling = React.lazy(() => import('@/pages/client/Billing'))

// Lazy loaded Node Pages
const NodeDashboard = React.lazy(() => import('@/pages/node/Dashboard'))
const NodeDetails = React.lazy(() => import('@/pages/node/NodeDetails'))
const NodeSetupGuide = React.lazy(() => import('@/pages/node/NodeSetupGuide'))
const NodeEarnings = React.lazy(() => import('@/pages/node/Earnings'))

// Lazy loaded Admin Pages
const AdminLogin = React.lazy(() => import('@/pages/admin/AdminLogin'))
const AdminDashboard = React.lazy(() => import('@/pages/admin/Dashboard'))
const AdminJobs = React.lazy(() => import('@/pages/admin/Jobs'))
const AdminJobDetails = React.lazy(() => import('@/pages/admin/JobDetails'))
const AdminApplications = React.lazy(() => import('@/pages/admin/Applications'))
const AdminNodes = React.lazy(() => import('@/pages/admin/Nodes'))
const AdminUsers = React.lazy(() => import('@/pages/admin/Users'))
const AdminAudit = React.lazy(() => import('@/pages/admin/AuditLogs'))
const AdminAnalytics = React.lazy(() => import('@/pages/admin/Analytics'))
const AdminUserAnalyticsDetail = React.lazy(() => import('@/pages/admin/UserAnalyticsDetail'))
const AdminUserAnalytics = React.lazy(() => import('@/pages/admin/UserAnalyitcs'))

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

// Main Layout component with Navbar, Footer, and Popup
const MainLayout = () => {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false)
  const [showTopBar, setShowTopBar] = useState(() => {
    if (typeof window !== 'undefined') {
      const status = localStorage.getItem('waitlist_status');
      const dismissedAt = localStorage.getItem('waitlist_dismissed_at');
      if (status === 'subscribed') return true;
      if (status === 'dismissed') {
        if (!dismissedAt) return true;
        const daysPassed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
        return daysPassed < 2;
      }
    }
    return false;
  })

  useEffect(() => {
    const status = localStorage.getItem('waitlist_status')
    const dismissedAt = localStorage.getItem('waitlist_dismissed_at')

    if (status === 'subscribed' || (status === 'dismissed' && (!dismissedAt || (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24) < 2))) {
      // Logic already handled in initializer, but sync just in case
      return;
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
    <div className="min-h-screen bg-gray-950 flex flex-col overflow-x-hidden animate-page-reveal">
      <ImpersonationBanner />
      <TopBar isVisible={showTopBar} onReopen={() => setIsWaitlistOpen(true)} />
      <Navbar hideWaitlist={showTopBar} />
      <main className="mx-auto flex-1 w-full overflow-x-hidden">
        <React.Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </React.Suspense>
      </main>
      <Footer />
      <React.Suspense fallback={null}>
        <WaitlistPopup
          isOpen={isWaitlistOpen}
          onClose={handleCloseWaitlist}
          onSubscribe={handleSubscribe}
        />
      </React.Suspense>
    </div>
  )
}

// Auth Layout (without Navbar)
const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-gray-950">
      <ImpersonationBanner />
      <React.Suspense fallback={<PageSkeleton />}>
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
  // const [showSplash, setShowSplash] = useState(() => {
  //   // Show splash only once per session
  //   return !sessionStorage.getItem('splash_shown');
  // });
  const [showSplash, setShowSplash] = useState(false);

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
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/callback" element={<OAuthCallback />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/admin/login" element={<AdminLogin />} />
            </Route>

            {/* Public Marketing Routes with Navbar */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/features/gpu" element={<FeaturesGPUPage />} />
              <Route path="/features/network" element={<FeaturesNetworkPage />} />
              <Route path="/features/analytics" element={<FeaturesAnalyticsPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/faq" element={<FAQPage />} />

              {/* About Pages */}
              <Route path="/about" element={<AboutUsPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/blog" element={<BlogPage />} />

              {/* Participant Pages */}
              <Route path="/participants/artists" element={<ArtistsPage />} />
              <Route path="/participants/node-providers" element={<NodeProvidersPage />} />
              <Route path="/participants/compute-clients" element={<ComputeClientsPage />} />

              {/* Legal Routes */}
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/risk" element={<RiskDisclosure />} />
              <Route path="/refund" element={<RefundPolicy />} />
              <Route path="/aup" element={<AcceptableUse />} />

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
              <Route path="/profile" element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'node_provider']}>
                  <ProfilePage />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'node_provider']}>
                  <SettingsPage />
                </ProtectedRoute>
              } />
              {/* <Route path="/login" element={<LoginPage />} /> */}
              {/* <Route path="/register" element={<RegisterPage />} /> */}

              {/* Disabled user-facing routes → redirect home */}
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/apply-node-provider" element={<Navigate to="/" replace />} />
              <Route path="/notifications" element={<Navigate to="/" replace />} />
              <Route path="/client/*" element={<Navigate to="/" replace />} />
              <Route path="/node/*" element={<Navigate to="/" replace />} />

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
                      <Route path="/billing" element={<ClientBilling />} />
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
                      <Route path="/earnings" element={<NodeEarnings />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              {/* Admin Routes */}
              {/* Admin Routes — accessible only to admins */}
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Routes>
                      <Route path="/dashboard" element={<AdminDashboard />} />
                      <Route path="/analytics" element={<AdminAnalytics />} />
                      <Route path="/jobs" element={<AdminJobs />} />
                      <Route path="/jobs/:jobId" element={<AdminJobDetails />} />
                      <Route path="/applications" element={<AdminApplications />} />
                      <Route path="/nodes" element={<AdminNodes />} />
                      <Route path="/nodes/:nodeId" element={<NodeDetails />} />
                      <Route path="/users" element={<AdminUsers />} />
                      <Route path="/audit" element={<AdminAudit />} />
                      <Route path="/analytics" element={<AdminAnalytics />} />
                      <Route path="/analytics/users/:userId" element={<AdminUserAnalyticsDetail />} />
                      <Route path="/analytics/user/:userId" element={<AdminUserAnalyticsDetail />} />
                      <Route path="/user-analytics" element={<AdminUserAnalytics />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Global Modals must be inside Router for Link to work */}
          <React.Suspense fallback={null}>
            <DepositModal />
            <WithdrawModal />
          </React.Suspense>
        </Router>
      </AuthInitializer>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#111827',
            color: '#f9fafb',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#111827' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#111827' },
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