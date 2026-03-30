import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { X, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'react-hot-toast';
import { useRenderNetwork } from '@/hooks/useRenderNetwork';
import { useAuthStore } from '@/stores/authStore';

export const DepositModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { connected } = useWallet();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const { depositToAccount, fetchCreditBalance, pdaAddress } = useRenderNetwork();
  const { getProfile } = useAuthStore();

  // Track the 'connected' state to detect a new connection
  const [prevConnected, setPrevConnected] = useState(connected);
  
  useEffect(() => {
    if (connected && !prevConnected && step === 1) {
      const timer = setTimeout(() => {
        setStep(2);
      }, 600);
      return () => clearTimeout(timer);
    }
    setPrevConnected(connected);
  }, [connected, step, prevConnected]);

  useEffect(() => {
    const handleOpen = () => {
      setStep(1);
      setIsOpen(true);
    };
    window.addEventListener('open-deposit-modal', handleOpen);
    return () => window.removeEventListener('open-deposit-modal', handleOpen);
  }, []);

  const handleDeposit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      toast.success('Initiating deposit transaction...');
      
      const { tx, pdaDepositAta } = await depositToAccount(parseFloat(amount));
      
      // Sync with backend database
      try {
        await axiosInstance.post('/auth/sync-deposit', {
          depositTokenAddress: pdaDepositAta,
          amount: parseFloat(amount)
        });
        
        // Refresh the user profile to update the database balance (tokenBalance) in the store
        await getProfile();
      } catch (syncError) {
        console.error('Failed to sync with backend:', syncError);
        // We don't block the UI here since the on-chain tx succeeded
      }

      toast.success(`Successfully deposited ${amount} mRNDR! Confirmation: ${tx.slice(0, 8)}...`);
      
      // Delay for 2 seconds to allow the Solana RPC node to propagate the updated state
      // before we fetch the new balance, otherwise it might fetch the old cached balance.
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await fetchCreditBalance(); // Refresh local balance instance
      window.dispatchEvent(new Event('refresh_credit_balance')); // Refresh navbar balance
      
      setIsOpen(false);
      setAmount('');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Deposit failed. Do you have enough mRNDR?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Deposit Tokens</h2>
                  <p className="text-sm text-gray-400">Add mRNDR to your Website Balance</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 min-h-[250px] flex flex-col justify-center">
              {step === 1 ? (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col items-center justify-center py-6 text-center space-y-6"
                >
                  <p className="text-gray-300 font-medium text-lg">
                    Step 1: Connect Your Wallet
                  </p>
                  <p className="text-gray-400 text-sm">
                    Select the Solana wallet you want to deposit from.
                  </p>
                  <div className="wallet-adapter-wrapper scale-110 mt-4">
                    <WalletMultiButton />
                  </div>
                  {connected && (
                    <div className="flex flex-col gap-2 w-full mt-4">
                      <Button 
                        onClick={() => setStep(2)}
                        className="w-full bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 font-bold"
                      >
                        Continue to Deposit &rarr;
                      </Button>
                      <p className="text-[10px] text-gray-500 italic">
                        Wallet already connected. Click "Continue" or use the button above to switch.
                      </p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-semibold text-gray-300">Step 2: Enter Amount</p>
                    <button 
                      onClick={() => setStep(1)}
                      className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
                    >
                      &larr; Switch Wallet
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Amount (mRNDR)</label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-4 pr-16 py-6 text-lg bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                        disabled={isLoading}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-emerald-400">
                        MAX
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleDeposit}
                    disabled={isLoading || !amount || Number(amount) <= 0}
                    className="w-full py-6 text-base font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 transition-all duration-300 shadow-lg shadow-emerald-500/20 mt-4"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                        Confirm in Phantom...
                      </>
                    ) : (
                      'Deposit to Balance'
                    )}
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
