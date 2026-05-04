import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';

// Interfaces for CoinGecko response
interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  sparkline_in_7d: {
    price: number[];
  };
}

// Map from ID to custom colors for the sparklines
const CHART_COLORS: Record<string, { stroke: string; fill: string; dot: string }> = {
  bitcoin: { stroke: '#F7931A', fill: 'url(#gradient-btc)', dot: 'bg-[#F7931A]' },
  ethereum: { stroke: '#627EEA', fill: 'url(#gradient-eth)', dot: 'bg-[#627EEA]' },
  solana: { stroke: '#14F195', fill: 'url(#gradient-sol)', dot: 'bg-[#14F195]' },
  hyperliquid: { stroke: '#00C2FF', fill: 'url(#gradient-hype)', dot: 'bg-[#00C2FF]' },
};

const COIN_IDS = 'bitcoin,ethereum,solana,hyperliquid';

const LOCAL_STORAGE_KEY = 'crypto_market_cache_v2';

const fetchCryptoData = async (): Promise<CoinData[]> => {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&sparkline=true&price_change_percentage=24h`);
    
    if (!res.ok) {
      throw new Error(`API Error: ${res.status}`);
    }
    
    const data = await res.json();
    // Save successful fetch to cache
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    return data;
  } catch (error) {
    // If API fails (e.g. rate limit), try to fallback to localStorage cache
    const cachedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cachedData) {
      console.warn('Crypto API limit reached or network error. Showing cached data.');
      return JSON.parse(cachedData);
    }
    // If no cache exists yet, we have to throw the error to show the error UI
    throw error;
  }
};


const Sparkline = ({ prices, id }: { prices: number[]; id: string }) => {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  // Box dimensions
  const width = 160;
  const height = 40;

  // Generate SVG path points
  const points = prices.map((price, index) => {
    const x = (index / (prices.length - 1)) * width;
    const y = height - ((price - min) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;
  const strokeD = `M ${points.join(' L ')}`;

  const colors = CHART_COLORS[id] || { stroke: '#888', fill: 'transparent' };

  return (
    <svg width="100%" height="40" viewBox={`0 -5 ${width} 50`} preserveAspectRatio="none" className="overflow-visible mt-4">
      <defs>
        <linearGradient id={`gradient-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.stroke} stopOpacity="0.15" />
          <stop offset="100%" stopColor={colors.stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathD} fill={colors.fill} />
      <path d={strokeD} fill="none" stroke={colors.stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export const CryptoWidget = () => {
  const { data: coins, isLoading, isError, refetch } = useQuery({
    queryKey: ['cryptoMarket'],
    queryFn: fetchCryptoData,
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <div className="w-full bg-white rounded-3xl border border-gray-100 shadow-[0_12px_40px_rgba(0,0,0,0.03)] px-6 py-4 mb-16 relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-black tracking-[0.1em] text-[#7C3AED] uppercase">Crypto Market Snapshot</h3>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full border border-green-100">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold tracking-wider text-green-600 uppercase">Live</span>
          </div>
        </div>
        <a
          href="https://www.coingecko.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-500 hover:text-indigo-600 uppercase tracking-widest transition-colors"
        >
          View all markets
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Grid of Coins */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading && (
          // Skeletons
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse flex flex-col p-4 rounded-2xl border border-gray-100 bg-gray-50 h-[120px]" />
          ))
        )}

        {isError && !isLoading && (
          <div className="col-span-full py-6 text-center text-sm text-red-500 font-medium">
            Could not load market data. <button onClick={() => refetch()} className="underline">Retry</button>
          </div>
        )}

        {coins && coins.map((coin, index) => {
          const isUp = coin.price_change_percentage_24h >= 0;
          return (
            <motion.div
              key={coin.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col p-4 rounded-2xl border border-gray-100/80 bg-white hover:border-gray-200 hover:shadow-sm transition-all min-w-0"
            >
              {/* Token header */}
              <div className="flex items-center gap-2.5 mb-2">
                <img src={coin.image} alt={coin.name} className="w-7 h-7 rounded-full shadow-sm bg-gray-50 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-gray-900 truncate">{coin.name}</span>
                  <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">{coin.symbol}</span>
                </div>
              </div>

              {/* Price and 24h change */}
              <div className="flex items-end justify-between z-10 relative">
                <span className="text-base font-black tracking-tight text-gray-900">
                  ${coin.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={cn(
                  "text-[10px] font-bold tracking-wider shrink-0 ml-1",
                  isUp ? "text-green-500" : "text-red-500"
                )}>
                  {isUp ? '+' : ''}{coin.price_change_percentage_24h.toFixed(2)}%
                </span>
              </div>

              {/* Sparkline */}
              <div className="relative -mx-2 -mb-2 opacity-80 z-0">
                <Sparkline prices={coin.sparkline_in_7d?.price || []} id={coin.id} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer text */}
      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-1.5">
        <RefreshCcw className="w-3.5 h-3.5 text-gray-300" />
        <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Prices update in real-time</span>
      </div>
    </div>
  );
};
