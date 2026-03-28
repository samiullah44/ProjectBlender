// components/layout/Navbar.tsx - FIXED & UPDATED
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  X,
  ChevronDown,
  User,
  Shield,
  Server,
  Settings,
  LogOut,
  Home,
  BarChart3,
  Globe,
  Zap,
  Wallet,
  FileText,
  Bell,
  Search,
  CreditCard,
  Cpu,
  ArrowLeftRight,
  HardDrive
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'
import { NotificationBell } from './NotificationBell'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'
import { useRenderNetwork } from '@/hooks/useRenderNetwork'

// We no longer import WalletMultiButton as we are removing it from the header per user request
// import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

interface NavItem {
  label: string
  href: string
  icon?: React.ReactNode
  isProtected?: boolean
  roles?: ('client' | 'node_provider' | 'admin')[]
  submenu?: {
    label: string
    href: string
    description?: string
    icon?: React.ReactNode
  }[]
}

interface NavbarProps {
  hideWaitlist?: boolean
}

const Navbar: React.FC<NavbarProps> = ({ hideWaitlist = false }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  const userMenuRef = useRef<HTMLDivElement>(null)

  const { user, isAuthenticated, logout, switchRole } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const { creditedAmount, isRefreshing } = useRenderNetwork()

  const activeRole = user?.primaryRole || user?.role;
  const isProvider = activeRole === 'node_provider';

  useOnClickOutside(userMenuRef, () => {
    if (userMenuOpen) setUserMenuOpen(false)
  })

  useEffect(() => {
    // Initial check
    if (localStorage.getItem('waitlist_status') === 'subscribed') {
      setIsSubscribed(true)
    }

    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }

    const handleSubscribeEvent = () => {
      setIsSubscribed(true)
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('waitlist-subscribed', handleSubscribeEvent)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('waitlist-subscribed', handleSubscribeEvent)
    }
  }, [])

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
    navigate('/')
    toast.success('Logged out successfully')
  }

  const navItems: NavItem[] = [
    {
      label: 'Home',
      href: '/',
      icon: <Home className="w-4 h-4" />
    },
    {
      label: 'Features',
      href: '/features',
      icon: <Zap className="w-4 h-4" />,
      submenu: [
        {
          label: 'GPU Acceleration',
          href: '/features/gpu',
          description: 'NVIDIA RTX & CUDA support',
          icon: <Cpu className="w-4 h-4" />
        },
        {
          label: 'Global Network',
          href: '/features/network',
          description: 'Nodes across 15+ countries',
          icon: <Globe className="w-4 h-4" />
        },
        {
          label: 'Analytics',
          href: '/features/analytics',
          description: 'Real-time rendering insights',
          icon: <BarChart3 className="w-4 h-4" />
        },
      ]
    },
    {
      label: 'How It Works',
      href: '/how-it-works',
      icon: <Settings className="w-4 h-4" />
    }
  ]

  const getModuleLinks = () => {
    if (!isAuthenticated || !user) return []

    const baseLinks: any[] = []
    const hasRole = (role: string) => user.roles?.includes(role as any) || user.role === role;
    const activeRole = user.primaryRole || user.role;

    if (hasRole('client') || hasRole('admin')) {
      baseLinks.push({
        label: 'Client Dashboard',
        href: '/client/dashboard',
        icon: <User className="w-4 h-4" />,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        roles: ['client', 'admin']
      })
    }

    if (hasRole('node_provider') || hasRole('admin')) {
      baseLinks.push({
        label: 'Node Dashboard',
        href: '/node/dashboard',
        icon: <Server className="w-4 h-4" />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        roles: ['node_provider', 'admin']
      })
    }

    if (hasRole('admin')) {
      baseLinks.push({
        label: 'Admin Panel',
        href: '/admin/dashboard',
        icon: <Shield className="w-4 h-4" />,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        roles: ['admin']
      })
      baseLinks.push({
        label: 'Network Nodes',
        href: '/admin/nodes',
        icon: <HardDrive className="w-4 h-4" />,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10',
        roles: ['admin']
      })
    }

    const moduleLinks = baseLinks.filter(link => {
      // Admins see all their related dashboards in the Navbar for easy access
      if (hasRole('admin')) return true;

      if (!link.roles) return true;
      return link.roles.includes(activeRole as any);
    });

    return moduleLinks;
  }

  const userMenuItems = [
    {
      label: 'Profile',
      href: '/profile',
      icon: <User className="w-4 h-4" />
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: <Settings className="w-4 h-4" />
    },
    {
      label: 'Notifications',
      href: '/notifications',
      icon: <Bell className="w-4 h-4" />
    },
    {
      label: 'Billing',
      href: '/billing',
      icon: <Wallet className="w-4 h-4" />
    }
  ]

  const moduleLinks = getModuleLinks()

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cn(
          'sticky top-0 w-full z-50 transition-all duration-300 backdrop-blur-xl border-b',
          isProvider
            ? scrolled
              ? 'bg-[#0A0A0B]/95 border-purple-500/20 shadow-[0_4px_30px_rgba(0,0,0,0.1)]'
              : 'bg-[#0A0A0B]/80 border-purple-500/10'
            : scrolled
              ? 'bg-gray-950/95 border-gray-800'
              : 'bg-gray-950/80 border-gray-900'
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="flex flex-col">
                  <span className="font-bold text-xl tracking-tight">
                    <span className={cn(
                      "bg-gradient-to-r bg-clip-text text-transparent transition-all duration-500",
                      isProvider
                        ? "bg-purple-500"
                        : "from-emerald-400 to-cyan-400"
                    )}>
                      Render
                    </span>
                    <span className="text-white">OnNodes</span>
                  </span>
                  <span className="text-xs text-gray-400 font-medium tracking-wide">
                    DISTRIBUTED RENDERING
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navItems.map((item) => (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setActiveDropdown(item.label)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      location.pathname === item.href
                        ? "text-white bg-white/5"
                        : isProvider
                          ? "text-gray-300 hover:text-purple-400 hover:bg-purple-500/5"
                          : "text-gray-300 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {item.icon}
                    {item.label}
                    {item.submenu && (
                      <ChevronDown className={cn(
                        "w-4 h-4 transition-transform duration-200",
                        activeDropdown === item.label && "rotate-180"
                      )} />
                    )}
                  </Link>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {item.submenu && activeDropdown === item.label && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute left-0 mt-2 w-64 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
                      >
                        <div className="py-2">
                          {item.submenu.map((subItem) => (
                            <Link
                              key={subItem.label}
                              to={subItem.href}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group"
                            >
                              <div className={cn(
                                "p-2 rounded-lg bg-white/5 transition-colors",
                                isProvider ? "group-hover:bg-purple-500/20" : "group-hover:bg-emerald-500/20"
                              )}>
                                {subItem.icon}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-sm text-white">
                                  {subItem.label}
                                </div>
                                {subItem.description && (
                                  <div className="text-xs text-gray-400">
                                    {subItem.description}
                                  </div>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Right Side - Modules & Auth */}
            <div className="hidden lg:flex items-center gap-4">
              {isAuthenticated && user ? (
                <>
                  {/* Notifications */}
                  <NotificationBell />

                  {/* Role Switcher */}
                  {user.roles && user.roles.length > 1 && (
                    <div className="flex items-center gap-2 bg-gray-900/50 p-1 rounded-lg border border-white/5 mx-2">
                      {user.roles.includes('client') && (
                        <button
                          onClick={() => {
                            switchRole('client').then(res => {
                              if (res.success) navigate('/client/dashboard');
                            });
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2",
                            (user.primaryRole || user.role) === 'client'
                              ? "bg-emerald-500 text-white shadow-lg"
                              : "text-gray-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          <User className="w-3.5 h-3.5" />
                          Client
                        </button>
                      )}
                      {user.roles.includes('node_provider') && (
                        <button
                          onClick={() => {
                            switchRole('node_provider').then(res => {
                              if (res.success) navigate('/node/dashboard');
                            });
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2",
                            (user.primaryRole || user.role) === 'node_provider'
                              ? "bg-purple-600 text-white shadow-lg"
                              : "text-gray-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          <Server className="w-3.5 h-3.5" />
                          Provider
                        </button>
                      )}
                      {user.roles.includes('admin') && (
                        <button
                          onClick={() => {
                            switchRole('admin').then(res => {
                              if (res.success) navigate('/admin/dashboard');
                            });
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2",
                            (user.primaryRole || user.role) === 'admin'
                              ? "bg-amber-600 text-white shadow-lg"
                              : "text-gray-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Admin
                        </button>
                      )}
                    </div>
                  )}

                  {/* Module Links */}
                  {moduleLinks.length > 0 && (
                    <div className="flex items-center gap-2">
                      {moduleLinks.map((link) => (
                        <Link
                          key={link.label}
                          to={link.href}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                            link.bgColor,
                            link.color,
                            "hover:opacity-90 border border-transparent hover:border-white/10"
                          )}
                        >
                          {link.icon}
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* User Profile */}
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-3 p-1 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div className="text-right hidden sm:block">
                        <div className="text-sm font-medium text-white">
                          {user.name}
                        </div>
                        <div className="text-xs text-gray-400 capitalize">
                          {user.role?.replace('_', ' ') || user.role}
                        </div>
                      </div>
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold transition-all duration-500",
                        isProvider
                          ? "bg-gradient-to-br from-purple-600 to-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                          : "bg-gradient-to-br from-emerald-500 to-cyan-500"
                      )}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <ChevronDown className={cn(
                        "w-4 h-4 text-gray-400 transition-transform duration-200",
                        userMenuOpen && "rotate-180"
                      )} />
                    </button>

                    {/* User Dropdown */}
                    <AnimatePresence>
                      {userMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute right-0 mt-2 w-64 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <div className="p-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-lg">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-white">
                                  {user.name}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {user.email}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-xs font-semibold text-emerald-400">
                                    {isRefreshing ? 'Syncing...' : `${(creditedAmount > 0 ? creditedAmount : (user?.tokenBalance || 0)).toFixed(2)} mRNDR`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="py-2">
                            <button
                              onClick={() => {
                                window.dispatchEvent(new Event('open-deposit-modal'));
                                setUserMenuOpen(false);
                              }}
                              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-emerald-500/10 transition-colors text-left group border-b border-white/5 pb-4 mb-2"
                            >
                              <div className="p-1.5 bg-emerald-500/20 rounded-md group-hover:scale-110 transition-transform">
                                <CreditCard className="w-4 h-4 text-emerald-400" />
                              </div>
                              <span className="text-sm font-semibold text-emerald-400 shadow-sm">Deposit mRNDR Tokens</span>
                            </button>

                            {userMenuItems.map((item) => (
                              <Link
                                key={item.label}
                                to={item.href}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                              >
                                {item.icon}
                                <span className="text-sm text-gray-300">{item.label}</span>
                              </Link>
                            ))}

                            <button
                              onClick={handleLogout}
                              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-red-500/10 text-red-400 transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                              <span className="text-sm">Logout</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700">
                      Get Started
                    </Button>
                  </Link>
                  {!hideWaitlist && !isSubscribed && (
                    <Button
                      onClick={() => window.dispatchEvent(new Event('open-waitlist'))}
                      className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 font-semibold shadow-lg shadow-emerald-500/20 ml-2"
                    >
                      Join Waitlist
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <X className="w-6 h-6 text-gray-300" />
              ) : (
                <Menu className="w-6 h-6 text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden bg-gray-900/95 backdrop-blur-xl border-b border-white/5 overflow-hidden"
            >
              <div className="container mx-auto px-4 py-6">
                <div className="space-y-2">
                  {navItems.map((item) => (
                    <div key={item.label}>
                      <Link
                        to={item.href}
                        className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/5 transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="flex items-center gap-3">
                          {item.icon}
                          <span className="font-medium text-gray-300">
                            {item.label}
                          </span>
                        </div>
                        {item.submenu && (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </Link>

                      {item.submenu && (
                        <div className="ml-8 mt-1 space-y-1">
                          {item.submenu.map((subItem) => (
                            <Link
                              key={subItem.label}
                              to={subItem.href}
                              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
                              onClick={() => setIsOpen(false)}
                            >
                              {subItem.icon}
                              <div>
                                <div className="text-sm text-gray-300">
                                  {subItem.label}
                                </div>
                                {subItem.description && (
                                  <div className="text-xs text-gray-500">
                                    {subItem.description}
                                  </div>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-white/10">
                  {isAuthenticated && user ? (
                    <>
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold transition-all duration-500",
                            isProvider
                              ? "bg-gradient-to-br from-purple-500 to-emerald-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                              : "bg-gradient-to-br from-emerald-500 to-cyan-500"
                          )}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {user.name}
                            </div>
                            <div className="text-sm text-gray-400 capitalize">
                              {user.role?.replace('_', ' ') || user.role}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <CreditCard className={cn(
                                "w-3.5 h-3.5",
                                isProvider ? "text-purple-400" : "text-emerald-400"
                              )} />
                              <span className={cn(
                                "text-xs font-semibold",
                                isProvider ? "text-purple-400" : "text-emerald-400"
                              )}>
                                {isRefreshing ? 'Syncing...' : `${(creditedAmount > 0 ? creditedAmount : (user?.tokenBalance || 0)).toFixed(2)} mRNDR`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {moduleLinks.length > 0 && (
                          <div className="grid grid-cols-1 gap-2 mb-6">
                            {moduleLinks.map((link) => (
                              <Link
                                key={link.label}
                                to={link.href}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium",
                                  link.bgColor,
                                  link.color
                                )}
                                onClick={() => setIsOpen(false)}
                              >
                                {link.icon}
                                {link.label}
                              </Link>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1">
                          <button
                            onClick={() => {
                              window.dispatchEvent(new Event('open-deposit-modal'));
                              setIsOpen(false);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg hover:bg-emerald-500/10 bg-emerald-500/5 transition-colors text-left mb-2 border border-emerald-500/20"
                          >
                            <CreditCard className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400 font-medium text-sm font-semibold">Deposit mRNDR Tokens</span>
                          </button>

                          {userMenuItems.map((item) => (
                            <Link
                              key={item.label}
                              to={item.href}
                              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors"
                              onClick={() => setIsOpen(false)}
                            >
                              {item.icon}
                              <span className="text-gray-300 text-sm">{item.label}</span>
                            </Link>
                          ))}

                          <button
                            onClick={() => {
                              handleLogout()
                              setIsOpen(false)
                            }}
                            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            <span className="text-sm">Logout</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Link
                        to="/login"
                        className="w-full text-center py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors font-medium"
                        onClick={() => setIsOpen(false)}
                      >
                        Sign In
                      </Link>
                      <Link
                        to="/register"
                        className="w-full text-center py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-medium"
                        onClick={() => setIsOpen(false)}
                      >
                        Get Started
                      </Link>
                      {!hideWaitlist && !isSubscribed && (
                        <Button
                          onClick={() => {
                            window.dispatchEvent(new Event('open-waitlist'));
                            setIsOpen(false);
                          }}
                          className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 transition-all duration-500 font-semibold shadow-emerald-500/20 shadow-lg"
                        >
                          Join Waitlist
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </>
  )
}

export default Navbar