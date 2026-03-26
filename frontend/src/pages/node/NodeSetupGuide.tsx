import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    Download, Shield, Cpu, Zap, KeyRound, Power,
    CheckCircle2, ArrowRight, Loader2, Terminal, HardDrive,
    Wifi, RefreshCcw, ChevronRight, AlertTriangle, FileWarning,
    MousePointerClick, Info
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Setup step definitions
// ─────────────────────────────────────────────────────────────────────────────

interface SetupStep {
    id: number
    icon: React.ReactNode
    title: string
    subtitle: string
    description: string
    details: string[]
    color: string
    glow: string
    badge?: string
}

const SETUP_STEPS: SetupStep[] = [
    {
        id: 0,
        icon: <FileWarning className="w-6 h-6" />,
        title: 'Security & Unblocking',
        subtitle: 'Fix "Unrecognized App" error',
        description:
            'Since the software is downloaded from the web, Windows may block it by default. You must unblock the ZIP file BEFORE extracting it to avoid "Windows protected your PC" errors.',
        details: [
            'Right-click the downloaded BlendFarmNode.zip and select "Properties".',
            'At the bottom, check the "Unblock" checkbox and click "OK".',
            'If you see a "Windows protected your PC" blue screen: Click "More info" and then click "Run anyway".',
            'Extract the contents to C:\\RenderOnNodes\\ after unblocking.',
        ],
        color: 'text-red-400',
        glow: 'shadow-red-500/20',
        badge: 'Critical Step',
    },
    {
        id: 1,
        icon: <Shield className="w-6 h-6" />,
        title: 'Grant Permissions',
        subtitle: 'One-time Windows setup',
        description:
            'When you first run the application, Windows UAC will ask for administrator access. This is required so the node can manage Blender and run render processes in the background.',
        details: [
            'Click "Yes" when Windows shows the UAC prompt.',
            'Allow firewall access when prompted — the node needs outbound internet to reach the BlendFarm backend.',
            'Ensure you have extracted the EXE from the ZIP first.',
        ],
        color: 'text-amber-400',
        glow: 'shadow-amber-500/20',
        badge: 'Required',
    },
    {
        id: 2,
        icon: <Download className="w-6 h-6" />,
        title: 'Blender Auto-Download',
        subtitle: 'Handled automatically',
        description:
            'The node detects the required Blender version from each job and downloads it automatically to `C:\\RenderOnNodes\\Blender\\`. No manual Blender installation is needed.',
        details: [
            'First run will download ~250 MB — takes 1–2 minutes on a good connection.',
            'Multiple Blender versions are cached, so future jobs start instantly.',
            'You can pre-populate `C:\\RenderOnNodes\\Blender\\` with a Blender folder to skip the download.',
        ],
        color: 'text-orange-400',
        glow: 'shadow-orange-500/20',
        badge: 'Automatic',
    },
    {
        id: 3,
        icon: <HardDrive className="w-6 h-6" />,
        title: 'Hardware Detection & Benchmark',
        subtitle: 'GPU, CPU, and RAM scan',
        description:
            'On first startup the node scans your hardware and runs a short benchmark render. This determines your performance tier and ensures you only receive jobs your machine can handle.',
        details: [
            'CPU cores, RAM, and GPU are detected automatically.',
            'Benchmark takes ~2–5 minutes on first run only.',
            'Results are sent to BlendFarm and stored against your account — hardware is verified.',
            'Nodes that report false hardware specs will be permanently revoked.',
        ],
        color: 'text-cyan-400',
        glow: 'shadow-cyan-500/20',
        badge: 'One-time',
    },
    {
        id: 4,
        icon: <KeyRound className="w-6 h-6" />,
        title: 'Registration Token',
        subtitle: 'Link node to your account',
        description:
            'The node will prompt you to enter a registration token. This securely pairs it with your BlendFarm account. Generate a token from your dashboard and paste it when prompted.',
        details: [
            'Go back to the Node Provider Dashboard and click "Add New Node".',
            'Copy the token shown.',
            'Paste the token into the console window or config when the node asks.',
            'Tokens expire in 20 minutes and can only be used once.',
        ],
        color: 'text-purple-400',
        glow: 'shadow-purple-500/20',
        badge: 'Required',
    },
    {
        id: 5,
        icon: <Power className="w-6 h-6" />,
        title: 'Auto-Start on Boot',
        subtitle: 'Always-on earning',
        description:
            'After first-time setup the node registers itself as a Windows startup item. Every time your PC boots, the node starts automatically and begins accepting render jobs — no manual steps.',
        details: [
            'A startup shortcut is created in the Windows Startup folder.',
            'The node runs as a visible console window (so you always know it\'s active).',
            'You can pause/resume earning by closing or reopening the console.',
            'Run `setup-node.ps1` at any time to reconfigure or uninstall.',
        ],
        color: 'text-emerald-400',
        glow: 'shadow-emerald-500/20',
        badge: 'Automatic',
    },
    {
        id: 6,
        icon: <Zap className="w-6 h-6" />,
        title: 'Execute Jobs & Earn',
        subtitle: 'Fully automated from here',
        description:
            'Once registered and online, the node polls for jobs every few seconds. When a frame is assigned it renders it, uploads the result, and credits are added to your balance instantly.',
        details: [
            'Earnings are credited per frame — visible on your dashboard in real-time.',
            'The node handles everything: job polling, rendering, upload, and heartbeat.',
            'If a render fails the job is retried automatically on another node.',
            'Overheat protection is built-in — the node pauses if GPU temp is critical.',
        ],
        color: 'text-pink-400',
        glow: 'shadow-pink-500/20',
        badge: 'Ongoing',
    },
]

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const NodeSetupGuide: React.FC = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const downloadUrl = searchParams.get('downloadUrl')

    const [downloadState, setDownloadState] = useState<'idle' | 'starting' | 'done' | 'error'>('idle')
    const [activeStep, setActiveStep] = useState<number | null>(0) // Open security step by default
    const downloadLinkRef = useRef<HTMLAnchorElement>(null)

    // Trigger download on mount
    useEffect(() => {
        if (!downloadUrl) {
            setDownloadState('error')
            return
        }
        setDownloadState('starting')
        // Small delay so the page renders first, then trigger download
        const timer = setTimeout(() => {
            if (downloadLinkRef.current) {
                downloadLinkRef.current.click()
                setDownloadState('done')
            }
        }, 800)
        return () => clearTimeout(timer)
    }, [downloadUrl])

    const containerVariants = {
        hidden: {},
        visible: { transition: { staggerChildren: 0.1 } },
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Hidden download anchor */}
            {downloadUrl && (
                <a
                    ref={downloadLinkRef}
                    href={downloadUrl}
                    download="BlendFarmNode.zip"
                    className="hidden"
                    aria-hidden="true"
                />
            )}

            {/* Hero */}
            <div className="relative overflow-hidden border-b border-gray-800">
                {/* Background glow */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-600/10 blur-[120px] rounded-full" />
                </div>

                <div className="relative container mx-auto max-w-5xl px-6 py-16 text-center">
                    {/* Download status pill */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                            'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border',
                            downloadState === 'starting' && 'bg-purple-500/10 border-purple-500/30 text-purple-300',
                            downloadState === 'done' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
                            downloadState === 'error' && 'bg-red-500/10 border-red-500/30 text-red-300',
                            downloadState === 'idle' && 'bg-gray-800 border-gray-700 text-gray-400',
                        )}
                    >
                        {downloadState === 'starting' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting download...</>}
                        {downloadState === 'done' && <><CheckCircle2 className="w-3.5 h-3.5" /> Download started — check your browser</>}
                        {downloadState === 'error' && <><AlertTriangle className="w-3.5 h-3.5" /> Could not auto-start download</>}
                        {downloadState === 'idle' && <><Download className="w-3.5 h-3.5" /> Preparing download...</>}
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-purple-400 via-pink-300 to-cyan-400 bg-clip-text text-transparent"
                    >
                        Node Software Setup Guide
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-gray-400 text-lg max-w-2xl mx-auto"
                    >
                        Follow these steps to connect your computer to the BlendFarm network and
                        start earning credits from distributed rendering.
                    </motion.p>

                    {/* Download retry button if something went wrong */}
                    {downloadState === 'error' && downloadUrl && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6">
                            <a href={downloadUrl} download="BlendFarmNode.zip">
                                <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Manually
                                </Button>
                            </a>
                        </motion.div>
                    )}

                    {downloadState === 'error' && !downloadUrl && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6">
                            <Button
                                onClick={() => navigate('/node/dashboard')}
                                className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white"
                            >
                                <ArrowRight className="w-4 h-4 mr-2" />
                                Back to Dashboard to Download
                            </Button>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Steps */}
            <div className="container mx-auto max-w-5xl px-6 py-16">

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4"
                >
                    {SETUP_STEPS.map((step) => {
                        const isOpen = activeStep === step.id
                        return (
                            <motion.div key={step.id} variants={itemVariants}>
                                <div
                                    className={cn(
                                        'rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer',
                                        isOpen
                                            ? 'border-gray-600 bg-gray-900/80 shadow-xl ' + step.glow
                                            : 'border-gray-800 bg-gray-900/40 hover:border-gray-700 hover:bg-gray-900/60',
                                    )}
                                    onClick={() => setActiveStep(isOpen ? null : step.id)}
                                >
                                    {/* Header row */}
                                    <div className="flex items-center gap-4 p-5">
                                        {/* Number */}
                                        <div
                                            className={cn(
                                                'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border',
                                                isOpen ? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800',
                                            )}
                                        >
                                            <span className={step.color}>{step.id}</span>
                                        </div>

                                        {/* Icon */}
                                        <div className={cn('shrink-0', step.color)}>{step.icon}</div>

                                        {/* Text */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-white font-semibold">{step.title}</h3>
                                                {step.badge && (
                                                    <span
                                                        className={cn(
                                                            'text-xs px-2 py-0.5 rounded-full border font-medium',
                                                            step.badge === 'Critical Step' && 'bg-red-500/10 border-red-500/30 text-red-300',
                                                            step.badge === 'Required' && 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                                                            step.badge === 'Automatic' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
                                                            step.badge === 'One-time' && 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
                                                            step.badge === 'Ongoing' && 'bg-pink-500/10 border-pink-500/30 text-pink-400',
                                                        )}
                                                    >
                                                        {step.badge}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 mt-0.5">{step.subtitle}</p>
                                        </div>

                                        {/* Chevron */}
                                        <ChevronRight
                                            className={cn(
                                                'w-4 h-4 text-gray-500 shrink-0 transition-transform duration-300',
                                                isOpen && 'rotate-90',
                                            )}
                                        />
                                    </div>

                                    {/* Expanded body */}
                                    {isOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.25 }}
                                            className="px-5 pb-6 pt-0"
                                        >
                                            <div className="ml-[4.25rem] space-y-4">
                                                <p className="text-gray-300 text-sm leading-relaxed">
                                                    {step.description}
                                                </p>
                                                <ul className="space-y-2">
                                                    {step.details.map((d, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                                                            <CheckCircle2 className={cn('w-4 h-4 mt-0.5 shrink-0', step.color)} />
                                                            <span>{d}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </motion.div>

                {/* Quick reference info box */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="mt-12 rounded-2xl border border-gray-800 bg-gray-900/50 p-6"
                >
                    <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
                        <Terminal className="w-4 h-4 text-purple-400" />
                        Quick Reference
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                            <p className="text-gray-500 mb-1 text-xs font-medium uppercase tracking-wider">Install Dir</p>
                            <code className="text-cyan-400 font-mono">C:\RenderOnNodes\</code>
                        </div>
                        <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                            <p className="text-gray-500 mb-1 text-xs font-medium uppercase tracking-wider">Auto-Start</p>
                            <code className="text-cyan-400 font-mono">Windows Startup Folder</code>
                        </div>
                        <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                            <p className="text-gray-500 mb-1 text-xs font-medium uppercase tracking-wider">Node Limit</p>
                            <code className="text-cyan-400 font-mono">10 nodes / account</code>
                        </div>
                    </div>
                </motion.div>

                {/* Policy Notice */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="mt-6 rounded-2xl border border-red-500/15 bg-red-500/5 p-5 flex items-start gap-3"
                >
                    <Shield className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-semibold text-red-300 mb-1">Strict Node Policy</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Nodes must maintain a live heartbeat and honest hardware reporting at all times.
                            Nodes that go offline mid-render, report inflated hardware specs, or attempt to
                            game the credit system will be <strong className="text-red-400">permanently revoked</strong>{' '}
                            with no appeal. Only connect machines you intend to keep online and that accurately
                            reflect their true specifications.
                        </p>
                    </div>
                </motion.div>

                {/* Actions */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                    <Button
                        onClick={() => navigate('/node/dashboard')}
                        className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white shadow-xl shadow-purple-500/10 px-8"
                    >
                        <Zap className="w-4 h-4 mr-2" />
                        Go to Node Dashboard
                    </Button>
                    {downloadUrl && (
                        <a href={downloadUrl} download="BlendFarmNode.zip">
                            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-white/5">
                                <RefreshCcw className="w-4 h-4 mr-2" />
                                Re-download ZIP
                            </Button>
                        </a>
                    )}
                </motion.div>
            </div>
        </div>
    )
}

export default NodeSetupGuide
