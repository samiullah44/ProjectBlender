import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { X, DollarSign, Loader2, ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/Badge';
import { 
    PublicKey, 
    Transaction, 
} from '@solana/web3.js';
import { 
    getAssociatedTokenAddressSync, 
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    getAccount
} from '@solana/spl-token';

interface WithdrawProfitModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentBalance: number;
    collectorWallet: string;
    onSuccess: () => void;
    onOpenConfig: () => void;
}

export const WithdrawProfitModal: React.FC<WithdrawProfitModalProps> = ({ 
    isOpen, 
    onClose, 
    currentBalance, 
    collectorWallet,
    onSuccess,
    onOpenConfig
}) => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction, connected } = useWallet();
    const [amount, setAmount] = useState('');
    const [destination, setDestination] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);
    const [hasManuallySwitched, setHasManuallySwitched] = useState(false);

    // VITE_MINT_ADDRESS or fallback to Devnet USDC mock
    const STABLE_MINT = new PublicKey(import.meta.env.VITE_MINT_ADDRESS || "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

    useEffect(() => {
        if (connected && publicKey && step === 1 && !hasManuallySwitched) {
            setDestination(publicKey.toBase58());
            // Small visual delay for the "connection" feel
            const timer = setTimeout(() => setStep(2), 600);
            return () => clearTimeout(timer);
        }
    }, [connected, publicKey, step, hasManuallySwitched]);

    // Reset state when closed
    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setAmount('');
            setHasManuallySwitched(false);
        }
    }, [isOpen]);

    const handleWithdraw = async () => {
        if (!publicKey) {
            toast.error('Connect wallet first');
            return;
        }

        if (publicKey.toBase58() !== collectorWallet) {
            toast.error(`Wrong Wallet! Please connect the Fee Collector wallet: ${collectorWallet.slice(0, 8)}...`);
            return;
        }

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (Number(amount) > currentBalance) {
            toast.error('Insufficient profit balance');
            return;
        }

        try {
            new PublicKey(destination);
        } catch (e) {
            toast.error('Invalid destination address');
            return;
        }

        setIsLoading(true);
        const toastId = toast.loading('Preparing transaction...');
        
        try {
            const destPubkey = new PublicKey(destination);
            
            // 1. Resolve accounts
            const sourceAta = getAssociatedTokenAddressSync(STABLE_MINT, publicKey);
            const destinationAta = getAssociatedTokenAddressSync(STABLE_MINT, destPubkey);
            
            const transaction = new Transaction();
            
            // 2. Check if destination ATA exists, if not add creation instruction
            try {
                await getAccount(connection, destinationAta);
            } catch (e: any) {
                console.log("Destination ATA doesn't exist, adding init instruction...");
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        publicKey,
                        destinationAta,
                        destPubkey,
                        STABLE_MINT
                    )
                );
            }
            
            // 3. Add transfer instruction (6 decimals)
            const rawAmount = Math.floor(Number(amount) * 1e6);
            transaction.add(
                createTransferInstruction(
                    sourceAta,
                    destinationAta,
                    publicKey,
                    rawAmount
                )
            );
            
            toast.loading('Confirming in wallet...', { id: toastId });
            
            const signature = await sendTransaction(transaction, connection);
            
            toast.success(`Withdrawal successful!`, { id: toastId });
            console.log('Withdraw TX:', signature);
            
            // Delay for propagation
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
            
        } catch (error: any) {
            console.error('Withdraw failed:', error);
            toast.error(error.message || 'Withdrawal failed', { id: toastId });
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
                        className="relative w-full max-w-lg bg-gray-950 border border-white/10 rounded-3xl shadow-[0_0_50px_-12px_rgba(245,158,11,0.3)] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-5 lg:p-8 border-b border-white/5 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                            <div className="flex justify-between items-start">
                                <div className="flex items-start lg:items-center gap-3 lg:gap-4">
                                    <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shrink-0">
                                        <DollarSign className="w-6 h-6 lg:w-8 lg:h-8 text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-xl lg:text-2xl font-bold text-white leading-tight truncate">Withdraw Profit</h2>
                                        <p className="text-xs lg:text-sm text-amber-400/80 font-bold mt-0.5">Available: {currentBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} Tokens</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                                    <X className="w-5 h-5 lg:w-6 lg:h-6 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 lg:p-8 space-y-6">
                            {step === 1 ? (
                                <div className="text-center py-2 lg:py-4 space-y-6">
                                    <div className="space-y-2">
                                        <p className="text-lg font-bold text-white">Connect Admin Wallet</p>
                                        <p className="text-xs lg:text-sm text-gray-500 max-w-[280px] mx-auto">
                                            Only the authorized Fee Collector can withdraw network profits.
                                        </p>
                                    </div>
                                    
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] font-mono text-[9px] lg:text-[10px] text-gray-500 max-w-full truncate">
                                            <span className="opacity-50">REQUIRED:</span> {collectorWallet}
                                        </div>
                                        <div className="scale-105 lg:scale-110">
                                            <WalletMultiButton />
                                        </div>
                                        {connected && (
                                            <Button 
                                                variant="outline" 
                                                onClick={() => setStep(2)}
                                                className="mt-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10 font-bold"
                                            >
                                                Continue Withdrawal
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {publicKey?.toBase58() !== collectorWallet && (
                                        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col gap-3">
                                            <div className="flex gap-3 text-red-400 text-sm">
                                                <ShieldCheck className="w-5 h-5 shrink-0" />
                                                <p>Connected wallet does not match the on-chain collector. Please switch to <span className="font-mono font-bold">{collectorWallet.slice(0, 8)}...</span></p>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={() => {
                                                    onClose();
                                                    onOpenConfig();
                                                }}
                                                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs py-1 h-auto"
                                            >
                                                Update System Config to this Wallet
                                            </Button>
                                        </div>
                                    )}

                                    <div className="space-y-5">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider ml-1">Destination Address</label>
                                            <Input 
                                                placeholder="Paste Solana Wallet Address"
                                                value={destination}
                                                onChange={(e) => setDestination(e.target.value)}
                                                className="bg-white/5 border-white/10 py-5 lg:py-6 text-sm lg:text-base text-white font-medium"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider ml-1">Tokens to Withdraw</label>
                                            <div className="relative">
                                                <Input 
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    className="bg-white/5 border-white/10 py-5 lg:py-6 text-xl lg:text-2xl font-bold text-white uppercase"
                                                />
                                                <button 
                                                    onClick={() => setAmount(currentBalance.toString())}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-amber-500/10 text-amber-500 text-[10px] font-black rounded-lg hover:bg-amber-500/20 transition-all border border-amber-500/20"
                                                >
                                                    MAX
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleWithdraw}
                                        disabled={isLoading || publicKey?.toBase58() !== collectorWallet || !amount || Number(amount) <= 0}
                                        className="w-full py-8 text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-[0_10px_30px_-10px_rgba(245,158,11,0.4)] transition-all active:scale-[0.98]"
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                Processing Transfer...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                Confirm Withdrawal
                                                <ArrowRight className="w-5 h-5" />
                                            </div>
                                        )
                                        }
                                    </Button>
                                    
                                    <button 
                                        onClick={() => {
                                            setHasManuallySwitched(true);
                                            setStep(1);
                                        }}
                                        className="w-full text-center text-xs text-gray-500 hover:text-gray-400 transition-colors"
                                    >
                                        &larr; Switch Wallet
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-4 bg-white/5 border-t border-white/5 text-center">
                            <a 
                                href={`https://explorer.solana.com/address/${collectorWallet}?cluster=devnet`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-amber-400 transition-colors inline-flex items-center gap-1.5"
                            >
                                View On-Chain Assets <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
