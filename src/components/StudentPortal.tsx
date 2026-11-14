import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Calendar,
  CreditCard,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Moon,
  Sun,
  User,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { AuthUser } from '../types';
import { StudentDashboard } from './student/StudentDashboard';
import { StudentDocuments, StudentNotifications, StudentTuition } from './student/StudentDocsFinanceNotifs';
import { StudentProfile } from './student/StudentProfile';
import { StudentResults } from './student/StudentResults';
import { StudentTimetable } from './student/StudentTimetable';
import { PageTransition } from './ui/MotionPrimitives';

export type StudentSection =
  | 'dashboard'
  | 'results'
  | 'timetable'
  | 'tuition'
  | 'documents'
  | 'notifications'
  | 'profile';

interface StudentPortalProps {
  user: AuthUser;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
}

const NAV_ITEMS: { id: StudentSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Accueil', icon: Home },
  { id: 'results', label: 'Résultats', icon: GraduationCap },
  { id: 'timetable', label: 'Emploi du temps', icon: Calendar },
  { id: 'tuition', label: 'Scolarité', icon: CreditCard },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'notifications', label: 'Annonces', icon: Bell },
  { id: 'profile', label: 'Profil', icon: User },
];

export const StudentPortal: React.FC<StudentPortalProps> = ({ user, onLogout }) => {
  const [section, setSection] = useState<StudentSection>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Align Student Portal theme identically with Admin Obsidian Carbon dark-first palette
  const [studentDark, setStudentDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('academia_ha_student_theme') !== 'light';
    } catch {
      return true;
    }
  });

  const toggleStudentTheme = () => {
    setStudentDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('academia_ha_student_theme', next ? 'dark' : 'light');
      } catch {
        // ignore storage restrictions
      }
      return next;
    });
  };

  useEffect(() => {
    apiFetch<{ unreadCount: number }>('/api/student/dashboard')
      .then((res) => setUnreadCount(res.unreadCount || 0))
      .catch(() => setUnreadCount(0));
  }, [section]);

  const initials = `${user.prenom[0] || ''}${user.nom[0] || ''}`.toUpperCase() || 'E';

  return (
    <div className={studentDark ? 'dark' : ''}>
      <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-950 transition-colors duration-200 dark:bg-[#09090B] dark:text-zinc-100">
        {/* Top Bar matching Admin Obsidian Carbon shell */}
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#09090B]/95">
          <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-6">
            {/* Brand */}
            <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Ouvrir le menu étudiant"
                className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => setSection('dashboard')}
                className="flex items-center gap-2.5 text-left"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950 font-display text-sm font-extrabold text-white dark:bg-white dark:text-zinc-950">
                  E
                </span>
                <div>
                  <span className="font-display text-sm font-bold tracking-wider text-zinc-950 dark:text-white">
                    ÉTUDIANT
                  </span>
                </div>
              </button>
              <span className="hidden h-4 w-px bg-zinc-200 sm:inline-block dark:bg-zinc-800" aria-hidden="true" />
              <span className="hidden text-xs font-medium text-zinc-500 sm:inline-block dark:text-zinc-400">
                AcademiaHA · MyCampus
              </span>
            </div>

            {/* Horizontal Desktop Tabs */}
            <nav aria-label="Navigation étudiant" className="hidden items-center gap-1 lg:flex">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={`relative flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'text-white dark:text-zinc-950'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="student-portal-tab"
                        transition={{ type: 'spring', stiffness: 440, damping: 36 }}
                        className="absolute inset-0 rounded-lg bg-zinc-950 shadow-xs dark:bg-white"
                      />
                    )}
                    <Icon className="relative z-10 h-3.5 w-3.5 shrink-0" />
                    <span className="relative z-10">{item.label}</span>
                    {item.id === 'notifications' && unreadCount > 0 && (
                      <span
                        className={`relative z-10 font-mono text-[11px] font-bold ${
                          active ? 'text-amber-400 dark:text-amber-600' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        ({unreadCount})
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Controls */}
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <button
                type="button"
                onClick={toggleStudentTheme}
                aria-label="Basculer le thème"
                title={studentDark ? 'Passer au mode clair' : 'Passer au mode sombre'}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {studentDark ? (
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-zinc-700" />
                )}
                <span className="hidden sm:inline">{studentDark ? 'Clair' : 'Sombre'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSection('profile')}
                title={`${user.prenom} ${user.nom}`}
                className="hidden items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-left transition-colors hover:bg-zinc-100 sm:flex dark:border-zinc-800 dark:bg-[#111114] dark:hover:bg-zinc-900"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950 font-display text-[11px] font-bold text-white dark:bg-white dark:text-zinc-950">
                  {initials}
                </span>
                <span className="max-w-28 truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  {user.prenom} {user.nom}
                </span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                title="Déconnexion"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-zinc-800 dark:bg-[#111114] dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Déconnexion</span>
              </button>
            </div>
          </div>

          {/* Mobile Drawer Navigation */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden border-t border-zinc-200 bg-white lg:hidden dark:border-zinc-800/80 dark:bg-[#0D0D10]"
              >
                <div className="grid grid-cols-2 gap-1.5 p-3 sm:grid-cols-4">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = section === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSection(item.id);
                          setMobileOpen(false);
                        }}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-[#16161B] dark:text-zinc-300 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main className="mx-auto w-full max-w-[1360px] flex-1 p-5 sm:p-6 lg:p-8">
          <PageTransition routeKey={section}>
            {section === 'dashboard' && <StudentDashboard onNavigate={(tab) => setSection(tab as StudentSection)} />}
            {section === 'profile' && <StudentProfile />}
            {section === 'results' && <StudentResults />}
            {section === 'timetable' && <StudentTimetable />}
            {section === 'documents' && <StudentDocuments />}
            {section === 'tuition' && <StudentTuition />}
            {section === 'notifications' && <StudentNotifications />}
          </PageTransition>
        </main>

        <footer className="border-t border-zinc-200 bg-white py-4 text-center text-xs text-zinc-500 dark:border-zinc-800/80 dark:bg-[#09090B] dark:text-zinc-500">
          AcademiaHA · Espace Numérique Étudiant · Données isolées par session JWT
        </footer>
      </div>
    </div>
  );
};
