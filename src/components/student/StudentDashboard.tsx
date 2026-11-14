import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Bell,
  Calendar,
  CreditCard,
  FileText,
  GraduationCap,
  UserCheck,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { NotificationRecord, StudentRecord, TimetableSlot } from '../../types';
import { AnimatedNumber, EASE_PRO, ProgressRing } from '../ui/MotionPrimitives';

interface StudentDashData {
  student: StudentRecord;
  academicSummary: {
    annualAverage: number | null;
    s1Average: number | null;
    s2Average: number | null;
    creditsObtenus: number;
    creditsTotaux: number;
  };
  tuitionSummary: {
    fraisAnnuels: number;
    totalPaye: number;
    soldeRestant: number;
  };
  upcomingClasses: TimetableSlot[];
  recentNotifications: NotificationRecord[];
  unreadCount: number;
}

const QUICK_SERVICES = [
  {
    id: 'results',
    title: 'Mes notes & ECTS',
    desc: 'Moyennes par UE et relevé PDF',
    icon: GraduationCap,
    tone: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  },
  {
    id: 'timetable',
    title: 'Emploi du temps',
    desc: 'Cours, salles et horaires',
    icon: Calendar,
    tone: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  },
  {
    id: 'tuition',
    title: 'Ma scolarité',
    desc: 'Frais FCFA et quittances',
    icon: CreditCard,
    tone: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  {
    id: 'documents',
    title: 'Mes documents',
    desc: 'Attestations & certificats',
    icon: FileText,
    tone: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  },
  {
    id: 'notifications',
    title: 'Annonces',
    desc: 'Messages de la scolarité',
    icon: Bell,
    tone: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  },
  {
    id: 'profile',
    title: 'Mon profil',
    desc: 'Coordonnées & mot de passe',
    icon: UserCheck,
    tone: 'bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
];

export const StudentDashboard: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<StudentDashData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<StudentDashData>('/api/student/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur chargement espace étudiant'));
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
        Chargement de votre dossier personnel...
      </div>
    );
  }

  const { student, academicSummary, tuitionSummary } = data;
  const initials = `${student.prenom[0] || ''}${student.nom[0] || ''}`.toUpperCase();
  const ectsPercent =
    academicSummary.creditsTotaux > 0
      ? Math.round((academicSummary.creditsObtenus / academicSummary.creditsTotaux) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Digital Student Card Banner — Obsidian Carbon Pro */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_PRO }}
        className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114] sm:p-7"
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-10 h-56 w-56 text-zinc-900/[0.04] dark:text-white/[0.03]"
          viewBox="0 0 200 200"
          fill="none"
        >
          <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="58" stroke="currentColor" strokeWidth="1" />
          <path d="M20 100H180M100 20V180" stroke="currentColor" strokeWidth="1" />
        </svg>

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-4 sm:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-950 font-display text-lg font-extrabold text-white dark:bg-white dark:text-zinc-950">
              {initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                <span>Carte Étudiant Numérique</span>
                <span className="text-zinc-400 dark:text-zinc-600">·</span>
                <span>{student.matricule}</span>
                <span className="text-zinc-400 dark:text-zinc-600">·</span>
                <span className="text-zinc-500 dark:text-zinc-400">{student.anneeAcademique || '2025-2026'}</span>
              </div>
              <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
                Bienvenue, {student.prenom} {student.nom}
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {student.filiereNom} · {student.niveauNom} ({student.classeNom})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => onNavigate('results')}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <span>Mon relevé de notes</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => onNavigate('documents')}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <FileText className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <span>Attestation PDF</span>
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* Quick-Access Services Grid */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            Services Numériques Campus
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Accès direct aux modules</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_SERVICES.map((srv, idx) => {
            const Icon = srv.icon;
            return (
              <motion.button
                key={srv.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.03, ease: EASE_PRO }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate(srv.id)}
                className="flex flex-col items-start rounded-xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-[#111114] dark:hover:border-zinc-700"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${srv.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-3 font-display text-xs font-semibold text-zinc-950 dark:text-white">
                  {srv.title}
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{srv.desc}</div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Academic & Financial KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.04, ease: EASE_PRO }}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="font-mono text-[11px] font-medium text-blue-600 dark:text-blue-400">Moyenne</span>
          </div>
          <div className="mt-4 font-display text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {academicSummary.annualAverage !== null ? (
              <AnimatedNumber value={academicSummary.annualAverage} decimals={2} suffix="/20" />
            ) : (
              '—'
            )}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            S1 : {academicSummary.s1Average !== null ? `${academicSummary.s1Average}/20` : '—'} · S2 :{' '}
            {academicSummary.s2Average !== null ? `${academicSummary.s2Average}/20` : '—'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08, ease: EASE_PRO }}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Crédits ECTS</div>
              <div className="mt-2 font-display text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                <AnimatedNumber value={academicSummary.creditsObtenus} />
                <span className="text-base font-normal text-zinc-400 dark:text-zinc-500">
                  {' '}
                  / {academicSummary.creditsTotaux}
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Résultats publiés</div>
            </div>
            <ProgressRing percent={ectsPercent} size={62} strokeWidth={6} accent="emerald" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12, ease: EASE_PRO }}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <CreditCard className="h-4 w-4" />
            </div>
            <span className="font-mono text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Scolarité</span>
          </div>
          <div
            className={`mt-4 font-display text-2xl font-bold tabular-nums ${
              tuitionSummary.soldeRestant === 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            <AnimatedNumber value={tuitionSummary.soldeRestant} suffix=" FCFA" />
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Payé : {tuitionSummary.totalPaye.toLocaleString('fr-FR')} FCFA
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.16, ease: EASE_PRO }}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
              <Bell className="h-4 w-4" />
            </div>
            <span className="font-mono text-[11px] font-medium text-violet-600 dark:text-violet-400">Annonces</span>
          </div>
          <div className="mt-4 font-display text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
            <AnimatedNumber value={data.unreadCount} />
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Notifications non lues</div>
        </motion.div>
      </div>

      {/* Upcoming Schedule & Communications */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
              Prochains cours de la semaine
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('timetable')}
              className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            >
              Voir tout
            </button>
          </div>
          <div className="mt-4 space-y-2.5">
            {data.upcomingClasses.length === 0 ? (
              <p className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800/70 dark:bg-[#16161B] dark:text-zinc-400">
                Aucun cours planifié pour votre classe.
              </p>
            ) : (
              data.upcomingClasses.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-3 transition-colors hover:border-zinc-300 dark:border-zinc-800/70 dark:bg-[#16161B] dark:hover:border-zinc-700"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-zinc-950 dark:text-white">{c.matiereNom}</div>
                    <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {c.type_cours} · {c.salle} · {c.enseignantNom || 'Équipe pédagogique'}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{c.jour_semaine}</span>
                    </div>
                    <div className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {c.heure_debut} – {c.heure_fin}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
              Annonces & Scolarité
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            >
              Tout ouvrir
            </button>
          </div>
          <div className="mt-4 space-y-2.5">
            {data.recentNotifications.map((n) => (
              <div
                key={n.id}
                className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-3 transition-colors hover:border-zinc-300 dark:border-zinc-800/70 dark:bg-[#16161B] dark:hover:border-zinc-700"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-semibold text-zinc-950 dark:text-white">{n.titre}</div>
                  <span className="shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(n.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
