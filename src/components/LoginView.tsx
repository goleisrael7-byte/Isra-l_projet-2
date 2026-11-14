import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CreditCard,
  FileText,
  GraduationCap,
  Lock,
  Mail,
  Moon,
  Server,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react';
import { apiFetch, saveSession } from '../lib/api';
import type { AuthUser } from '../types';
import { BrandLogoMark, EASE_PRO } from './ui/MotionPrimitives';

export type PortalSpaceMode = 'student' | 'admin';

interface LoginViewProps {
  portalMode: PortalSpaceMode;
  onChangePortalMode: (mode: PortalSpaceMode) => void;
  onSuccess: (user: AuthUser) => void;
  darkMode: boolean;
  onToggleDark: () => void;
}

const STUDENT_DEMOS = [
  {
    id: 'amina',
    label: 'Amina Diallo',
    meta: 'L3 Génie Logiciel · MAT-2026-001',
    email: 'amina.diallo@etudiant.academie-ha.edu',
    pass: 'Etudiant2026!',
  },
  {
    id: 'lucas',
    label: 'Lucas Morel',
    meta: 'M1 Cybersécurité · MAT-2026-002',
    email: 'lucas.morel@etudiant.academie-ha.edu',
    pass: 'Etudiant2026!',
  },
];

const ADMIN_DEMOS = [
  {
    id: 'super-admin',
    label: 'Super Administration',
    meta: 'Direction & Infrastructure HA',
    email: 'admin@academie-ha.edu',
    pass: 'AdminHA2026!',
  },
  {
    id: 'scolarite',
    label: 'Service Scolarité',
    meta: 'Inscriptions, Notes & Paiements',
    email: 'scolarite@academie-ha.edu',
    pass: 'Scolarite2026!',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({
  portalMode,
  onChangePortalMode,
  onSuccess,
  darkMode,
  onToggleDark,
}) => {
  const isStudent = portalMode === 'student';
  const demos = isStudent ? STUDENT_DEMOS : ADMIN_DEMOS;

  const [email, setEmail] = useState(demos[0].email);
  const [password, setPassword] = useState(demos[0].pass);
  const [selectedDemo, setSelectedDemo] = useState(demos[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mismatchTarget, setMismatchTarget] = useState<{
    targetMode: PortalSpaceMode;
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  } | null>(null);

  useEffect(() => {
    const nextDemos = portalMode === 'student' ? STUDENT_DEMOS : ADMIN_DEMOS;
    setSelectedDemo(nextDemos[0].id);
    setEmail(nextDemos[0].email);
    setPassword(nextDemos[0].pass);
    setError(null);
    setMismatchTarget(null);
  }, [portalMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMismatchTarget(null);
    setLoading(true);
    try {
      const data = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const userIsStudent = data.user.role === 'ETUDIANT';
      if (isStudent && !userIsStudent) {
        setMismatchTarget({
          targetMode: 'admin',
          ...data,
        });
        return;
      }
      if (!isStudent && userIsStudent) {
        setMismatchTarget({
          targetMode: 'student',
          ...data,
        });
        return;
      }

      saveSession(data.accessToken, data.refreshToken, data.user);
      onSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F7FB] text-slate-900 dark:bg-[#070B14] dark:text-slate-100">
      {/* Top institutional gold-to-royal bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0B2447] via-[#1D4ED8] to-[#D97706]" />

      {/* Subtle architectural dot backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.3] dark:opacity-[0.1]"
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Institutional Header */}
      <header className="relative z-10 border-b border-slate-200/90 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <BrandLogoMark variant={isStudent ? 'student' : 'admin'} />
            <div>
              <div className="font-display text-base font-extrabold tracking-tight text-[#0B2447] dark:text-white">
                AcademiaHA
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Portail Numérique Universitaire
              </div>
            </div>
          </div>

          {/* Segmented Dual-Space Switcher */}
          <div
            role="tablist"
            aria-label="Sélection du portail"
            className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 sm:inline-flex dark:border-slate-800 dark:bg-slate-800/70"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isStudent}
              onClick={() => onChangePortalMode('student')}
              className={`relative flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isStudent ? 'text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {isStudent && (
                <motion.span
                  layoutId="gateway-header-tab"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-lg bg-[#1D4ED8] shadow-xs"
                />
              )}
              <GraduationCap className="relative z-10 h-3.5 w-3.5" />
              <span className="relative z-10">Espace Étudiant</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={!isStudent}
              onClick={() => onChangePortalMode('admin')}
              className={`relative flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                !isStudent ? 'text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {!isStudent && (
                <motion.span
                  layoutId="gateway-header-tab"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-lg bg-[#0B2447] shadow-xs"
                />
              )}
              <ShieldCheck className="relative z-10 h-3.5 w-3.5 text-amber-300" />
              <span className="relative z-10">Espace Administration</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleDark}
            aria-label="Basculer le thème clair ou sombre"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {darkMode ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-[#0B2447]" />}
            <span>{darkMode ? 'Clair' : 'Sombre'}</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8 lg:py-12">
        {/* Institutional Intro Strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_PRO }}
          className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-6 md:flex-row md:items-end dark:border-slate-800"
        >
          <div>
            <div className="text-xs font-semibold tracking-wide text-[#D97706] dark:text-amber-400">
              Plateforme Intégrée de Scolarité · Haute Disponibilité
            </div>
            <h1 className="font-display mt-1.5 text-2xl font-extrabold tracking-tight text-[#0B2447] sm:text-3xl dark:text-white">
              Choisissez votre espace de travail
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Deux portails dédiés et cloisonnés par rôle, synchronisés en temps réel sur le référentiel académique
              centralisé.
            </p>
          </div>
          <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
            Année académique 2025–2026 · Cluster HA actif
          </div>
        </motion.div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left 7 cols: Two Distinct MyIIPEA-Inspired Portal Gateway Cards */}
          <div className="space-y-5 lg:col-span-7">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* PORTAL 1: ESPACE ÉTUDIANT */}
              <motion.button
                type="button"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onChangePortalMode('student')}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 text-left transition-all ${
                  isStudent
                    ? 'border-[#1D4ED8] bg-white shadow-[0_20px_40px_-15px_rgba(29,78,216,0.22)] ring-2 ring-[#1D4ED8]/20 dark:border-blue-500 dark:bg-slate-900'
                    : 'border-slate-200 bg-white/85 hover:border-[#1D4ED8]/50 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/60 dark:text-blue-400">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        isStudent ? 'text-[#1D4ED8] dark:text-blue-400' : 'text-slate-400'
                      }`}
                    >
                      {isStudent ? 'Portail sélectionné' : 'Sélectionner →'}
                    </span>
                  </div>

                  <div className="mt-5 text-[11px] font-semibold tracking-wider text-[#D97706] uppercase dark:text-amber-400">
                    MyCampus · Front-Office
                  </div>
                  <h2 className="font-display mt-1 text-xl font-bold text-[#0B2447] dark:text-white">
                    Espace Étudiant
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Votre guichet académique personnel pour suivre vos résultats, votre emploi du temps et votre
                    situation financière.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-[11px] font-medium text-slate-700 dark:border-slate-800 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-blue-400" />
                    <span>Notes & ECTS</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-blue-400" />
                    <span>Emploi du temps</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-[#D97706] dark:text-amber-400" />
                    <span>Scolarité FCFA</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#D97706] dark:text-amber-400" />
                    <span>Attestations PDF</span>
                  </div>
                </div>
              </motion.button>

              {/* PORTAL 2: ESPACE ADMINISTRATION */}
              <motion.button
                type="button"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onChangePortalMode('admin')}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 text-left text-white transition-all ${
                  !isStudent
                    ? 'border-amber-400/70 bg-gradient-to-br from-[#081B36] via-[#0B2447] to-[#123463] shadow-[0_20px_40px_-15px_rgba(11,36,71,0.5)] ring-2 ring-amber-400/25'
                    : 'border-slate-800/70 bg-gradient-to-br from-[#0A1E3D] to-[#102E57] opacity-90 hover:opacity-100'
                }`}
              >
                {/* Geometric crest watermark */}
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 text-white/[0.06]"
                  viewBox="0 0 120 120"
                  fill="none"
                >
                  <circle cx="60" cy="60" r="48" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="60" cy="60" r="30" stroke="currentColor" strokeWidth="1.2" />
                </svg>

                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-white/10 text-amber-300">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <span className={`text-xs font-semibold ${!isStudent ? 'text-amber-300' : 'text-blue-200/70'}`}>
                      {!isStudent ? 'Portail sélectionné' : 'Sélectionner →'}
                    </span>
                  </div>

                  <div className="mt-5 text-[11px] font-semibold tracking-wider text-amber-300 uppercase">
                    Direction · Back-Office
                  </div>
                  <h2 className="font-display mt-1 text-xl font-bold text-white">Espace Administration</h2>
                  <p className="mt-2 text-xs leading-relaxed text-blue-100/80">
                    Console de pilotage pour la direction, la scolarité, les délibérations, la facturation et le
                    monitoring HA.
                  </p>
                </div>

                <div className="relative z-10 mt-5 grid grid-cols-2 gap-2 border-t border-white/12 pt-4 text-[11px] font-medium text-blue-100/90">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-amber-300" />
                    <span>Dossiers & CSV</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-amber-300" />
                    <span>Filières & Notes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-sky-300" />
                    <span>Recouvrement</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-sky-300" />
                    <span>Audit & Cluster HA</span>
                  </div>
                </div>
              </motion.button>
            </div>

            {/* Compact Infrastructure Assurance Strip */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-display font-bold text-[#0B2447] dark:text-white">
                  Architecture Haute Disponibilité & Isolation RBAC
                </span>
                <span className="font-mono text-[11px] text-[#1D4ED8] dark:text-blue-400">
                  VIP 192.168.56.100
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="font-mono text-[11px] font-semibold text-[#0B2447] dark:text-blue-300">
                    HAProxy + Keepalived
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Bascule active lb1 / lb2
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="font-mono text-[11px] font-semibold text-[#1D4ED8] dark:text-blue-400">
                    API Stateless JWT
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Nœuds app1 / app2 + Redis
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Base Répliquée WAL
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Isolation stricte des données
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right 5 cols: Portal-Specific Sign-In Card */}
          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              <motion.section
                key={portalMode}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: EASE_PRO }}
                className={`overflow-hidden rounded-2xl border shadow-[0_20px_50px_-15px_rgba(11,36,71,0.14)] ${
                  isStudent
                    ? 'border-blue-200/80 bg-white dark:border-slate-800 dark:bg-slate-900'
                    : 'border-[#0B2447]/30 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                {/* Portal-Specific Banner Header */}
                <div
                  className={`px-7 py-5 text-white ${
                    isStudent
                      ? 'bg-gradient-to-r from-[#1D4ED8] to-[#0F3A8A]'
                      : 'bg-gradient-to-r from-[#081B36] to-[#0F2E5A]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {isStudent ? (
                        <GraduationCap className="h-5 w-5 text-amber-300" />
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-amber-300" />
                      )}
                      <span className="text-xs font-semibold tracking-wide text-blue-100 uppercase">
                        {isStudent ? 'Connexion Portail Étudiant' : 'Connexion Console Administration'}
                      </span>
                    </div>
                  </div>
                  <h2 className="font-display mt-2 text-xl font-bold tracking-tight">
                    {isStudent ? 'Accéder à mon dossier étudiant' : 'Authentification Direction & Scolarité'}
                  </h2>
                  <p className="mt-1 text-xs text-blue-100/85">
                    {isStudent
                      ? 'Consultez vos notes publiées, votre emploi du temps et vos quittances.'
                      : 'Accès réservé aux administrateurs, responsables pédagogiques et scolarité.'}
                  </p>
                </div>

                <div className="p-7">
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        role="alert"
                        className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                      >
                        {error}
                      </motion.div>
                    )}

                    {mismatchTarget && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        role="status"
                        className="mb-4 space-y-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                      >
                        <div>
                          Ce compte ({mismatchTarget.user.prenom} {mismatchTarget.user.nom}) relève de{' '}
                          <strong>
                            {mismatchTarget.targetMode === 'admin'
                              ? 'l’Espace Administration'
                              : 'l’Espace Étudiant'}
                          </strong>
                          .
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            saveSession(
                              mismatchTarget.accessToken,
                              mismatchTarget.refreshToken,
                              mismatchTarget.user
                            );
                            onChangePortalMode(mismatchTarget.targetMode);
                            onSuccess(mismatchTarget.user);
                          }}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0B2447] px-3 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
                        >
                          <span>
                            Ouvrir{' '}
                            {mismatchTarget.targetMode === 'admin'
                              ? 'l’Espace Administration'
                              : 'l’Espace Étudiant'}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="login-email"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {isStudent ? 'Email universitaire étudiant' : 'Email administratif'}
                      </label>
                      <div className="relative mt-1.5">
                        <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="login-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pr-3.5 pl-10 text-sm text-slate-900 transition-all focus:border-[#1D4ED8] focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:focus:border-blue-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="login-password"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Mot de passe
                      </label>
                      <div className="relative mt-1.5">
                        <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="login-password"
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pr-3.5 pl-10 text-sm text-slate-900 transition-all focus:border-[#1D4ED8] focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:focus:border-blue-400"
                        />
                      </div>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.99 }}
                      type="submit"
                      disabled={loading}
                      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60 ${
                        isStudent
                          ? 'bg-[#1D4ED8] hover:bg-[#1E40AF]'
                          : 'bg-[#0B2447] hover:bg-[#14396B] dark:bg-blue-600 dark:hover:bg-blue-500'
                      }`}
                    >
                      <span>
                        {loading
                          ? 'Authentification...'
                          : isStudent
                          ? 'Entrer dans l’Espace Étudiant'
                          : 'Entrer dans l’Espace Administration'}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </motion.button>
                  </form>

                  <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {isStudent ? 'Profils étudiants de démonstration' : 'Comptes administratifs de démonstration'}
                      </span>
                      <span className="text-slate-400">1 clic</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {demos.map((acc) => {
                        const isSelected = selectedDemo === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setSelectedDemo(acc.id);
                              setEmail(acc.email);
                              setPassword(acc.pass);
                              setError(null);
                              setMismatchTarget(null);
                            }}
                            className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                              isSelected
                                ? 'border-[#1D4ED8] bg-blue-50/70 shadow-xs dark:border-blue-500 dark:bg-blue-950/40'
                                : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {acc.label}
                              </div>
                              <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {acc.meta}
                              </div>
                            </div>
                            <span className="ml-3 shrink-0 font-mono text-[11px] font-semibold text-[#1D4ED8] dark:text-blue-400">
                              Charger
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.section>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
};
