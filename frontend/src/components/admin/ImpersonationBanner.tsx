import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, X, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'

export const ImpersonationBanner: React.FC = () => {
    const { impersonatingUser, stopImpersonating } = useAuthStore()

    return (
        <AnimatePresence>
            {impersonatingUser && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="relative z-[100] bg-gradient-to-r from-red-600 to-orange-600 text-white"
                >
                    <div className="max-w-7xl mx-auto px-4 h-10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center p-1 rounded-full bg-white/20">
                                <ShieldAlert className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-xs font-semibold tracking-wide flex items-center gap-1.5 uppercase">
                                Impersonation Active:
                                <span className="bg-white/10 px-2 py-0.5 rounded border border-white/10 font-bold ml-1">
                                    {impersonatingUser.name || impersonatingUser.username}
                                </span>
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-[10px] bg-red-800/40 px-2 py-0.5 rounded italic opacity-80 hidden md:inline">
                                WARNING: Actions are performed as this user.
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={stopImpersonating}
                                className="h-7 text-xs font-bold bg-white text-red-600 hover:bg-red-50 hover:text-red-700 px-3 flex items-center gap-1.5 transition-all shadow-sm"
                            >
                                <X className="w-3 h-3" />
                                Exit Session
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
