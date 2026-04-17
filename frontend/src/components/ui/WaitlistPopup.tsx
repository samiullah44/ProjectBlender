import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { axiosInstance } from '@/lib/axios';
import { analytics } from '@/services/analytics';

interface WaitlistPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: () => void;
}

const WaitlistPopup: React.FC<WaitlistPopupProps> = ({ isOpen, onClose, onSubscribe }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [role, setRole] = useState<'artist' | 'provider' | null>(null);
  
  // Progress counter - start at 423 + real subscribers
  // We use localStorage as a fallback to remember "personal" increments before DB is updated
  const [slotsTaken, setSlotsTaken] = useState(() => {
    const saved = localStorage.getItem('waitlist_slots_taken_display');
    return saved ? parseInt(saved, 10) : 423;
  });

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await axiosInstance.get('/newsletter/count');
        if (response.data.success) {
          const currentTotal = 423 + (response.data.count || 0);
          setSlotsTaken(currentTotal);
          localStorage.setItem('waitlist_slots_taken_display', currentTotal.toString());
        }
      } catch (error) {
        console.error('Failed to fetch newsletter count:', error);
      }
    };
    
    if (isOpen) {
      fetchCount();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (!role) {
      toast.error('Please select your primary interest.');
      return;
    }

    const subscribedEmail = localStorage.getItem('waitlist_email');
    if (email === subscribedEmail) {
      toast.success('Email is already subscribed.');
      return;
    }

    setLoading(true);

    try {
      analytics.trackClick('waitlist_submit', { role });
      const response = await axiosInstance.post('/newsletter/subscribe', {
        email, 
        role 
      });

      setSuccess(true);
      toast.success(response.data?.message || 'Successfully joined the waitlist!');
      
      // Update slots live
      const newSlots = slotsTaken + 1;
      setSlotsTaken(newSlots);
      localStorage.setItem('waitlist_slots_taken_display', newSlots.toString());
      
      localStorage.setItem('waitlist_email', email);
      onSubscribe(); // Update parent state / localStorage

      // Auto close after success
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setEmail('');
        setRole(null);
      }, 3000);
    } catch (error: any) {
      console.error('Waitlist subscription error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to join waitlist. Please try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Popup Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-[#0B0F19] border border-white/10 shadow-2xl rounded-2xl overflow-hidden pointer-events-auto relative"
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-10"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Decorative top gradient */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

              <div className="p-8 sm:p-10">
                {success ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center text-center py-6"
                  >
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                      <Sparkles className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">You're on the list!</h3>
                    <p className="text-gray-400">
                      We've tagged you as a <strong>{role === 'artist' ? '3D Artist' : 'Node Provider'}</strong>. Keep an eye on your inbox!
                    </p>
                  </motion.div>
                ) : (
                  <div className="flex flex-col text-center">
                    <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-6 mx-auto">
                      <Sparkles className="w-3.5 h-3.5 mr-2" />
                      Join 1,420+ in Queue
                    </div>

                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">
                      Reinventing <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">Distributed Rendering</span>
                    </h2>

                    <p className="text-gray-400 mb-6 leading-relaxed">
                      Get 10x faster renders or monetize your idle GPU. Join the waitlist for exclusive early-bird perks.
                    </p>

                    {/* Role Selection */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <button
                        type="button"
                        onClick={() => setRole('artist')}
                        className={`p-3 rounded-xl border transition-all text-sm font-medium ${
                          role === 'artist'
                            ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        I'm an Artist
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('provider')}
                        className={`p-3 rounded-xl border transition-all text-sm font-medium ${
                          role === 'provider'
                            ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        I'm a GPU Owner
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                      <div className="relative">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-base"
                          required
                          disabled={loading}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white rounded-xl px-4 py-4 font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {loading ? (
                          <Loader2 className="w-6 h-6 text-indigo-200 animate-spin" />
                        ) : (
                          <>
                            Get Early Access
                            <ArrowRight className="w-5 h-5 ml-1" />
                          </>
                        )}
                      </button>
                    </form>

                    {/* Urgency indicator */}
                    <div className="mt-8 pt-6 border-t border-white/5">
                      <div className="flex justify-between text-[11px] uppercase tracking-widest text-white mb-2 font-black px-1">
                        <span className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Priority Beta Access
                        </span>
                        <span className="text-indigo-400">{slotsTaken} / 1,000 Slots Secured</span>
                      </div>
                      <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(slotsTaken / 1000) * 100}%` }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                        />
                      </div>
                      <p className="text-[9px] text-gray-500 mt-2 text-center uppercase tracking-widest font-medium">
                        Real-time synchronization active
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
};

export default WaitlistPopup;
