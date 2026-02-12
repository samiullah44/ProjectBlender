import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users,
    Search,
    CheckCircle,
    XCircle,
    Clock,
    Download,
    Shield,
    Loader2,
    Calendar,
    Cpu,
    HardDrive,
    Wifi,
    Globe,
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { authService, type Application } from '@/services/authService'
import { toast } from 'react-hot-toast'
import { websocketService } from '@/services/websocketService'

const AdminApplications: React.FC = () => {
    const [applications, setApplications] = useState<Application[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedApp, setExpandedApp] = useState<string | null>(null)
    const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    useEffect(() => {
        fetchApplications()

        // Subscribe to live updates
        const unsubscribe = websocketService.subscribeToSystem((data) => {
            console.log('📢 Admin Applications received live update:', data)
            if (data.type === 'application_new' || data.type === 'application_status_change') {
                fetchApplications()
            }
        })

        return () => {
            unsubscribe()
        }
    }, [])

    const fetchApplications = async () => {
        try {
            setIsLoading(true)
            const response = await authService.getApplications()
            if (response.success && response.applications) {
                setApplications(response.applications)
            }
        } catch (error) {
            console.error('Error fetching applications:', error)
            toast.error('Failed to load applications')
        } finally {
            setIsLoading(false)
        }
    }

    const handleApprove = async (userId: string) => {
        try {
            setActionLoading(userId)
            const response = await authService.approveApplication(userId)
            if (response.success) {
                toast.success('Application approved successfully!')
                await fetchApplications()
            } else {
                toast.error(response.error || 'Failed to approve application')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to approve application')
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (userId: string) => {
        if (!rejectionReason.trim()) {
            toast.error('Please provide a rejection reason')
            return
        }

        try {
            setActionLoading(userId)
            const response = await authService.rejectApplication(userId, rejectionReason)
            if (response.success) {
                toast.success('Application rejected')
                setShowRejectDialog(null)
                setRejectionReason('')
                await fetchApplications()
            } else {
                toast.error(response.error || 'Failed to reject application')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to reject application')
        } finally {
            setActionLoading(null)
        }
    }

    const filteredApplications = applications.filter(app =>
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white p-6">
            <div className="container mx-auto max-w-7xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Shield className="w-8 h-8 text-purple-400" />
                            Node Provider Applications
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Review and manage incoming requests to join the render network
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" className="border-white/20 hover:bg-white/5" onClick={fetchApplications}>
                            <Clock className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-400">Pending Review</p>
                                    <p className="text-2xl font-bold mt-1">{applications.length}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-amber-500/20">
                                    <Clock className="w-6 h-6 text-amber-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-400">Total Applications</p>
                                    <p className="text-2xl font-bold mt-1">{applications.length}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-blue-500/20">
                                    <Users className="w-6 h-6 text-blue-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-400">Awaiting Action</p>
                                    <p className="text-2xl font-bold mt-1">{applications.length}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-purple-500/20">
                                    <Shield className="w-6 h-6 text-purple-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search by name or email..."
                            className="pl-10 bg-white/5 border-white/10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Applications List */}
                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Applications List</CardTitle>
                        <CardDescription>Recent applications sorted by date</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                            </div>
                        ) : filteredApplications.length > 0 ? (
                            <div className="space-y-4">
                                {filteredApplications.map((app) => (
                                    <motion.div
                                        key={app._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="rounded-lg bg-white/5 border border-white/5 hover:border-white/10 overflow-hidden"
                                    >
                                        {/* Main Application Row */}
                                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 gap-4">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                                                    {app.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-white">{app.name}</h3>
                                                    <p className="text-sm text-gray-400">{app.email}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
                                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                                    <Calendar className="w-4 h-4" />
                                                    {new Date(app.nodeProviderApplicationDate).toLocaleDateString()}
                                                </div>

                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                                                    Pending Review
                                                </Badge>

                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-white/20 hover:bg-white/5"
                                                        onClick={() => setExpandedApp(expandedApp === app._id ? null : app._id)}
                                                    >
                                                        {expandedApp === app._id ? (
                                                            <>
                                                                <ChevronUp className="w-4 h-4 mr-1" />
                                                                Hide Details
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronDown className="w-4 h-4 mr-1" />
                                                                View Details
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        <AnimatePresence>
                                            {expandedApp === app._id && app.nodeProviderApplication && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-white/10"
                                                >
                                                    <div className="p-6 space-y-6">
                                                        {/* System Information */}
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                                                                <Cpu className="w-4 h-4" />
                                                                System Information
                                                            </h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                <div className="bg-white/5 p-3 rounded-lg">
                                                                    <p className="text-xs text-gray-400">Operating System</p>
                                                                    <p className="text-sm font-medium">{app.nodeProviderApplication.operatingSystem}</p>
                                                                </div>
                                                                <div className="bg-white/5 p-3 rounded-lg">
                                                                    <p className="text-xs text-gray-400">CPU Model</p>
                                                                    <p className="text-sm font-medium">{app.nodeProviderApplication.cpuModel}</p>
                                                                </div>
                                                                <div className="bg-white/5 p-3 rounded-lg">
                                                                    <p className="text-xs text-gray-400">GPU Model</p>
                                                                    <p className="text-sm font-medium">{app.nodeProviderApplication.gpuModel}</p>
                                                                </div>
                                                                <div className="bg-white/5 p-3 rounded-lg">
                                                                    <p className="text-xs text-gray-400">RAM</p>
                                                                    <p className="text-sm font-medium">{app.nodeProviderApplication.ramSize} GB</p>
                                                                </div>
                                                                <div className="bg-white/5 p-3 rounded-lg">
                                                                    <p className="text-xs text-gray-400">Storage</p>
                                                                    <p className="text-sm font-medium">{app.nodeProviderApplication.storageSize} GB</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Network Information */}
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                                                                <Wifi className="w-4 h-4" />
                                                                Network Information
                                                            </h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                <div className="bg-white/5 p-3 rounded-lg">
                                                                    <p className="text-xs text-gray-400">Internet Speed</p>
                                                                    <p className="text-sm font-medium">{app.nodeProviderApplication.internetSpeed} Mbps</p>
                                                                </div>
                                                                <div className="bg-white/5 p-3 rounded-lg">
                                                                    <p className="text-xs text-gray-400">Country</p>
                                                                    <p className="text-sm font-medium">{app.nodeProviderApplication.country}</p>
                                                                </div>
                                                                <div className="bg-white/5 p-3 rounded-lg">
                                                                    <p className="text-xs text-gray-400">IP Address</p>
                                                                    <p className="text-sm font-medium">{app.nodeProviderApplication.ipAddress}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Additional Notes */}
                                                        {app.nodeProviderApplication.additionalNotes && (
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-gray-300 mb-2">Additional Notes</h4>
                                                                <div className="bg-white/5 p-3 rounded-lg">
                                                                    <p className="text-sm text-gray-300">{app.nodeProviderApplication.additionalNotes}</p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Action Buttons */}
                                                        <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                                                            <Button
                                                                onClick={() => handleApprove(app._id)}
                                                                disabled={actionLoading === app._id}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                                                            >
                                                                {actionLoading === app._id ? (
                                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                ) : (
                                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                                )}
                                                                Approve Application
                                                            </Button>
                                                            <Button
                                                                onClick={() => setShowRejectDialog(app._id)}
                                                                disabled={actionLoading === app._id}
                                                                variant="outline"
                                                                className="border-red-500/50 text-red-400 hover:bg-red-500/10 flex-1"
                                                            >
                                                                <XCircle className="w-4 h-4 mr-2" />
                                                                Reject Application
                                                            </Button>
                                                        </div>

                                                        {/* Reject Dialog */}
                                                        {showRejectDialog === app._id && (
                                                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-4">
                                                                <h4 className="text-sm font-semibold text-red-400 mb-3">Rejection Reason</h4>
                                                                <textarea
                                                                    value={rejectionReason}
                                                                    onChange={(e) => setRejectionReason(e.target.value)}
                                                                    placeholder="Please provide a reason for rejection..."
                                                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[80px]"
                                                                />
                                                                <div className="flex items-center gap-2 mt-3">
                                                                    <Button
                                                                        onClick={() => handleReject(app._id)}
                                                                        disabled={actionLoading === app._id || !rejectionReason.trim()}
                                                                        className="bg-red-600 hover:bg-red-700 text-white"
                                                                    >
                                                                        {actionLoading === app._id ? (
                                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                        ) : (
                                                                            <XCircle className="w-4 h-4 mr-2" />
                                                                        )}
                                                                        Confirm Rejection
                                                                    </Button>
                                                                    <Button
                                                                        onClick={() => {
                                                                            setShowRejectDialog(null)
                                                                            setRejectionReason('')
                                                                        }}
                                                                        variant="outline"
                                                                        className="border-white/20"
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No pending applications found</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default AdminApplications
