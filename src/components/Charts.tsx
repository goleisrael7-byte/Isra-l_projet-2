import React, { useState } from 'react';
import { motion } from 'motion/react';
import { EASE_PRO } from './ui/MotionPrimitives';

interface FilierePerf {
  code: string;
  nom: string;
  nbEleves: number;
  moyenne: number | null;
  tauxReussite: number | null;
}

export const FilierePerformanceChart: React.FC<{ data: FilierePerf[] }> = ({ data }) => {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        Aucune donnée académique disponible.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item, idx) => {
        const rate = item.tauxReussite ?? 0;
        const avg = item.moyenne ?? 0;
        const isHovered = hoveredCode === item.code;
        return (
          <motion.div
            key={item.code}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.3, ease: EASE_PRO }}
            onMouseEnter={() => setHoveredCode(item.code)}
            onMouseLeave={() => setHoveredCode(null)}
            className={`rounded-xl border p-3.5 transition-colors duration-150 ${
              isHovered
                ? 'border-zinc-300 bg-zinc-100/80 dark:border-zinc-700 dark:bg-[#1C1C22]'
                : 'border-zinc-200/70 bg-zinc-50/70 dark:border-zinc-800/70 dark:bg-[#16161B]'
            }`}
          >
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <div className="min-w-0">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.nom}</span>
                <span className="ml-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {item.code} · {item.nbEleves} étudiant(s)
                </span>
              </div>
              <div className="shrink-0 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-white">
                {avg.toFixed(2)}/20 · {rate.toFixed(1)}%
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(4, rate))}%` }}
                  transition={{ duration: 0.7, delay: idx * 0.07, ease: EASE_PRO }}
                  className="h-full rounded-full bg-zinc-900 dark:bg-white"
                />
              </div>
              <div className="h-2 w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" title="Moyenne sur 20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (avg / 20) * 100)}%` }}
                  transition={{ duration: 0.7, delay: idx * 0.07 + 0.08, ease: EASE_PRO }}
                  className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400"
                />
              </div>
            </div>
          </motion.div>
        );
      })}
      <div className="flex items-center justify-end gap-5 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-zinc-900 dark:bg-white" />
          Taux de réussite (%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-emerald-600 dark:bg-emerald-400" />
          Moyenne (/20)
        </span>
      </div>
    </div>
  );
};

interface NiveauEnrollment {
  code: string;
  nom: string;
  total: number;
}

export const NiveauEnrollmentChart: React.FC<{ data: NiveauEnrollment[] }> = ({ data }) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.total));
  const totalAll = data.reduce((acc, d) => acc + d.total, 0);

  return (
    <div className="relative pt-3">
      <div className="relative flex h-48 items-end justify-between gap-3 border-b border-zinc-200 px-2 pb-2 dark:border-zinc-800">
        <div className="pointer-events-none absolute inset-x-0 top-3 bottom-2 flex flex-col justify-between">
          {[100, 50, 0].map((tick) => (
            <div key={tick} className="w-full border-t border-dashed border-zinc-200/80 dark:border-zinc-800/80" />
          ))}
        </div>

        {data.map((item, idx) => {
          const pct = Math.round((item.total / max) * 100);
          const share = totalAll > 0 ? Math.round((item.total / totalAll) * 100) : 0;
          const isActive = activeIdx === idx;
          return (
            <div
              key={item.code}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
              className="relative z-10 flex flex-1 cursor-default flex-col items-center gap-2"
            >
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`font-mono text-xs font-bold tabular-nums transition-colors ${
                  isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-zinc-200'
                }`}
              >
                {item.total}
                {isActive && <span className="ml-1 text-[10px] font-normal text-zinc-400">({share}%)</span>}
              </motion.div>

              <div className="flex h-32 w-full max-w-[48px] items-end rounded-lg bg-zinc-100 p-1 dark:bg-[#16161B]">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(item.total > 0 ? 14 : 6, pct)}%` }}
                  transition={{ duration: 0.65, delay: idx * 0.07, ease: EASE_PRO }}
                  className={`w-full rounded-md transition-colors duration-150 ${
                    isActive
                      ? 'bg-emerald-600 dark:bg-emerald-400'
                      : 'bg-zinc-900 dark:bg-white'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex justify-between gap-3 px-2">
        {data.map((item, idx) => (
          <div key={item.code} className="flex-1 text-center">
            <div
              className={`font-mono text-xs font-bold ${
                activeIdx === idx ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {item.code}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.nom}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
