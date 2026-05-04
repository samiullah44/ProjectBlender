import React, { useState } from 'react';

// ─── Logo Option 1: Node Network Mark ────────────────────────────────────────
const LogoNodeNetwork = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="nn-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
    </defs>
    {/* Background rounded square */}
    <rect width="40" height="40" rx="10" fill="url(#nn-grad)" />
    {/* Node dots */}
    <circle cx="20" cy="8"  r="3" fill="white" fillOpacity="1" />
    <circle cx="8"  cy="28" r="3" fill="white" fillOpacity="0.85" />
    <circle cx="32" cy="28" r="3" fill="white" fillOpacity="0.85" />
    <circle cx="20" cy="22" r="2.5" fill="white" fillOpacity="0.6" />
    {/* Connecting lines */}
    <line x1="20" y1="8"  x2="8"  y2="28" stroke="white" strokeOpacity="0.4" strokeWidth="1.2" />
    <line x1="20" y1="8"  x2="32" y2="28" stroke="white" strokeOpacity="0.4" strokeWidth="1.2" />
    <line x1="8"  y1="28" x2="32" y2="28" stroke="white" strokeOpacity="0.4" strokeWidth="1.2" />
    <line x1="20" y1="8"  x2="20" y2="22" stroke="white" strokeOpacity="0.5" strokeWidth="1.2" />
    <line x1="20" y1="22" x2="8"  y2="28" stroke="white" strokeOpacity="0.3" strokeWidth="1" />
    <line x1="20" y1="22" x2="32" y2="28" stroke="white" strokeOpacity="0.3" strokeWidth="1" />
  </svg>
);

// ─── Logo Option 2: Isometric Render Cube ────────────────────────────────────
const LogoRenderCube = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cube-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="10" fill="url(#cube-bg)" />
    {/* Top face */}
    <polygon points="20,7 32,13 20,19 8,13" fill="white" fillOpacity="0.95" />
    {/* Left face */}
    <polygon points="8,13 20,19 20,33 8,27" fill="white" fillOpacity="0.5" />
    {/* Right face */}
    <polygon points="32,13 20,19 20,33 32,27" fill="white" fillOpacity="0.7" />
    {/* Inner glow dot */}
    <circle cx="20" cy="19" r="2" fill="#7C3AED" fillOpacity="0.6" />
  </svg>
);

// ─── Logo Option 3: Stacked GPU Layers ───────────────────────────────────────
const LogoGPUStack = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gpu-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="10" fill="url(#gpu-bg)" />
    {/* Three stacked bars with offsets */}
    <rect x="7"  y="10" width="26" height="5" rx="2.5" fill="white" fillOpacity="0.95" />
    <rect x="10" y="18" width="22" height="5" rx="2.5" fill="white" fillOpacity="0.7" />
    <rect x="13" y="26" width="18" height="5" rx="2.5" fill="white" fillOpacity="0.45" />
  </svg>
);

// ─── Logo Option 4: R Monogram with Node ─────────────────────────────────────
const LogoRMonogram = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="r-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
      <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#C4B5FD" />
        <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="40" height="40" rx="10" fill="url(#r-bg)" />
    {/* Bold R letterform */}
    <path
      d="M11 9 L11 31 M11 9 L22 9 C26 9 28 11 28 15 C28 19 26 21 22 21 L11 21 M20 21 L28 31"
      stroke="white"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Node dot at end of leg */}
    <circle cx="28" cy="31" r="3.5" fill="white" fillOpacity="0.9" />
    <circle cx="28" cy="31" r="5.5" fill="url(#node-glow)" />
  </svg>
);

// ─── Logo Option 5: Orbital Ring ─────────────────────────────────────────────
const LogoOrbital = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="orb-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="10" fill="url(#orb-bg)" />
    {/* Outer ring */}
    <circle cx="20" cy="20" r="12" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
    {/* Inner ring */}
    <circle cx="20" cy="20" r="7" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" fill="none" />
    {/* Center core */}
    <circle cx="20" cy="20" r="3" fill="white" fillOpacity="0.95" />
    {/* Orbiting node */}
    <circle cx="32" cy="20" r="2.5" fill="white" fillOpacity="0.9" />
    {/* Connector line */}
    <line x1="20" y1="20" x2="32" y2="20" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 2" />
  </svg>
);

