import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, Zap, ArrowRight, DollarSign, Cpu, Loader2, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { toast } from 'react-hot-toast';
import { analytics } from '@/services/analytics';

const GPU_DATA = [
  { model: 'Ultra-High End (4090/3090)', score: 'Maximum', power: '100', tier: 'Tier 1 Alpha', color: 'from-emerald-400 to-cyan-400' },
  { model: 'Performance Tier (4070/3080)', score: 'High', power: '82', tier: 'Tier 1 Bravo', color: 'from-blue-400 to-indigo-400' },
  { model: 'Mid-Range (3060/20-Series)', score: 'Standard', power: '65', tier: 'Tier 2 Alpha', color: 'from-purple-400 to-pink-400' },
  { model: 'Entry-Level (1660/10-Series)', score: 'Entry', power: '48', tier: 'Tier 3 Alpha', color: 'from-orange-400 to-red-400' },
  { model: 'Workstation / Apple Silicon', score: 'Optimized', power: '70', tier: 'Tier 2 Bravo', color: 'from-gray-400 to-slate-400' },
];

const IncomeCalculator: React.FC = () => {
  const [selectedGpu, setSelectedGpu] = useState(GPU_DATA[0]);
  const [gpuCount, setGpuCount] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleGpuSelect = (gpu: typeof GPU_DATA[0]) => {
    setIsAnalyzing(true);
    setSelectedGpu(gpu);
    setTimeout(() => setIsAnalyzing(false), 600);
  };

  const handleUnlockReport = () => {
    analytics.trackClick('income_calculator_unlock_report', { gpu: selectedGpu.model, count: gpuCount });
    toast.success('Monetization reports are coming soon for Priority Beta members!', {
      icon: '🚀',
      duration: 4000
    });
    window.dispatchEvent(new Event('open-waitlist'));
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
      <div className="grid md:grid-cols-2">
        {/* Left: Inputs */}
        <div className="p-8 sm:p-10 bg-white/5">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Monetization Scan</h3>
          </div>

          <div className="space-y-8">
            {/* GPU Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
                Select Your Hardware
              </label>
              <div className="grid grid-cols-1 gap-2">
                {GPU_DATA.map((gpu) => (
                  <button
                    key={gpu.model}
                    onClick={() => handleGpuSelect(gpu)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      selectedGpu.model === gpu.model
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                        : 'bg-black/20 border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Cpu className={`w-4 h-4 ${selectedGpu.model === gpu.model ? 'text-emerald-400' : ''}`} />
                      {gpu.model}
                    </span>
                    {selectedGpu.model === gpu.model && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                  </button>
                ))}
              </div>
            </div>

            {/* GPU Count Slider */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                  Active Units
                </label>
                <span className="text-2xl font-black text-white">{gpuCount}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={gpuCount}
                onChange={(e) => setGpuCount(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Background Decorative Glow */}
          <div className={`absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br ${selectedGpu.color} opacity-10 blur-[80px] rounded-full`} />
          
          <div className="relative z-10">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-2">Network Earning Potential</p>
            
            <AnimatePresence mode="wait">
              {isAnalyzing ? (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-6"
                >
                  <div className="flex items-center gap-3 text-emerald-400 font-bold text-xl">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Analyzing Rig...
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-1"
                >
                  <div className="text-7xl font-black text-white tracking-tighter uppercase italic">
                    {selectedGpu.score}
                  </div>
                  <div className="inline-flex items-center px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-bold text-emerald-400 uppercase tracking-widest">
                    {selectedGpu.tier}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Hardware Score</div>
                <div className="text-xl font-bold text-white">{selectedGpu.power}%</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Network Priority</div>
                <div className="text-xl font-bold text-white">Elite</div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                Eligible for early provider rewards
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-10">
            <Button 
              size="lg"
              className="w-full bg-white text-black hover:bg-gray-200 font-bold py-6 text-lg rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all group"
              onClick={handleUnlockReport}
            >
              Unlock My Full Earning Report
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <p className="text-center text-[10px] text-indigo-400 mt-4 uppercase tracking-[0.2em] font-black animate-pulse">
              * Reports Launching in Q1 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomeCalculator;
