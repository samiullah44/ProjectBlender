import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
    Cpu,
    HardDrive,
    Wifi,
    Globe,
    Zap,
    DollarSign,
    TrendingUp,
    Shield,
    CheckCircle,
    Loader2,
    ArrowLeft
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/authService'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'

const ApplyNodeProvider: React.FC = () => {
    const navigate = useNavigate()
    const { getProfile } = useAuthStore()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        operatingSystem: '',
        cpuModel: '',
        gpuModel: '',
        ramSize: '',
        storageSize: '',
        internetSpeed: '',
        country: '',
        ipAddress: '',
        additionalNotes: ''
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation
        if (!formData.operatingSystem || !formData.cpuModel || !formData.gpuModel ||
            !formData.ramSize || !formData.storageSize || !formData.internetSpeed ||
            !formData.country || !formData.ipAddress) {
            toast.error('Please fill in all required fields')
            return
        }

        try {
            setLoading(true)
            const applicationData = {
                ...formData,
                ramSize: parseInt(formData.ramSize),
                storageSize: parseInt(formData.storageSize),
                internetSpeed: parseInt(formData.internetSpeed)
            }

            const response = await authService.applyAsNodeProvider(applicationData)

            if (response.success) {
                toast.success('Application submitted successfully!')
                await getProfile()
                navigate('/client/dashboard')
            } else {
                toast.error(response.error || 'Failed to submit application')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit application')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
            {/* Hero Section */}
            <div className="border-b border-white/10 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
                <div className="container mx-auto px-4 py-16">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/client/dashboard')}
                        className="mb-6 text-gray-400 hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Button>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-4xl mx-auto"
                    >
                        <h1 className="text-5xl font-bold mb-4">
                            Become a <span className="text-purple-400">Node Provider</span>
                        </h1>
                        <p className="text-xl text-gray-300 mb-8">
                            Join our distributed rendering network and earn money by contributing your GPU power
                        </p>

                        {/* Benefits Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                                <CardContent className="p-6 text-center">
                                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                                        <DollarSign className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <h3 className="font-bold mb-2">Earn Passive Income</h3>
                                    <p className="text-sm text-gray-400">
                                        Get paid for every frame you render. Turn your idle GPU into a revenue stream.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                                <CardContent className="p-6 text-center">
                                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                                        <TrendingUp className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <h3 className="font-bold mb-2">Flexible Schedule</h3>
                                    <p className="text-sm text-gray-400">
                                        Work on your own terms. Accept jobs when it's convenient for you.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                                <CardContent className="p-6 text-center">
                                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                        <Shield className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <h3 className="font-bold mb-2">Secure Platform</h3>
                                    <p className="text-sm text-gray-400">
                                        Your hardware and data are protected with enterprise-grade security.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Application Form */}
            <div className="container mx-auto px-4 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="max-w-3xl mx-auto"
                >
                    <Card className="bg-gray-900/50 border-white/10 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-2xl">Application Form</CardTitle>
                            <CardDescription>
                                Tell us about your system specifications and network capabilities
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-8">
                                {/* System Information */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Cpu className="w-5 h-5 text-purple-400" />
                                        System Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Operating System <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="operatingSystem"
                                                value={formData.operatingSystem}
                                                onChange={handleChange}
                                                placeholder="e.g., Windows 11, Ubuntu 22.04"
                                                className="bg-white/5 border-white/10"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                CPU Model <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="cpuModel"
                                                value={formData.cpuModel}
                                                onChange={handleChange}
                                                placeholder="e.g., Intel i7-12700K"
                                                className="bg-white/5 border-white/10"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                GPU Model <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="gpuModel"
                                                value={formData.gpuModel}
                                                onChange={handleChange}
                                                placeholder="e.g., NVIDIA RTX 4090"
                                                className="bg-white/5 border-white/10"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                RAM Size (GB) <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="ramSize"
                                                type="number"
                                                value={formData.ramSize}
                                                onChange={handleChange}
                                                placeholder="e.g., 32"
                                                className="bg-white/5 border-white/10"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Storage Size (GB) <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="storageSize"
                                                type="number"
                                                value={formData.storageSize}
                                                onChange={handleChange}
                                                placeholder="e.g., 1000"
                                                className="bg-white/5 border-white/10"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Network Information */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Wifi className="w-5 h-5 text-blue-400" />
                                        Network Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Internet Speed (Mbps) <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="internetSpeed"
                                                type="number"
                                                value={formData.internetSpeed}
                                                onChange={handleChange}
                                                placeholder="e.g., 100"
                                                className="bg-white/5 border-white/10"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Country <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="country"
                                                value={formData.country}
                                                onChange={handleChange}
                                                placeholder="e.g., United States"
                                                className="bg-white/5 border-white/10"
                                                required
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium mb-2">
                                                IP Address <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="ipAddress"
                                                value={formData.ipAddress}
                                                onChange={handleChange}
                                                placeholder="e.g., 192.168.1.1"
                                                className="bg-white/5 border-white/10"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Notes */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Additional Notes (Optional)
                                    </label>
                                    <textarea
                                        name="additionalNotes"
                                        value={formData.additionalNotes}
                                        onChange={handleChange}
                                        placeholder="Tell us anything else we should know..."
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                                    />
                                </div>

                                {/* Submit Button */}
                                <div className="flex items-center justify-between pt-6 border-t border-white/10">
                                    <p className="text-sm text-gray-400">
                                        <span className="text-red-400">*</span> Required fields
                                    </p>
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-4 h-4 mr-2" />
                                                Submit Application
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}

export default ApplyNodeProvider
