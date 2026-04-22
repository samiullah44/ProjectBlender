import React from 'react'
import { motion } from 'framer-motion'
import {
    LayoutDashboard,
    BarChart3,
    Layers,
    HardDrive,
    Users,
    Shield,
    ShieldCheck,
    ChevronRight,
    Menu,
    X
} from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/jobs', label: 'Jobs', icon: Layers },
    { to: '/admin/nodes', label: 'Nodes', icon: HardDrive },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/applications', label: 'Applications', icon: Shield },
    { to: '/admin/audit', label: 'Audit Logs', icon: ShieldCheck },
]

interface AdminLayoutProps {
    children: React.ReactNode
    title: string
    subtitle?: string
    actions?: React.ReactNode
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title, subtitle, actions }) => {
    const location = useLocation()
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)

    // Build breadcrumb
    const crumb = navItems.find(n => location.pathname === n.to)

    return (
        <div className="flex min-h-screen bg-[#0a0a0f] text-white">
            {/* ─── Mobile Sidebar Overlay ─────────────────────────────────────── */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* ─── Sidebar (Desktop + Mobile Drawer) ─────────────────────────── */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-[80] flex flex-col w-64 shrink-0 border-r border-white/[0.06] bg-[#0d0d15] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Logo strip */}
                <div className="h-16 flex items-center justify-between px-5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-semibold text-sm text-white/90">Admin Panel</span>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-2 hover:bg-white/5 rounded-lg"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto no-scrollbar">
                    {navItems.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            onClick={() => setIsSidebarOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${isActive
                                    ? 'bg-amber-500/15 text-amber-300 font-medium'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon className={cn(
                                        "w-4 h-4 shrink-0",
                                        isActive ? "text-amber-400" : "text-gray-500 group-hover:text-gray-300"
                                    )} />
                                    {label}
                                    {isActive && <ChevronRight className="w-3 h-3 ml-auto text-amber-500" />}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Bottom tag */}
                <div className="p-4 border-t border-white/[0.06]">
                    <div className="text-[10px] text-gray-600 uppercase tracking-widest">RenderNodes v1.0</div>
                </div>
            </aside>

            {/* ─── Main content ─────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Header */}
                <header className="h-16 border-b border-white/[0.06] bg-[#0d0d15]/80 backdrop-blur-md flex items-center px-4 lg:px-6 gap-2 lg:gap-4 shrink-0 sticky top-0 z-[60]">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="lg:hidden p-2 -ml-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <Menu className="w-5 h-5 text-gray-400" />
                    </button>

                    <h1 className="text-sm lg:text-base font-light text-white truncate mr-2">
                        {'Admin > ' + crumb?.label || 'Admin'}
                    </h1>

                    {/* Actions slot */}
                    {actions && <div className="ml-auto flex items-center gap-1.5 lg:gap-2">{actions}</div>}
                </header>


                {/* Page content */}
                <motion.main
                    key={location.pathname}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex-1"
                >
                    {/* Page heading */}
                    <div className="px-4 lg:px-6 pt-6 pb-2">
                        <h1 className="text-xl lg:text-2xl font-bold text-white">{title}</h1>
                        {subtitle && <p className="text-xs lg:text-sm text-gray-400 mt-0.5">{subtitle}</p>}
                    </div>
                    <div className="px-4 lg:px-6 pb-8">
                        {children}
                    </div>
                </motion.main>
            </div>
        </div>
    )
}

export default AdminLayout
