import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Key, 
  Monitor, 
  Globe,
  Mail,
  Smartphone,
  ChevronRight,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/utils'

const Settings = () => {
  const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'security' | 'api'>('account')

  return (
    <div className="min-h-screen bg-gray-950 pt-32 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 space-y-2">
                {[
                    { id: 'account', label: 'General', icon: <Monitor className="w-4 h-4" /> },
                    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
                    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
                    { id: 'api', label: 'API Keys', icon: <Key className="w-4 h-4" /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                            activeTab === tab.id 
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 space-y-6">
                
                {activeTab === 'account' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                         <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle>Display Preferences</CardTitle>
                                <CardDescription>Customize how RenderOnNodes looks and feels for you.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400">
                                            <Globe className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Interface Language</div>
                                            <div className="text-[10px] text-gray-500 uppercase font-black mt-0.5">English (US)</div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-blue-400 font-bold hover:bg-blue-500/10">Change</Button>
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400">
                                            <Monitor className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Default Role</div>
                                            <div className="text-[10px] text-gray-500 uppercase font-black mt-0.5">Client View</div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-blue-400 font-bold hover:bg-blue-500/10">Switch</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {activeTab === 'notifications' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                        <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle>Push Notifications</CardTitle>
                                <CardDescription>Stay updated on your render jobs and payouts.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {[
                                    { title: "Job Status Changes", desc: "Notify when a job starts, completes, or fails.", icon: <Zap className="w-4 h-4" /> },
                                    { title: "Payment Confirmations", desc: "Notify when tokens are locked or released.", icon: <CheckCircle2 className="w-4 h-4" /> },
                                    { title: "System Maintenance", desc: "Alert me of upcoming network upgrades.", icon: <Shield className="w-4 h-4" /> }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">{item.title}</div>
                                                <div className="text-[10px] text-gray-500">{item.desc}</div>
                                            </div>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {activeTab === 'security' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                         <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle>Password Management</CardTitle>
                                <CardDescription>Last changed 3 months ago.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button variant="outline" className="border-white/10 hover:bg-white/5 font-bold px-6">
                                    Change Password
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl border-l-2 border-l-orange-500">
                            <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400 shrink-0">
                                        <Smartphone className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-10">Authenticator App</h3>
                                        <p className="text-sm text-gray-500">Enable 2FA using apps like Google Authenticator or Authy.</p>
                                    </div>
                                </div>
                                <Button className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-8">Setup</Button>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {activeTab === 'api' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                        <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle>Platform API Keys</CardTitle>
                                <CardDescription>Use these keys to authenticate your CLI or Blender Plugin.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-6 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <Key className="w-12 h-12 text-gray-700 mb-4" />
                                    <h4 className="text-white font-bold mb-2">No Active Keys</h4>
                                    <p className="text-gray-500 text-xs mb-6 max-w-xs">Generate a key to start rendering from the Command Line Interface (CLI).</p>
                                    <Button className="bg-blue-600 hover:bg-blue-500 font-bold px-8">Generate Key</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
