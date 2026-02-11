// components/layout/Navbar.tsx - UPDATED
import React, { useState, useEffect } from 'react'
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
  Cpu
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'

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

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)

  const { user, isAuthenticated, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
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
      href: '/#features',
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
        {
          label: 'Cost Calculator',
          href: '/features/pricing',
          description: 'Estimate rendering costs',
          icon: <CreditCard className="w-4 h-4" />
        }
      ]
    },
    {
      label: 'How It Works',
      href: '/how-it-works',
      icon: <Settings className="w-4 h-4" />
    },
    {
      label: 'Pricing',
      href: '/pricing',
      icon: <Wallet className="w-4 h-4" />
    },
    {
      label: 'Docs',
      href: '/docs',
      icon: <FileText className="w-4 h-4" />
    }
  ]

  const getModuleLinks = () => {
    if (!user) return []

    const baseLinks = [
      // {
      //   label: 'Dashboard',
      //   href: '/dashboard',
      //   icon: <User className="w-4 h-4" />,
      //   color: 'text-blue-400',
      //   bgColor: 'bg-blue-500/10',
      //   roles: ['client', 'admin'] as ('client' | 'node_provider' | 'admin')[]
      // }
    ]

    // Add client dashboard link for clients and admins
    if (user.role === 'client' || user.role === 'admin') {
      baseLinks.push({
        label: 'Client Dashboard',
        href: '/client/dashboard',
        icon: <User className="w-4 h-4" />,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        roles: ['client', 'admin']
      })
    }

    // Add node provider dashboard for node_providers and admins
    if (user.role === 'node_provider' || user.role === 'admin') {
      baseLinks.push({
        label: 'Node Dashboard',
        href: '/node/dashboard',
        icon: <Server className="w-4 h-4" />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        roles: ['node_provider', 'admin']
      })
    }

    // Only show admin link to admins
    if (user.role === 'admin') {
      baseLinks.push({
        label: 'Admin Panel',
        href: '/admin/dashboard',
        icon: <Shield className="w-4 h-4" />,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        roles: ['admin']
      })
    }

    const moduleLinks = baseLinks.filter(link => {
      if (!link.roles) return true;
      return link.roles.includes(user.role as any);
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
      label: 'Credits',
      href: '/credits',
      icon: <CreditCard className="w-4 h-4" />
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
          'fixed top-0 w-full z-50 transition-all duration-300 backdrop-blur-xl border-b',
          scrolled
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
                    <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                      Render
                    </span>
                    <span className="text-white">Farm</span>
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
                              <div className="p-2 rounded-lg bg-white/5 group-hover:bg-emerald-500/20 transition-colors">
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
              {/* Search
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 w-40 rounded-lg bg-white/5 border border-white/10 text-sm placeholder-gray-400 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 text-white"
                />
              </div> */}

              {isAuthenticated && user ? (
                <>
                  {/* Credits Display */}
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-400">
                        {user.credits?.toLocaleString()} credits
                      </span>
                    </div>
                  </div>

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
                  <div className="relative">
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
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
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
                                  <CreditCard className="w-3 h-3 text-emerald-400" />
                                  <span className="text-xs text-emerald-400 font-medium">
                                    {user.credits?.toLocaleString()} credits
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="py-2">
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
                /* Auth Buttons for non-authenticated users */
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
                {/* Mobile Navigation */}
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

                      {/* Mobile Submenu */}
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

                {/* Mobile Auth & Modules */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  {isAuthenticated && user ? (
                    <>
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
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
                              <CreditCard className="w-3 h-3 text-emerald-400" />
                              <span className="text-xs text-emerald-400 font-medium">
                                {user.credits?.toLocaleString()} credits
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Mobile Module Links */}
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

                        {/* Mobile User Menu */}
                        <div className="space-y-1">
                          {userMenuItems.map((item) => (
                            <Link
                              key={item.label}
                              to={item.href}
                              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors"
                              onClick={() => setIsOpen(false)}
                            >
                              {item.icon}
                              <span className="text-gray-300">{item.label}</span>
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
                            <span>Logout</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Link to="/login" onClick={() => setIsOpen(false)}>
                        <Button
                          variant="outline"
                          className="w-full border-white/20 hover:bg-white/5"
                        >
                          Sign In
                        </Button>
                      </Link>
                      <Link to="/register" onClick={() => setIsOpen(false)}>
                        <Button className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700">
                          Get Started Free
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Spacer for fixed navbar */}
      <div className="h-16 lg:h-20" />
    </>
  )
}

export default Navbar