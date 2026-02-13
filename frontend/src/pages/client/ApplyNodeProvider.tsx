import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
    Cpu,
    Wifi,
    DollarSign,
    TrendingUp,
    Shield,
    CheckCircle,
    Loader2,
    ArrowLeft,
    AlertCircle,
    Server,
    XCircle
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/authService'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'

// GPU Blacklist - same as backend
const GPU_BLACKLIST = [
    'intel hd', 'intel uhd', 'intel iris', 'vega 3', 'vega 6', 'vega 8',
    'gt 710', 'gt 720', 'gt 730', 'gt 740', 'gt 1030', 'gtx 1630',
    'mx110', 'mx130', 'mx150', 'mx230', 'mx250', 'mx330', 'mx350',
    'radeon r5', 'radeon r7', 'radeon hd', 'geforce 710', 'geforce 720',
    'geforce 730', 'geforce 740', 'geforce gt 610', 'geforce gt 630'
];

const ApplyNodeProvider: React.FC = () => {
    const navigate = useNavigate()
    const { getProfile } = useAuthStore()
    const [loading, setLoading] = useState(false)
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [formData, setFormData] = useState({
        operatingSystem: '',
        cpuModel: '',
        gpuModel: '',
        ramSize: '',
        storageSize: '',
        internetSpeed: '',
        country: '',
        ipAddress: '',
        additionalNotes: '',
        gpuVram: '',
        cpuCores: '',
        uploadSpeed: '',
        storageType: 'ssd',
        gpuCount: '1',
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });

        // Clear validation error for this field when user types
        if (validationErrors[name]) {
            setValidationErrors({
                ...validationErrors,
                [name]: ''
            });
        }
    }

    // 🎯 VALIDATION FUNCTIONS - Same as backend
    const validateGPU = (gpuModel: string, gpuVram: string): string | null => {
        const lowerGpu = gpuModel.toLowerCase();
        const vram = parseInt(gpuVram);

        // Check blacklist
        for (const badGpu of GPU_BLACKLIST) {
            if (lowerGpu.includes(badGpu)) {
                return `GPU "${gpuModel}" is not supported (integrated or too weak)`;
            }
        }

        // Check VRAM minimum
        if (vram < 4) {
            return 'Minimum 4GB VRAM required';
        }

        // Check for high-end GPUs with correct VRAM
        if (lowerGpu.includes('4090') && vram < 24) {
            return 'RTX 4090 must have 24GB VRAM';
        }
        if (lowerGpu.includes('4080') && vram < 16) {
            return 'RTX 4080 must have 16GB VRAM';
        }
        if (lowerGpu.includes('3090') && vram < 24) {
            return 'RTX 3090 must have 24GB VRAM';
        }
        if (lowerGpu.includes('3080') && vram < 10) {
            return 'RTX 3080 must have at least 10GB VRAM';
        }
        if (lowerGpu.includes('3070') && vram < 8) {
            return 'RTX 3070 must have 8GB VRAM';
        }
        if (lowerGpu.includes('3060') && vram < 12 && !lowerGpu.includes('3060 ti')) {
            return 'RTX 3060 usually has 12GB VRAM';
        }

        return null;
    };

    const validateCPU = (cpuModel: string, cpuCores: string): string | null => {
        const cores = parseInt(cpuCores);
        const lowerCpu = cpuModel.toLowerCase();

        if (cores < 4) {
            return 'Minimum 4 CPU cores required';
        }

        if (lowerCpu.includes('i3') && cores > 4) {
            return 'i3 processors typically have 4 cores or less';
        }
        if (lowerCpu.includes('pentium') || lowerCpu.includes('celeron')) {
            return 'Pentium/Celeron processors not supported';
        }
        if (lowerCpu.includes('atom')) {
            return 'Atom processors not supported';
        }

        return null;
    };

    // 🎯 MAIN VALIDATION FUNCTION - Runs before API call
    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        // Check required fields
        const requiredFields = [
            'operatingSystem', 'cpuModel', 'gpuModel', 'ramSize',
            'storageSize', 'internetSpeed', 'uploadSpeed', 'country',
            'ipAddress', 'gpuVram', 'cpuCores', 'storageType'
        ];

        for (const field of requiredFields) {
            if (!formData[field as keyof typeof formData]) {
                errors[field] = 'This field is required';
            }
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return false;
        }

        // Numeric validations
        const ram = parseInt(formData.ramSize);
        if (ram < 8) {
            errors.ramSize = 'Minimum 8GB RAM required';
        }

        const storage = parseInt(formData.storageSize);
        if (storage < 256) {
            errors.storageSize = 'Minimum 256GB storage required';
        }

        const download = parseInt(formData.internetSpeed);
        if (download < 5) {
            errors.internetSpeed = 'Minimum 5 Mbps download required';
        }

        const upload = parseInt(formData.uploadSpeed);
        if (upload < 5) {
            errors.uploadSpeed = 'Minimum 5 Mbps upload required';
        }

        const gpuVram = parseInt(formData.gpuVram);
        if (gpuVram < 4) {
            errors.gpuVram = 'Minimum 4GB GPU VRAM required';
        }

        const cpuCores = parseInt(formData.cpuCores);
        if (cpuCores < 4) {
            errors.cpuCores = 'Minimum 4 CPU cores required';
        }

        // GPU validation
        const gpuError = validateGPU(formData.gpuModel, formData.gpuVram);
        if (gpuError) {
            errors.gpuModel = gpuError;
        }

        // CPU validation
        const cpuError = validateCPU(formData.cpuModel, formData.cpuCores);
        if (cpuError) {
            errors.cpuModel = cpuError;
        }

        // Storage type warning (not a hard error)
        if (formData.storageType === 'hdd') {
            toast('HDD detected - SSD is strongly recommended for rendering', {
                icon: '⚠️',
                duration: 5000
            });
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // 🎯 RUN VALIDATION FIRST - Stop if invalid
        if (!validateForm()) {
            toast.error('Please fix the validation errors below');
            return;
        }

        try {
            setLoading(true)
            const applicationData = {
                operatingSystem: formData.operatingSystem,
                cpuModel: formData.cpuModel,
                cpuCores: parseInt(formData.cpuCores),
                gpuModel: formData.gpuModel,
                gpuVram: parseInt(formData.gpuVram),
                gpuCount: parseInt(formData.gpuCount) || 1,
                ramSize: parseInt(formData.ramSize),
                storageSize: parseInt(formData.storageSize),
                storageType: formData.storageType as 'ssd' | 'hdd',
                internetSpeed: parseInt(formData.internetSpeed),
                uploadSpeed: parseInt(formData.uploadSpeed),
                country: formData.country,
                ipAddress: formData.ipAddress,
                additionalNotes: formData.additionalNotes
            }

            const response = await authService.applyAsNodeProvider(applicationData)

            if (response.success) {
                if (response.autoApproved) {
                    toast.success('✅ Congratulations! Your application is approved for initial phase! Check your Node provider dashboard for node software.');
                } else {
                    toast.success('Application submitted successfully!');
                }
                await getProfile();
                navigate('/client/dashboard');
            } else {
                toast.error(response.error || 'Failed to submit application');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit application');
        } finally {
            setLoading(false);
        }
    }

    // Helper to check if a field has error
    const hasError = (fieldName: string): boolean => {
        return !!validationErrors[fieldName];
    };

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
                    className="max-w-4xl mx-auto"
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
                                {/* MINIMUM REQUIREMENTS BANNER */}
                                <div className="p-4 rounded-lg bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-semibold text-purple-400 mb-1">Minimum Requirements</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-300">
                                                <span>• RAM: 8GB+</span>
                                                <span>• VRAM: 4GB+</span>
                                                <span>• CPU: 4+ cores</span>
                                                <span>• Storage: 256GB+</span>
                                                <span>• Download: 5+ Mbps</span>
                                                <span>• Upload: 5+ Mbps</span>
                                                <span>• GPU: No integrated</span>
                                                <span>• SSD preferred</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Validation Summary - Show if there are errors */}
                                {Object.keys(validationErrors).length > 0 && (
                                    <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30">
                                        <div className="flex items-start gap-3">
                                            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="font-semibold text-red-400 mb-2">
                                                    Please fix the following errors:
                                                </h4>
                                                <ul className="list-disc list-inside space-y-1">
                                                    {Object.values(validationErrors).map((error, index) => (
                                                        <li key={index} className="text-sm text-red-300">
                                                            {error}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}

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
                                                className={`bg-white/5 border-white/10 ${hasError('operatingSystem') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
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
                                                className={`bg-white/5 border-white/10 ${hasError('cpuModel') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                CPU Cores <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="cpuCores"
                                                type="number"
                                                value={formData.cpuCores}
                                                onChange={handleChange}
                                                placeholder="e.g., 8"
                                                className={`bg-white/5 border-white/10 ${hasError('cpuCores') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                min="1"
                                                max="128"
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
                                                className={`bg-white/5 border-white/10 ${hasError('gpuModel') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                GPU VRAM (GB) <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="gpuVram"
                                                type="number"
                                                value={formData.gpuVram}
                                                onChange={handleChange}
                                                placeholder="e.g., 8, 12, 24"
                                                className={`bg-white/5 border-white/10 ${hasError('gpuVram') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                min="1"
                                                max="128"
                                                step="1"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Number of GPUs
                                            </label>
                                            <Input
                                                name="gpuCount"
                                                type="number"
                                                value={formData.gpuCount}
                                                onChange={handleChange}
                                                placeholder="e.g., 1"
                                                className="bg-white/5 border-white/10"
                                                min="1"
                                                max="8"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Multiple GPUs earn more</p>
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
                                                className={`bg-white/5 border-white/10 ${hasError('ramSize') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                min="1"
                                                max="2048"
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
                                                placeholder="e.g., 1000 for 1TB"
                                                className={`bg-white/5 border-white/10 ${hasError('storageSize') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                min="1"
                                                max="100000"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Storage Type <span className="text-red-400">*</span>
                                            </label>
                                            <select
                                                name="storageType"
                                                value={formData.storageType}
                                                onChange={handleChange}
                                                className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white ${hasError('storageType') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                required
                                            >
                                                <option value="ssd">SSD (NVMe/SATA)</option>
                                                <option value="hdd">HDD</option>
                                            </select>
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
                                                Download Speed (Mbps) <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="internetSpeed"
                                                type="number"
                                                value={formData.internetSpeed}
                                                onChange={handleChange}
                                                placeholder="e.g., 100"
                                                className={`bg-white/5 border-white/10 ${hasError('internetSpeed') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                min="1"
                                                max="10000"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Upload Speed (Mbps) <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="uploadSpeed"
                                                type="number"
                                                value={formData.uploadSpeed}
                                                onChange={handleChange}
                                                placeholder="e.g., 50"
                                                className={`bg-white/5 border-white/10 ${hasError('uploadSpeed') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                min="1"
                                                max="10000"
                                                required
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Upload speed is critical for rendering</p>
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
                                                className={`bg-white/5 border-white/10 ${hasError('country') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                IP Address <span className="text-red-400">*</span>
                                            </label>
                                            <Input
                                                name="ipAddress"
                                                value={formData.ipAddress}
                                                onChange={handleChange}
                                                placeholder="e.g., 192.168.1.1"
                                                className={`bg-white/5 border-white/10 ${hasError('ipAddress') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
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