// ─── Wordmark component ───────────────────────────────────────────────────────
const Wordmark = ({ dark = false }: { dark?: boolean }) => (
  <div className="flex flex-col">
    <span className={`font-extrabold text-xl tracking-tight leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>
      RenderOnNodes
    </span>
    <span className={`text-[8px] font-black tracking-[0.25em] uppercase mt-0.5 ${dark ? 'text-purple-300' : 'text-purple-500'}`}>
      DISTRIBUTED RENDERING
    </span>
  </div>
);

// ─── Preview Card ─────────────────────────────────────────────────────────────
const PreviewCard = ({
  label,
  description,
  icon: Icon,
  recommended,
}: {
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  recommended?: boolean;
}) => (
  <div className={`relative rounded-3xl border-2 p-8 flex flex-col gap-8 ${recommended ? 'border-purple-400 shadow-[0_0_40px_rgba(124,58,237,0.15)]' : 'border-gray-100'}`}>
    {recommended && (
      <span className="absolute -top-3 left-6 bg-purple-600 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full">
        Recommended
      </span>
    )}

    {/* Light background */}
    <div className="bg-gray-50 rounded-2xl p-8 flex items-center justify-center gap-4">
      <Icon size={48} />
      <Wordmark />
    </div>

    {/* Dark background */}
    <div className="bg-gray-900 rounded-2xl p-8 flex items-center justify-center gap-4">
      <Icon size={48} />
      <Wordmark dark />
    </div>

    {/* Icon only sizes */}
    <div className="flex items-center gap-4 flex-wrap">
      <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-center">
        <Icon size={64} />
      </div>
      <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-center">
        <Icon size={40} />
      </div>
      <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-center">
        <Icon size={24} />
      </div>
      <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-center">
        <Icon size={16} />
      </div>
      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">64 · 40 · 24 · 16px</span>
    </div>

    <div>
      <h3 className="font-black text-gray-900 text-lg mb-1">{label}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  </div>
);

// ─── Main Preview Page ────────────────────────────────────────────────────────
export const LogoPreview = () => {
  const logos = [
    {
      label: 'Option 1 — Node Network',
      description: 'Three connected nodes forming a triangle with a central hub. Communicates distributed computing and network topology. Clean and geometric.',
      icon: LogoNodeNetwork,
    },
    {
      label: 'Option 2 — Isometric Cube',
      description: 'An isometric 3D cube with three visible faces. Directly references 3D rendering and ties into the hero graphic visual language. Strong brand recall.',
      icon: LogoRenderCube,
      recommended: true,
    },
    {
      label: 'Option 3 — GPU Stack',
      description: 'Three stacked horizontal bars with progressive offsets, representing GPU layers or render passes. Minimal and scales perfectly to any size.',
      icon: LogoGPUStack,
    },
    {
      label: 'Option 4 — R Monogram',
      description: 'A bold geometric "R" where the descending leg terminates in a glowing node dot. Unique, memorable, and works as a standalone brand mark.',
      icon: LogoRMonogram,
      recommended: true,
    },
    {
      label: 'Option 5 — Orbital Ring',
      description: 'Concentric rings with a central core and an orbiting node. Communicates distributed/cloud compute with a clean, modern aesthetic.',
      icon: LogoOrbital,
    },
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-purple-600" />
            <span className="text-[11px] font-black tracking-[0.4em] text-purple-600 uppercase">Logo Concepts</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-gray-900 mb-4">RenderOnNodes<br />Logo Preview</h1>
          <p className="text-gray-500 text-lg max-w-xl leading-relaxed">
            Five logo directions, each shown on light and dark backgrounds at multiple sizes. Pick your favourite and we'll refine and implement it.
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {logos.map((logo) => (
            <PreviewCard key={logo.label} {...logo} />
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-gray-400 font-medium">
          All logos are built as pure SVG — no external assets needed. Tell me which one you like and I'll integrate it across the site.
        </p>
      </div>
    </div>
  );
};

export default LogoPreview;
