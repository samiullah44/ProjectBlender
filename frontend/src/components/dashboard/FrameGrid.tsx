import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import SmartImage from '../ui/SmartImage';

interface FrameGridProps {
  totalFrames: number;
  renderedFrames: number[] | number;
  failedFrames: number[] | number;
  assignedFrames: number[] | number;
  startFrame: number;
  frameImages?: Record<number, string>;
  /** Frames that had previously been rendered but are being re-queued for rendering again */
  rerenderedFrames?: number[];
  rerenderedHistory?: number[];
}

const FrameGrid: React.FC<FrameGridProps> = ({
  totalFrames,
  renderedFrames,
  failedFrames,
  assignedFrames,
  startFrame,
  frameImages = {},
  rerenderedFrames = [],
  rerenderedHistory = []
}) => {
  // Limit the grid size to prevent UI lag on very large jobs
  const maxVisibleFrames = 1000; // Increased limit for better breakdown
  const isLargeJob = totalFrames > maxVisibleFrames;
  const displayTotal = isLargeJob ? maxVisibleFrames : totalFrames;

  const frames = useMemo(() => {
    const items = [];
    
    // Helper to handle both arrays and counts
    const toSet = (input: number[] | number | any) => {
      if (Array.isArray(input)) return new Set(input);
      if (typeof input === 'number' && input > 0) {
        return new Set(Array.from({ length: input }, (_, i) => startFrame + i));
      }
      return new Set();
    };

    const renderedSet = toSet(renderedFrames);
    const failedSet = toSet(failedFrames);
    const assignedSet = toSet(assignedFrames);
    const rerenderedSet = new Set(rerenderedFrames);
    const historySet = toSet(rerenderedHistory);
    
    // Also include frames that have images in the rendered set
    Object.keys(frameImages).forEach(frameNumStr => {
      renderedSet.add(parseInt(frameNumStr));
    });

    for (let i = 0; i < displayTotal; i++) {
        const frameNum = startFrame + i;
        let status: 'waiting' | 'processing' | 'done' | 'failed' | 'rerendering' = 'waiting';
        
        if (assignedSet.has(frameNum)) {
          // If this assigned frame was previously rendered, it's a re-render
          status = rerenderedSet.has(frameNum) ? 'rerendering' : 'processing';
        }
        else if (renderedSet.has(frameNum)) status = 'done';
        else if (failedSet.has(frameNum)) status = 'failed';
        
        items.push({ num: frameNum, status, isRerendered: historySet.has(frameNum) });
    }
    return items;
  }, [displayTotal, renderedFrames, failedFrames, assignedFrames, rerenderedFrames, rerenderedHistory, startFrame, frameImages]);

  // Container variants for staggered animation
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.002
      }
    }
  };

  const item = {
    hidden: { scale: 0, opacity: 0 },
    show: { scale: 1, opacity: 1 }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Network Render Grid</span>
            <div className={`w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse`} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-medium text-gray-500">
           <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-[2px] bg-gray-800 border border-white/5" /> Waiting</div>
           <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-[2px] bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" /> Active</div>
           <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-[2px] bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" /> Re-Rendering</div>
           <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Done</div>
           <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> Failed</div>
        </div>
      </div>
      
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-[repeat(auto-fill,minmax(18px,1fr))] gap-1.5 p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl shadow-2xl relative"
      >
        {/* Abstract background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/5 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/5 blur-[100px] pointer-events-none" />

        {frames.map((frame) => (
          <motion.div
            key={frame.num}
            variants={item}
            className="relative group/frame mr-0.5 mb-0.5"
          >
            <motion.div
              layout
              animate={{
                scale: frame.status === 'processing' || frame.status === 'rerendering' ? [1, 1.15, 1] : 1,
                backgroundColor: 
                  frame.status === 'done' ? '#10b981' : 
                  frame.status === 'failed' ? '#ef4444' : 
                  frame.status === 'processing' ? '#3b82f6' : 
                  frame.status === 'rerendering' ? '#f59e0b' :
                  '#1f2937',
                boxShadow: 
                  frame.status === 'processing' ? '0 0 12px rgba(59, 130, 246, 0.6)' :
                  frame.status === 'rerendering' ? '0 0 12px rgba(245, 158, 11, 0.7)' :
                  frame.status === 'done' ? '0 0 4px rgba(16, 185, 129, 0.2)' : 'none'
              }}
              transition={{
                scale: { repeat: Infinity, duration: frame.status === 'rerendering' ? 1.2 : 2, ease: "easeInOut" },
                backgroundColor: { duration: 0.4 }
              }}
              className="w-[18px] h-[18px] rounded-[3px] cursor-crosshair border border-white/5 relative z-10 flex items-center justify-center overflow-hidden"
            >
              {frame.status === 'done' && frame.isRerendered && (
                <span className="text-[10px] text-white/90 leading-none select-none font-bold">↻</span>
              )}
            </motion.div>
            
            {/* Hover Tooltip/Preview */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover/frame:opacity-100 transition-all duration-300 pointer-events-none z-[999] translate-y-2 group-hover/frame:translate-y-0">
              <div className="bg-gray-950 border border-white/20 rounded-xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl min-w-[140px] border-b-0">
                {frame.status === 'done' && frameImages[frame.num] ? (
                  <div className="w-40 aspect-video bg-black relative">
                    <SmartImage 
                      src={frameImages[frame.num]} 
                      alt={`Frame ${frame.num}`} 
                      className="w-full h-full object-cover"
                      loading="eager"
                      onError={(e) => {
                        console.error('Hover preview error:', e);
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                  </div>
                ) : (
                  <div className="p-4 text-center bg-white/[0.02]">
                    <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center bg-white/5 border border-white/10`}>
                       <span className={`w-2.5 h-2.5 rounded-full ${
                         frame.status === 'processing' ? 'bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.6)]' : 
                         frame.status === 'rerendering' ? 'bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.7)]' :
                         frame.status === 'done' ? 'bg-emerald-500' :
                         frame.status === 'failed' ? 'bg-red-500' : 'bg-gray-600'
                       }`} />
                    </div>
                  </div>
                )}
                <div className="px-4 py-2.5 bg-[#0a0a0a] border-t border-white/5">
                  <div className="text-[11px] font-bold text-gray-400 flex justify-between items-center gap-6">
                    <span className="text-white tracking-widest">#{String(frame.num).padStart(3, '0')}</span>
                    <span className={`text-[10px] font-black ${
                      frame.status === 'done' ? 'text-emerald-400' :
                      frame.status === 'processing' ? 'text-blue-400' :
                      frame.status === 'rerendering' ? 'text-amber-400' :
                      frame.status === 'failed' ? 'text-red-400' : 'text-gray-500'
                    }`}>{frame.status === 'rerendering' ? 'RE-RENDER' : frame.status.toUpperCase()}</span>
                  </div>
                </div>
              </div>
              {/* Arrow */}
              <div className="w-3 h-3 bg-[#0a0a0a] border-r border-b border-white/20 rotate-45 mx-auto -mt-1.5" />
            </div>
          </motion.div>
        ))}
      </motion.div>
      
      {isLargeJob && (
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-white/5 py-2 rounded-lg border border-white/5">
           <span className="w-1 h-1 rounded-full bg-gray-700" />
           Visualizing first {maxVisibleFrames} frames
           <span className="w-1 h-1 rounded-full bg-gray-700" />
        </div>
      )}
    </div>
  );
};

export default FrameGrid;
