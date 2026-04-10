// components/admin/AdminLayout.tsx
import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    LayoutDashboard,
    BarChart3,
    Layers,
    HardDrive,
    Users,
    Shield,
    ShieldCheck,
    ChevronRight
} from 'lucide-react'

const navItems = [
    { to: '/admin/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/admin/analytics',    label: 'Analytics',    icon: BarChart3 },
    { to: '/admin/jobs',         label: 'Jobs',         icon: Layers },
    { to: '/admin/nodes',        label: 'Nodes',        icon: HardDrive },
    { to: '/admin/users',        label: 'Users',        icon: Users },
    { to: '/admin/applications', label: 'Applications', icon: Shield },
    { to: '/admin/audit',        label: 'Audit Logs',   icon: ShieldCheck },
]

interface AdminLayoutProps {
    children: React.ReactNode
    title: string
    subtitle?: string
    actions?: React.ReactNode
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title, subtitle, actions }) => {
    const location = useLocation()

    // Build breadcrumb
    const crumb = navItems.find(n => location.pathname.startsWith(n.to))

    return (
        <div className="flex min-h-screen bg-[#0a0a0f] text-white">
            {/* ─── Sidebar ─────────────────────────────────────────────────── */}
            <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-white/[0.06] bg-[#0d0d15]">
                {/* Logo strip */}
                <div className="h-16 flex items-center px-5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-semibold text-sm text-white/90">Admin Panel</span>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 px-3 space-y-0.5">
                    {navItems.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${isActive
                                    ? 'bg-amber-500/15 text-amber-300 font-medium'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
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
                {/* Top header bar */}
                <header className="h-16 border-b border-white/[0.06] bg-[#0d0d15]/80 backdrop-blur-md flex items-center px-6 gap-4 shrink-0">
                    {/* Mobile nav items */}
                    <nav className="flex items-center gap-1 lg:hidden overflow-x-auto no-scrollbar">
                        {navItems.map(({ to, label, icon: Icon }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) =>
                                    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-all ${isActive
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'text-gray-400 hover:text-white'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon className="w-3.5 h-3.5" />
                                        {label}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    {/* Breadcrumb */}
                    <div className="hidden lg:flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Admin</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                        <span className="text-white/90 font-medium">{crumb?.label || title}</span>
                    </div>

                    {/* Actions slot */}
                    {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
                </header>

                {/* Page content */}
                <motion.main
                    key={location.pathname}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex-1 overflow-auto"
                >
                    {/* Page heading */}
                    <div className="px-6 pt-6 pb-2">
                        <h1 className="text-2xl font-bold text-white">{title}</h1>
                        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
                    </div>
                    <div className="px-6 pb-8">
                        {children}
                    </div>
                </motion.main>
            </div>
        </div>
    )
}

export default AdminLayout
