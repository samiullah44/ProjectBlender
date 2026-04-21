import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onComplete: () => void;
}

type Phase = 'idle' | 'broadcast' | 'distribute' | 'converge' | 'dissolve' | 'done';

interface Node {
  x: number;
  y: number;
  size: number;
  color: string;
  active: boolean;
  activatedAt: number;
  cluster: number;
}

interface Connection {
  from: number;
  to: number;
  alpha: number;
  activatedAt: number;
}

const COLORS = {
  idle: '#475569',
  active: '#6366f1',
  hot: '#a78bfa',
  beam: '#34d399',
};

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const nodes = useRef<Node[]>([]);
  const connections = useRef<Connection[]>([]);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    // ── 1. Generate idle network nodes ────────────────────────
    const nodeCount = Math.min(Math.floor((W * H) / 15000), 80);
    const margin = 60;
    nodes.current = Array.from({ length: nodeCount }, (_, i) => ({
      x: margin + Math.random() * (W - margin * 2),
      y: margin + Math.random() * (H - margin * 2),
      size: 2 + Math.random() * 2,
      color: COLORS.idle,
      active: false,
      activatedAt: 0,
      cluster: Math.floor(Math.random() * 5),
    }));

    // ── 2. Phase timeline ──────────────────────────────────────
    const t1 = setTimeout(() => { phaseRef.current = 'broadcast'; }, 800);
    const t2 = setTimeout(() => { phaseRef.current = 'distribute'; }, 1500);
    const t3 = setTimeout(() => { phaseRef.current = 'converge'; setShowText(true); }, 2300);
    const t4 = setTimeout(() => { phaseRef.current = 'dissolve'; }, 4300); // 2s hold
    const t5 = setTimeout(() => { phaseRef.current = 'done'; onComplete(); }, 5200);

    // ── 3. Render loop ─────────────────────────────────────────
    let broadcastRadius = 0;
    let convergeProgress = 0;
    let dissolveProgress = 0;

    const draw = () => {
      timeRef.current += 16;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, W, H);

      const phase = phaseRef.current;
      const centerX = W / 2;
      const centerY = H / 2;

      // ── PHASE: broadcast ─────────────────────────────────────
      if (phase === 'broadcast') {
        broadcastRadius += 8;
        // Activate nodes as wave passes them
        nodes.current.forEach((n) => {
          const dist = Math.hypot(n.x - centerX, n.y - centerY);
          if (dist < broadcastRadius && !n.active) {
            n.active = true;
            n.activatedAt = timeRef.current;
          }
        });
      }

      // ── PHASE: distribute ────────────────────────────────────
      if (phase === 'distribute') {
        // Build connections between nearby active nodes
        if (connections.current.length < 120) {
          nodes.current.forEach((n, i) => {
            if (!n.active) return;
            const nearby = nodes.current
              .map((m, j) => ({ node: m, idx: j, dist: Math.hypot(m.x - n.x, m.y - n.y) }))
              .filter((m) => m.node.active && m.idx !== i && m.dist < 180)
              .sort((a, b) => a.dist - b.dist)
              .slice(0, 2);

            nearby.forEach((m) => {
              const exists = connections.current.some(
                (c) => (c.from === i && c.to === m.idx) || (c.from === m.idx && c.to === i)
              );
              if (!exists) {
                connections.current.push({
                  from: i,
                  to: m.idx,
                  alpha: 0,
                  activatedAt: timeRef.current,
                });
              }
            });
          });
        }
        // Fade in connections
        connections.current.forEach((c) => {
          if (c.alpha < 0.4) c.alpha += 0.015;
        });
      }

      // ── PHASE: converge ──────────────────────────────────────
      if (phase === 'converge') {
        convergeProgress += 0.012;
        const ease = Math.min(convergeProgress, 1);
        nodes.current.forEach((n) => {
          if (!n.active) return;
          const targetX = centerX + (Math.random() - 0.5) * 80;
          const targetY = centerY + (Math.random() - 0.5) * 40;
          n.x += (targetX - n.x) * ease * 0.08;
          n.y += (targetY - n.y) * ease * 0.08;
        });
        // Fade out connections
        connections.current.forEach((c) => {
          c.alpha *= 0.94;
        });
      }

      // ── PHASE: dissolve ──────────────────────────────────────
      if (phase === 'dissolve') {
        dissolveProgress += 0.02;
        nodes.current.forEach((n) => {
          if (!n.active) return;
          const angle = Math.atan2(n.y - centerY, n.x - centerX);
          n.x += Math.cos(angle) * 6;
          n.y += Math.sin(angle) * 6;
          n.size *= 0.96;
        });
        connections.current.forEach((c) => {
          c.alpha *= 0.88;
        });
      }

      // ── DRAW: connections ────────────────────────────────────
      connections.current.forEach((c) => {
        if (c.alpha < 0.01) return;
        const from = nodes.current[c.from];
        const to = nodes.current[c.to];
        if (!from || !to) return;

        ctx.save();
        ctx.globalAlpha = c.alpha;
        ctx.strokeStyle = COLORS.active;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
      });

      // ── DRAW: nodes ──────────────────────────────────────────
      nodes.current.forEach((n) => {
        if (n.size < 0.3) return;

        // Idle float
        if (phase === 'idle' || phase === 'broadcast') {
          n.x += Math.sin(timeRef.current * 0.0008 + n.x) * 0.15;
          n.y += Math.cos(timeRef.current * 0.0006 + n.y) * 0.15;
        }

        const age = timeRef.current - n.activatedAt;
        const glow = n.active ? Math.max(0, 1 - age / 400) : 0;

        ctx.save();
        ctx.shadowBlur = n.active ? 8 + glow * 6 : 3;
        ctx.shadowColor = n.active ? COLORS.active : COLORS.idle;
        ctx.fillStyle = n.active ? COLORS.active : COLORS.idle;
        ctx.globalAlpha = phase === 'dissolve' ? Math.max(0, 1 - dissolveProgress * 1.5) : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // ── DRAW: broadcast wave ─────────────────────────────────
      if (phase === 'broadcast' && broadcastRadius < Math.max(W, H)) {
        ctx.save();
        ctx.strokeStyle = COLORS.beam;
        ctx.lineWidth = 2;
        ctx.globalAlpha = Math.max(0, 1 - broadcastRadius / 600);
        ctx.beginPath();
        ctx.arc(centerX, centerY, broadcastRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5);
    };
  }, [onComplete]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0"
        style={{ zIndex: 9999, background: '#020617' }}
      />

      {/* ── TEXT OVERLAY ── */}
      <AnimatePresence>
        {showText && (
          <motion.div
            key="text"
            className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ zIndex: 10000 }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={
              phaseRef.current === 'dissolve'
                ? { opacity: 0, scale: 1.05 }
                : { opacity: 1, scale: 1 }
            }
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="text-5xl md:text-7xl font-black tracking-tight leading-none select-none">
              <span
                style={{
                  backgroundImage: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 45%, #34d399 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Render
              </span>
              <span className="text-white">OnNodes</span>
            </div>
            <p
              className="text-[11px] font-bold tracking-[0.35em] uppercase mt-3"
              style={{ color: 'rgba(148,163,184,0.5)' }}
            >
              Distributed Rendering Network
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SplashScreen;
