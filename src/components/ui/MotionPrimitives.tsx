import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

export const EASE_PRO = [0.16, 1, 0.3, 1] as const;

export const AnimatedNumber: React.FC<{
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
}> = ({ value, decimals = 0, suffix = '', prefix = '', durationMs = 650 }) => {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const startVal = 0;
    const startTime = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(startVal + (value - startVal) * eased);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, durationMs]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('fr-FR');

  return (
    <span className="tabular-nums">
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

export const PageTransition: React.FC<{
  routeKey: string;
  children: React.ReactNode;
}> = ({ routeKey, children }) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2, ease: EASE_PRO }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export const ProgressRing: React.FC<{
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  accent?: 'blue' | 'gold' | 'emerald';
}> = ({ percent, size = 76, strokeWidth = 7, label, accent = 'blue' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  const strokeClass =
    accent === 'gold'
      ? 'text-amber-500 dark:text-amber-400'
      : accent === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-blue-600 dark:text-blue-400';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-200 dark:text-zinc-800"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.85, ease: EASE_PRO }}
          className={strokeClass}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xs font-bold tabular-nums text-zinc-950 dark:text-white">
          {Math.round(clamped)}%
        </span>
        {label && <span className="text-[9px] text-zinc-400">{label}</span>}
      </div>
    </div>
  );
};

export const SlideOverDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, headerActions, children }) => {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#111114]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
              <div className="min-w-0">
                {subtitle && (
                  <div className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {subtitle}
                  </div>
                )}
                <h2 className="font-display mt-0.5 truncate text-xl font-bold text-zinc-950 dark:text-white">
                  {title}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {headerActions}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer le panneau"
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const BrandLogoMark: React.FC<{
  inverted?: boolean;
  variant?: 'default' | 'student' | 'admin';
}> = ({ inverted = false, variant = 'default' }) => {
  const bgClass = inverted
    ? 'fill-white/15'
    : variant === 'student'
    ? 'fill-[#1D4ED8] dark:fill-blue-600'
    : 'fill-[#0B2447] dark:fill-blue-600';

  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="8" className={bgClass} />
      <path
        d="M16 7L24 11.5V20.5L16 25L8 20.5V11.5L16 7Z"
        stroke="white"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M16 16V25M16 16L24 11.5M16 16L8 11.5" stroke="white" strokeWidth="1.35" strokeOpacity="0.72" />
      <circle cx="16" cy="11.2" r="1.7" fill="#F59E0B" />
    </svg>
  );
};
