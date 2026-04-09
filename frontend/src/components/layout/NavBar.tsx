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
import { useWallet } from '@solana/wallet-adapter-react'

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
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [balanceMenuOpen, setBalanceMenuOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  const toggleSubmenu = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label) 
        : [...prev, label]
    )
  }

  const userMenuRef = useRef<HTMLDivElement>(null)
  const balanceMenuRef = useRef<HTMLDivElement>(null)

  const { user, isAuthenticated, logout, switchRole } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const { publicKey } = useWallet()
  const { creditedAmount, lockedAmount, isInitialized, isRefreshing, syncSolanaSeed } = useRenderNetwork()

  const activeRole = user?.primaryRole || user?.role;
  const isProvider = activeRole === 'node_provider';

  useOnClickOutside(userMenuRef, () => {
    if (userMenuOpen) setUserMenuOpen(false)
  })

  useOnClickOutside(balanceMenuRef, () => {
    if (balanceMenuOpen) setBalanceMenuOpen(false)
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
      label: activeRole === 'node_provider' ? 'Earnings' : 'Billing',
      href: activeRole === 'node_provider' ? '/node/earnings' : '/client/billing',
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

                  {/* Combined Balance & User Profile Widget */}
                  <div className={cn(
                    "flex items-center rounded-full transition-all relative backdrop-blur-sm",
                    isProvider 
                      ? "bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                      : "bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  )}>
                    
                    {/* Balance Menu */}
                    <div className="relative" ref={balanceMenuRef}>
                      <button
                        onClick={() => {
                          setBalanceMenuOpen(!balanceMenuOpen);
                          setUserMenuOpen(false);
                        }}
                        className="flex items-center gap-2 pl-4 pr-3 py-1.5 transition-colors group"
                      >
                        <span className={cn(
                          "text-sm font-bold tracking-wide transition-colors",
                          isProvider 
                            ? "text-purple-400 group-hover:text-purple-300" 
                            : "text-emerald-400 group-hover:text-emerald-300"
                        )}>
                          RNDR {isRefreshing ? '...' : (creditedAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                        </span>
                      </button>

                      {/* Balance Dropdown */}
                      <AnimatePresence>
                        {balanceMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute right-0 mt-3 w-56 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden z-50"
                          >
                            <div className="p-3 border-b border-white/10 bg-gray-800/50">
                              <div className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Available Balance</div>
                              <div className="text-lg font-bold text-white tracking-tight">{(creditedAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} <span className="text-sm text-amber-500 font-semibold">mRNDR</span></div>
                              {lockedAmount > 0 && (
                                <div className="text-xs text-amber-500/80 font-medium mt-1">
                                  {lockedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} Locked
                                </div>
                              )}
                            </div>
                            <div className="p-2 space-y-1">
                                <button
                                  onClick={() => {
                                    window.dispatchEvent(new Event('open-deposit-modal'));
                                    setBalanceMenuOpen(false);
                                  }}
                                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 font-semibold text-sm transition-colors group"
                                >
                                  <div className="p-1.5 bg-emerald-500/20 rounded-md group-hover:scale-110 transition-transform">
                                    <CreditCard className="w-3.5 h-3.5" />
                                  </div>
                                  Deposit
                                </button>
                                <button
                                  onClick={() => {
                                    window.dispatchEvent(new Event('open-withdraw-modal'));
                                    setBalanceMenuOpen(false);
                                  }}
                                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-red-500/10 text-red-400 font-semibold text-sm transition-colors group"
                                >
                                  <div className="p-1.5 bg-red-500/20 rounded-md group-hover:scale-110 transition-transform">
                                    <CreditCard className="w-3.5 h-3.5" />
                                  </div>
                                  Withdraw
                                </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Divider */}
                    <div className={cn(
                      "w-[1px] h-5",
                      isProvider ? "bg-purple-500/30" : "bg-emerald-500/30"
                    )}></div>

                    {/* User Profile Menu */}
                    <div className="relative" ref={userMenuRef}>
                      <button
                        onClick={() => {
                          setUserMenuOpen(!userMenuOpen);
                          setBalanceMenuOpen(false);
                        }}
                        className="flex items-center justify-center p-1 mr-1"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase shadow-lg transform transition-transform hover:scale-105",
                          isProvider
                            ? "bg-gradient-to-br from-purple-600 to-purple-500 shadow-purple-600/30"
                            : "bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-emerald-500/30"
                        )}>
                          {user.name.substring(0, 2)}
                        </div>
                      </button>

                      {/* User Dropdown */}
                      <AnimatePresence>
                        {userMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute right-0 mt-3 w-64 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden z-50"
                          >
                            <div className="p-4 border-b border-white/10 bg-gray-800/30">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg uppercase",
                                  isProvider
                                    ? "bg-gradient-to-br from-purple-600 to-purple-500"
                                    : "bg-gradient-to-br from-emerald-500 to-cyan-500"
                                )}>
                                  {user.name.substring(0, 2)}
                                </div>
                                <div>
                                  <div className="font-medium text-white">
                                    {user.name}
                                  </div>
                                  <div className="text-sm text-gray-400">
                                    {user.email}
                                  </div>
                                  <div className={cn(
                                    "text-xs font-semibold mt-1 capitalize",
                                    isProvider ? "text-purple-400" : "text-emerald-400"
                                  )}>
                                    {activeRole?.replace('_', ' ') || activeRole}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="py-2">
                              {userMenuItems.map((item) => (
                                <Link
                                  key={item.label}
                                  to={item.href}
                                  onClick={() => setUserMenuOpen(false)}
                                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors group"
                                >
                                  <div className="text-gray-400 group-hover:text-white transition-colors">
                                    {item.icon}
                                  </div>
                                  <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{item.label}</span>
                                </Link>
                              ))}

                              <div className="h-[1px] w-full bg-white/10 my-2"></div>

                              {user?.solanaSeed && publicKey && publicKey.toBase58() !== user.solanaSeed && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    syncSolanaSeed();
                                    setUserMenuOpen(false);
                                  }}
                                  className="flex items-center gap-3 w-full px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-left group border-b border-white/5 mb-2"
                                >
                                  <div className="p-1.5 bg-amber-500/20 rounded-md group-hover:scale-110 transition-transform">
                                    <ArrowLeftRight className="w-4 h-4 text-amber-400" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-amber-400">Sync Identity</span>
                                    <span className="text-[10px] text-amber-500/70">Connect this wallet to account</span>
                                  </div>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  handleLogout()
                                  setUserMenuOpen(false)
                                }}
                                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-red-500/10 group transition-colors"
                              >
                                <div className="text-red-400 transition-colors">
                                  <LogOut className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium text-red-400">Logout</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
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
      </motion.nav>

      {/* Mobile Menu - Side Drawer */}
      <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
              />
              
              {/* Drawer */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-[85%] max-w-[320px] bg-gray-950/95 backdrop-blur-2xl border-l border-white/10 z-[70] lg:hidden shadow-2xl flex flex-col"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                  <div className="flex flex-col">
                    <span className="font-bold text-lg tracking-tight">
                      <span className={cn(
                        "bg-gradient-to-r bg-clip-text text-transparent",
                        isProvider ? "bg-purple-500" : "from-emerald-400 to-cyan-400"
                      )}>
                        Render
                      </span>
                      <span className="text-white">OnNodes</span>
                    </span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                  {/* User Profile Summary (If Logged In) */}
                  {isAuthenticated && user && (
                    <div className="mb-8 p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg",
                          isProvider ? "bg-purple-600" : "bg-emerald-500"
                        )}>
                          {user.name.substring(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white truncate">{user.name}</div>
                          <div className="text-xs text-gray-400 truncate capitalize">{activeRole?.replace('_', ' ')}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-gray-400 font-medium">Balance</span>
                        <span className={cn("font-bold", isProvider ? "text-purple-400" : "text-emerald-400")}>
                          {isRefreshing ? '...' : (creditedAmount ?? 0).toFixed(2)} mRNDR
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">Navigation</div>
                    {navItems.map((item) => (
                      <div key={item.label} className="space-y-1">
                        {item.submenu ? (
                          <>
                            <button
                              onClick={() => toggleSubmenu(item.label)}
                              className="flex items-center justify-between w-full px-4 py-3 rounded-xl hover:bg-white/5 transition-all text-gray-300 group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-white/5 text-gray-400 group-hover:text-white transition-colors">
                                  {item.icon}
                                </div>
                                <span className="font-medium">{item.label}</span>
                              </div>
                              <ChevronDown className={cn(
                                "w-4 h-4 text-gray-500 transition-transform duration-200",
                                expandedItems.includes(item.label) && "rotate-180"
                              )} />
                            </button>
                            <AnimatePresence>
                              {expandedItems.includes(item.label) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden ml-4 pl-4 border-l border-white/5 space-y-1"
                                >
                                  {item.submenu.map((subItem) => (
                                    <Link
                                      key={subItem.label}
                                      to={subItem.href}
                                      onClick={() => setIsOpen(false)}
                                      className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                      {subItem.icon}
                                      {subItem.label}
                                    </Link>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        ) : (
                          <Link
                            to={item.href}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                              location.pathname === item.href ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5"
                            )}
                          >
                            <div className={cn(
                              "p-2 rounded-lg transition-colors",
                              location.pathname === item.href ? "bg-white/10" : "bg-white/5 text-gray-400 group-hover:text-white"
                            )}>
                              {item.icon}
                            </div>
                            <span className="font-medium">{item.label}</span>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>

                  {isAuthenticated && (
                    <div className="mt-8 space-y-1">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">Account & Actions</div>
                      
                      {moduleLinks.map((link) => (
                        <Link
                          key={link.label}
                          to={link.href}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                            link.bgColor,
                            link.color
                          )}
                        >
                          <div className="p-2 rounded-lg bg-black/20">
                            {link.icon}
                          </div>
                          <span className="font-bold">{link.label}</span>
                        </Link>
                      ))}

                      {/* Role Switcher Action */}
                      <div className="py-2">
                        <button
                          onClick={async () => {
                            const otherRole = user?.primaryRole === 'client' ? 'node_provider' : 'client';
                            const result = await switchRole(otherRole);
                            if (result.success) {
                              navigate(otherRole === 'client' ? '/client/dashboard' : '/node-provider/dashboard');
                            }
                            setIsOpen(false);
                          }}
                          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-blue-500/10 bg-blue-500/5 transition-colors text-left border border-blue-500/20 group"
                        >
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                            <ArrowLeftRight className="w-4 h-4" />
                          </div>
                          <span className="text-blue-400 font-bold text-sm">
                            Switch to {user?.primaryRole === 'client' ? 'Provider' : 'Client'} View
                          </span>
                        </button>
                      </div>

                      {/* Deposit & Withdraw Actions */}
                      <div className="grid grid-cols-1 gap-2 py-2">
                        <button
                          onClick={() => {
                            window.dispatchEvent(new Event('open-deposit-modal'));
                            setIsOpen(false);
                          }}
                          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-emerald-500/10 bg-emerald-500/5 transition-colors text-left border border-emerald-500/20 group"
                        >
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <span className="text-emerald-400 font-bold text-sm">Deposit Tokens</span>
                        </button>

                        <button
                          onClick={() => {
                            window.dispatchEvent(new Event('open-withdraw-modal'));
                            setIsOpen(false);
                          }}
                          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-red-500/10 bg-red-500/5 transition-colors text-left border border-red-500/20 group"
                        >
                          <div className="p-2 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500/20 transition-colors">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <span className="text-red-400 font-bold text-sm">Withdraw Tokens</span>
                        </button>
                      </div>

                      {userMenuItems.map((item) => (
                        <Link
                          key={item.label}
                          to={item.href}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-white/5 transition-colors"
                        >
                          <div className="p-2 rounded-lg bg-white/5 text-gray-400">
                            {item.icon}
                          </div>
                          <span className="font-medium text-sm">{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {!isAuthenticated && (
                    <div className="mt-8 space-y-3">
                      <Link
                        to="/login"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-center w-full py-4 rounded-xl font-bold bg-white/5 text-gray-200 hover:bg-white/10 transition-colors border border-white/5"
                      >
                        Sign In
                      </Link>
                      <Link
                        to="/register"
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center justify-center w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all",
                          isProvider ? "bg-purple-600 shadow-purple-900/40" : "bg-emerald-600 shadow-emerald-900/40"
                        )}
                      >
                        Get Started
                      </Link>
                    </div>
                  )}
                </div>

                {isAuthenticated && (
                  <div className="p-4 border-t border-white/5 space-y-3">
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
    </>
  )
}

export default Navbar