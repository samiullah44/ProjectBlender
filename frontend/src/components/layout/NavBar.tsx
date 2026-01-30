// components/layout/Navbar.tsx
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
  Search
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Link, useLocation, useNavigate } from 'react-router-dom'

// Mock user data - replace with actual authentication logic
interface UserData {
  id: string
  name: string
  email: string
  role: 'client' | 'node_provider' | 'admin'
  avatar?: string
}

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

  const [currentUser, setCurrentUser] = useState<UserData | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  // Mock authentication - replace with your actual auth logic
  useEffect(() => {
    // Check if user is logged in (from localStorage, context, or API)
    const mockUser: UserData = {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'client' // Change to 'admin' or 'node_provider' to test different views
    }
    setCurrentUser(mockUser)
  }, [])

useEffect(() => {
  const handleScroll = () => {
    setScrolled(window.scrollY > 20)
  }
  window.addEventListener('scroll', handleScroll)
  return () => window.removeEventListener('scroll', handleScroll)
}, [])


  const handleLogout = () => {
    // Add your logout logic here
    setCurrentUser(null)
    setUserMenuOpen(false)
    navigate('/')
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
          icon: <Zap className="w-4 h-4" />
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
          icon: <Wallet className="w-4 h-4" />
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

 // In your Navbar.tsx, update the getModuleLinks function:
const getModuleLinks = () => {
  const baseLinks = [
    {
      label: 'Client Dashboard',
      href: '/client/dashboard', // Changed from '/dashboard'
      icon: <User className="w-4 h-4" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      roles: ['client', 'admin'] as ('client' | 'node_provider' | 'admin')[]
    },
    {
      label: 'Node Provider',
      href: '/node/dashboard', // Changed from '/node-dashboard'
      icon: <Server className="w-4 h-4" />,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      roles: ['node_provider', 'admin'] as ('client' | 'node_provider' | 'admin')[]
    }
  ]

  // Only show admin link to admins
  if (currentUser?.role === 'admin') {
    baseLinks.push({
      label: 'Admin Panel',
      href: '/admin/dashboard', // Changed from '/admin'
      icon: <Shield className="w-4 h-4" />,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      roles: ['admin'] as ('client' | 'node_provider' | 'admin')[]
    })
  }

  return baseLinks.filter(link => 
    !currentUser || link.roles.includes(currentUser.role)
  )
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
          'fixed top-0 w-full z-50 transition-all duration-300 bg-gray-950/95 backdrop-blur-xl border-b' 
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
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 w-40 rounded-lg bg-white/5 border border-white/10 text-sm placeholder-gray-400 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>

              {/* Module Links */}
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

              {/* Auth Section */}
              {currentUser ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-3 p-1 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-medium text-white">
                        {currentUser.name}
                      </div>
                      <div className="text-xs text-gray-400 capitalize">
                        {currentUser.role.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                      {currentUser.name.charAt(0).toUpperCase()}
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
                      >
                        <div className="p-4 border-b border-white/10">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-lg">
                              {currentUser.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-white">
                                {currentUser.name}
                              </div>
                              <div className="text-sm text-gray-400">
                                {currentUser.email}
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
                              onClick={() => setUserMenuOpen(false)}
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
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/signup">
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
                  {currentUser ? (
                    <>
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                            {currentUser.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {currentUser.name}
                            </div>
                            <div className="text-sm text-gray-400 capitalize">
                              {currentUser.role.replace('_', ' ')}
                            </div>
                          </div>
                        </div>

                        {/* Mobile Module Links */}
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
                      <Link to="/signup" onClick={() => setIsOpen(false)}>
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