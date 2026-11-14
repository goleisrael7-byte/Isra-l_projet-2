import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Download, GraduationCap } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { downloadTranscriptPdf } from '../../lib/pdf';
import type { StudentRecord, TranscriptData } from '../../types';
import { EASE_PRO } from '../ui/MotionPrimitives';

export const StudentResults: React.FC = () => {
  const [data, setData] = useState<{ student: StudentRecord; transcript: TranscriptData } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ student: StudentRecord; transcript: TranscriptData }>('/api/student/results')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur chargement résultats'));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Calcul de vos moyennes en cours...
      </div>
    );
  }

  const { student, transcript } = data;
  const semesters = [transcript.s1, transcript.s2];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Mes résultats
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Notes publiées, moyennes pondérées par matière, bilans semestriels et relevé officiel PDF.
          </p>
        </div>
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => downloadTranscriptPdf(student, transcript)}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Télécharger le relevé PDF</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Moyenne Semestre 1</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {transcript.s1.moyenne !== null ? `${transcript.s1.moyenne.toFixed(2)}/20` : 'En attente'}
          </div>
          <div className="mt-2 border-t border-zinc-200/80 pt-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Mention : {transcript.s1.mention}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Moyenne Semestre 2</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {transcript.s2.moyenne !== null ? `${transcript.s2.moyenne.toFixed(2)}/20` : 'En attente'}
          </div>
          <div className="mt-2 border-t border-zinc-200/80 pt-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Mention : {transcript.s2.mention}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="flex items-center justify-between text-xs font-medium text-blue-600 dark:text-blue-400">
            <span>Bilan Annuel & ECTS</span>
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {transcript.annualAverage !== null ? `${transcript.annualAverage.toFixed(2)}/20` : '—'}
          </div>
          <div className="mt-2 border-t border-zinc-200/80 pt-2 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
            {transcript.totalCreditsObtenus} / {transcript.totalCredits} crédits validés
          </div>
        </div>
      </div>

      {semesters.map((sem, idx) => (
        <motion.div
          key={sem.semestre}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.06, ease: EASE_PRO }}
          className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-5 py-3.5 dark:border-zinc-800 dark:bg-[#16161B]">
            <h2 className="font-display text-sm font-semibold text-zinc-950 dark:text-white">
              Semestre {sem.semestre}
            </h2>
            <span className="font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
              Moyenne : {sem.moyenne !== null ? `${sem.moyenne.toFixed(2)}/20` : 'N/A'} · {sem.creditsObtenus}/
              {sem.creditsTotaux} ECTS
            </span>
          </div>

          {sem.matieres.length === 0 ? (
            <div className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              Aucun résultat publié pour le semestre {sem.semestre}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200/80 text-xs text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
                  <tr>
                    <th className="px-5 py-3">Matière</th>
                    <th className="px-5 py-3">Évaluations</th>
                    <th className="px-5 py-3 text-right">Coeff.</th>
                    <th className="px-5 py-3 text-right">Moyenne</th>
                    <th className="px-5 py-3 text-right">Décision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                  {sem.matieres.map((m) => (
                    <tr key={m.matiereId} className="transition-colors hover:bg-zinc-50 dark:hover:bg-[#16161B]">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-zinc-950 dark:text-white">{m.matiereNom}</div>
                        <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {m.matiereCode} · {m.ueCode} ({m.credits} ECTS)
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                        {m.notes.map((n) => `${n.typeEvaluation}: ${n.valeur}`).join(' · ')}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                        {m.coefficient}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold tabular-nums text-zinc-950 dark:text-white">
                        {m.moyenne !== null ? `${m.moyenne.toFixed(2)}/20` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs font-semibold">
                        <span
                          className={
                            m.valide
                              ? 'rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-400'
                              : 'rounded-md bg-red-500/15 px-2 py-0.5 text-red-700 dark:text-red-400'
                          }
                        >
                          {m.valide ? 'Validé' : 'À rattraper'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
};
