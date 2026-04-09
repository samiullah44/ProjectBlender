import React, { useState } from 'react'
import { 
  Wallet, 
  RefreshCw, 
  Shield, 
  ExternalLink,
  Mail,
  User as UserIcon,
  Copy,
  Check,
  Activity,
  LogOut
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { useRenderNetwork } from '@/hooks/useRenderNetwork'
import { useWallet } from '@solana/wallet-adapter-react'
import { cn } from '@/lib/utils'

const Profile = () => {
  const { user, logout } = useAuthStore()
  const { publicKey: walletAddress } = useWallet()
  const { syncSolanaSeed, isRefreshing } = useRenderNetwork()
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Get user initials for avatar
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'U'

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-100 font-sans pb-20">
      {/* Dynamic Header Banner */}
      <div className="h-64 w-full bg-gradient-to-br from-indigo-600 via-purple-600 to-emerald-500 relative overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10">
        
        {/* Profile Header Section */}
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 sm:p-10 shadow-2xl mb-8 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-10">
            {/* Avatar */}
            <div className="relative -mt-20 md:-mt-24">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gray-900 border-4 border-gray-900 flex items-center justify-center text-4xl md:text-5xl font-black text-white shadow-xl bg-gradient-to-tr from-gray-800 to-gray-700">
                    {initials}
                </div>
                <div className="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-gray-900 shadow-sm" title="Active" />
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center md:items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold tracking-tight text-white">{user?.name || 'Anonymous User'}</h1>
                    <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold tracking-wide border border-indigo-500/20">
                        {user?.role === 'node_provider' ? 'Node Provider' : 'Client Account'}
                    </span>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {user?.email}</span>
                    <span className="hidden md:inline">•</span>
                    <span className="flex items-center gap-1.5">ID: {user?.id?.substring(0, 8)}...</span>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                <Button variant="outline" className="flex-1 md:flex-none border-gray-700 hover:bg-gray-800 text-gray-300">
                    Edit Profile
                </Button>
                <Button 
                    onClick={() => logout()}
                    variant="ghost" 
                    className="p-3 text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                    title="Logout"
                >
                    <LogOut className="w-5 h-5" />
                </Button>
            </div>
        </div>

        {/* Modular Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column - Blockchain & Wallet */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* Wallet Connection Card */}
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-1">Web3 Identity Wallet</h2>
                            <p className="text-sm text-gray-400">Manage your connected Solana wallet and cryptographic sessions.</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <Wallet className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-[#030712] rounded-2xl border border-gray-800 p-5 mb-6">
                        <div className="flex items-center justify-between gap-4 mb-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Connected Address</span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                <Activity className="w-3 h-3" /> Network Active 
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <code className="text-sm font-mono text-gray-300 truncate">
                                {walletAddress?.toBase58() || 'No Wallet Connected'}
                            </code>
                            {walletAddress && (
                                <button 
                                    onClick={() => copyToClipboard(walletAddress.toBase58())}
                                    className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors shrink-0"
                                >
                                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    </div>

                    <Button 
                        onClick={syncSolanaSeed}
                        disabled={isRefreshing}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-6 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                        {isRefreshing ? 'Synchronizing Identity...' : 'Re-Sync Identity Seed'}
                    </Button>
                </div>

                {/* Additional Settings (Placeholder for future layout) */}
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-sm">
                    <h2 className="text-xl font-bold text-white mb-6">Security & Preferences</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-800 cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-gray-800 rounded-xl text-gray-300"><Shield className="w-5 h-5" /></div>
                                <div>
                                    <div className="font-semibold text-gray-200">Two-Factor Authentication</div>
                                    <div className="text-xs text-gray-500">Add an extra layer of security</div>
                                </div>
                            </div>
                            <Button variant="outline" className="border-gray-700 text-xs h-8">Enable</Button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Right Column - Stats & Summary */}
            <div className="space-y-8">
                
                {/* Platform Stats Card */}
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">Platform Reputation</h3>
                    
                    <div className="mb-8">
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-5xl font-black text-white tracking-tighter">99.2</span>
                            <span className="text-emerald-400 font-bold">/ 100</span>
                        </div>
                        <div className="text-sm text-gray-500">Global Trust Score</div>
                        
                        {/* Progress bar */}
                        <div className="h-2 w-full bg-gray-800 rounded-full mt-4 overflow-hidden">
                            <div className="h-full w-[99.2%] bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-t border-gray-800">
                            <span className="text-sm text-gray-400">Account Maturity</span>
                            <span className="text-sm font-semibold text-gray-200">Level 2 (Verified)</span>
                        </div>
                        <div className="flex items-center justify-between py-3 border-t border-gray-800">
                            <span className="text-sm text-gray-400">Support Priority</span>
                            <span className="text-sm font-semibold text-gray-200">Standard</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>

      </div>
    </div>
  )
}

export default Profile
