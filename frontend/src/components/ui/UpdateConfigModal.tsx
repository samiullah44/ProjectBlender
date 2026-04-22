import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { X, Settings, Loader2, ArrowRight, Shield, Percent, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'react-hot-toast';
import { 
    PublicKey, 
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import idl from '@/idl/render_network.json';

interface UpdateConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentConfig: {
        admin: string;
        feeCollector: string;
        platformFeeBps: number;
    } | null;
    onSuccess: () => void;
}

export const UpdateConfigModal: React.FC<UpdateConfigModalProps> = ({ 
    isOpen, 
    onClose, 
    currentConfig,
    onSuccess 
}) => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const { publicKey, connected } = wallet;
    
    const [newAdmin, setNewAdmin] = useState('');
    const [newFeeCollector, setNewFeeCollector] = useState('');
    const [newFeeBps, setNewFeeBps] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (currentConfig && isOpen) {
            setNewAdmin(currentConfig.admin);
            setNewFeeCollector(currentConfig.feeCollector);
            setNewFeeBps(currentConfig.platformFeeBps.toString());
        }
    }, [currentConfig, isOpen]);

    const handleUpdateConfig = async () => {
        if (!connected || !publicKey) {
            toast.error('Please connect your wallet');
            return;
        }

        if (!currentConfig) {
            toast.error('Config not loaded yet. Please wait.');
            return;
        }

        setIsLoading(true);
        const toastId = toast.loading('Sending update request to backend...');

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/update-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    newAdmin: newAdmin || currentConfig.admin,
                    newFeeCollector: newFeeCollector || currentConfig.feeCollector,
                    platformFeeBps: newFeeBps !== '' ? Number(newFeeBps) : currentConfig.platformFeeBps
                })
            });

            const res = await response.json();

            if (!res.success) {
                throw new Error(res.error || res.details || 'Update failed');
            }

            toast.success('On-chain configuration updated via backend!', { id: toastId });
            console.log('Update Config TX:', res.transaction);
            
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);

        } catch (error: any) {
            console.error('Update config failed:', error);
            toast.error(error.message || 'Update failed', { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        onClick={onClose}
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-lg bg-gray-950 border border-white/10 rounded-3xl shadow-[0_0_50px_-12px_rgba(30,64,175,0.3)] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-8 border-b border-white/5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                                        <Settings className="w-8 h-8 text-blue-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white leading-tight">System Config</h2>
                                        <p className="text-blue-400/70 font-medium text-sm">Manage on-chain platform settings</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                                    <X className="w-6 h-6 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-5">
                                {/* Admin Address */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Shield className="w-3 h-3" /> System Admin
                                    </label>
                                    <Input 
                                        placeholder="Admin Wallet Address"
                                        value={newAdmin}
                                        onChange={(e) => setNewAdmin(e.target.value)}
                                        className="bg-white/5 border-white/10 py-5 font-mono text-xs"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1 ml-1">The primary authority for system changes.</p>
                                </div>

                                {/* Fee Collector Address */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <UserIcon className="w-3 h-3" /> Platform Fee Collector
                                    </label>
                                    <Input 
                                        placeholder="Fee Collector Wallet Address"
                                        value={newFeeCollector}
                                        onChange={(e) => setNewFeeCollector(e.target.value)}
                                        className="bg-white/5 border-white/10 py-5 font-mono text-xs text-amber-400"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1 ml-1">Fees from every job will be sent to this wallet.</p>
                                </div>

                                {/* Fee Percentage */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Percent className="w-3 h-3" /> Platform Fee (BPS)
                                    </label>
                                    <div className="relative">
                                        <Input 
                                            type="number"
                                            placeholder="200"
                                            value={newFeeBps}
                                            onChange={(e) => setNewFeeBps(e.target.value)}
                                            className="bg-white/5 border-white/10 py-5 text-xl font-bold"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                                            {(Number(newFeeBps) / 100).toFixed(1)}%
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-1 ml-1">100 BPS = 1%. Default is 200 (2%).</p>
                                </div>
                            </div>

                            <Button
                                onClick={handleUpdateConfig}
                                disabled={isLoading || !connected}
                                className="w-full py-7 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-[0_10px_30px_-10px_rgba(37,99,235,0.4)] transition-all active:scale-[0.98]"
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-3">
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        Updating Chain...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        Update Configuration
                                        <ArrowRight className="w-5 h-5" />
                                    </div>
                                )
                                }
                            </Button>
                        </div>
                        
                        <div className="p-4 bg-blue-500/5 text-center">
                            <p className="text-[10px] text-blue-400/60 uppercase tracking-tighter">
                                Note: Only the current admin can sign this transaction
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
