import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, MapPin } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { TimetableSlot } from '../../types';
import { EASE_PRO } from '../ui/MotionPrimitives';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;

export const StudentTimetable: React.FC = () => {
  const [data, setData] = useState<{ classeNom: string | null; slots: TimetableSlot[] } | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState<string>('Lundi');

  useEffect(() => {
    apiFetch<{ classeNom: string | null; slots: TimetableSlot[] }>('/api/student/timetable')
      .then(setData)
      .catch(() => setData({ classeNom: null, slots: [] }));
  }, []);

  if (!data) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Chargement de l’emploi du temps...
      </div>
    );
  }

  const visibleDays = viewMode === 'week' ? DAYS : [selectedDay];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Mon emploi du temps
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Classe {data.classeNom || 'Non affectée'} · Horaires, salles et intervenants.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-[#111114]">
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'week'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            Vue Semaine
          </button>
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'day'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            Vue par Jour
          </button>
        </div>
      </div>

      {viewMode === 'day' && (
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDay(d)}
              className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                selectedDay === d
                  ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-300 dark:hover:bg-zinc-900'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${viewMode === 'week' ? 'md:grid-cols-2 lg:grid-cols-3' : ''}`}>
        {visibleDays.map((day, idx) => {
          const daySlots = data.slots.filter((s) => s.jour_semaine === day);
          return (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.04, ease: EASE_PRO }}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]"
            >
              <h2 className="font-display border-b border-zinc-200/80 pb-2.5 text-sm font-semibold text-zinc-950 dark:border-zinc-800/80 dark:text-white">
                {day}
              </h2>
              {daySlots.length === 0 ? (
                <p className="py-5 text-xs text-zinc-400 dark:text-zinc-500">Aucun cours programmé.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 transition-colors hover:border-zinc-300 dark:border-zinc-800/70 dark:bg-[#16161B] dark:hover:border-zinc-700"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-blue-600 dark:text-blue-400">
                          <Clock className="h-3 w-3" />
                          {slot.heure_debut} – {slot.heure_fin}
                        </span>
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          {slot.type_cours}
                        </span>
                      </div>
                      <div className="mt-1.5 font-semibold text-zinc-950 dark:text-white">{slot.matiereNom}</div>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {slot.salle}
                        </span>
                        <span>{slot.enseignantNom || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
