import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

interface TopBarProps {
  isVisible: boolean;
  onReopen: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ isVisible, onReopen }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-indigo-600 w-full overflow-hidden select-none"
        >
          <div className="container mx-auto px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-center sm:text-left">
            <span className="text-indigo-100 text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-emerald-300" />
              We're building a high-performance render network.
            </span>
            <button
              onClick={onReopen}
              className="text-white text-sm font-bold bg-white/10 hover:bg-white/20 transition-colors px-3 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap"
            >
              Join the Waitlist
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TopBar;
