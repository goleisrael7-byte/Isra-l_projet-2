import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  BookOpen,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { AuthUser } from '../types';
import { AdminCommunication } from './admin/AdminCommunication';
import { AdminDashboard } from './admin/AdminDashboard';
import { AdminFinance } from './admin/AdminFinance';
import { AdminGrades } from './admin/AdminGrades';
import { AdminPedagogy } from './admin/AdminPedagogy';
import { AdminStudentCreateForm } from './admin/AdminStudentCreateForm';
import { AdminStudents } from './admin/AdminStudents';
import { AdminUsersAndHA } from './admin/AdminUsersAndHA';
import { PageTransition } from './ui/MotionPrimitives';

export type AdminSection =
  | 'dashboard'
  | 'students'
  | 'add-student'
  | 'pedagogy'
  | 'grades'
  | 'finance'
  | 'communication'
  | 'security';

export type FinanceTab = 'paiements' | 'passerelle' | 'inscriptions' | 'documents';

interface AdminPortalProps {
  user: AuthUser;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
}

const NAV_ITEMS: { id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'students', label: 'Étudiants', icon: Users },
  { id: 'add-student', label: 'Ajouter étudiant', icon: UserPlus },
  { id: 'pedagogy', label: 'Pédagogie & Classes', icon: BookOpen },
  { id: 'grades', label: 'Notes & Résultats', icon: GraduationCap },
  { id: 'finance', label: 'Scolarité & Paiements', icon: CreditCard },
  { id: 'communication', label: 'Communication', icon: Megaphone },
  { id: 'security', label: 'Sécurité & HA', icon: ShieldCheck },
];

export const AdminPortal: React.FC<AdminPortalProps> = ({ user, onLogout }) => {
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Admin Console defaults to Obsidian Carbon dark mode (like IMG_2093), independently of the light Student Portal
  const [adminDark, setAdminDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('academia_ha_admin_theme') !== 'light';
    } catch {
      return true;
    }
  });

  // Cross-view deep links from Dashboard actions
  const [studentIntent, setStudentIntent] = useState<{
    inspectId?: number;
    editId?: number;
    createTick?: number;
  }>({});
  const [financeTab, setFinanceTab] = useState<FinanceTab>('paiements');

  const toggleAdminTheme = () => {
    setAdminDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('academia_ha_admin_theme', next ? 'dark' : 'light');
      } catch {
        // ignore storage restrictions
      }
      return next;
    });
  };

  const navigateTo = (
    target: AdminSection,
    options?: { financeTab?: FinanceTab; inspectStudentId?: number; editStudentId?: number; createStudent?: boolean }
  ) => {
    if (options?.financeTab) {
      setFinanceTab(options.financeTab);
    }
    if (options?.createStudent) {
      setStudentIntent({});
      setSection('add-student');
      setMobileOpen(false);
      return;
    }
    if (options?.inspectStudentId || options?.editStudentId) {
      setStudentIntent({
        inspectId: options.inspectStudentId,
        editId: options.editStudentId,
      });
    } else {
      setStudentIntent({});
    }
    setSection(target);
    setMobileOpen(false);
  };

  const activeLabel = NAV_ITEMS.find((i) => i.id === section)?.label || 'Tableau de bord';
  const initials = `${user.prenom[0] || ''}${user.nom[0] || ''}`.toUpperCase() || 'A';

  return (
    <div className={adminDark ? 'dark' : ''}>
      <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-950 transition-colors duration-200 dark:bg-[#09090B] dark:text-zinc-100">
        {/* Top Bar matching reference Obsidian Carbon Admin header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-zinc-200 bg-white/95 px-4 backdrop-blur-md sm:px-6 dark:border-zinc-800/80 dark:bg-[#09090B]/95">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => navigateTo('dashboard')}
              className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950 font-display text-sm font-extrabold text-white dark:bg-white dark:text-zinc-950">
                A
              </span>
              <span className="font-display text-sm font-bold tracking-wider text-zinc-950 dark:text-white">
                ADMIN
              </span>
            </button>

            <span className="hidden h-4 w-px bg-zinc-200 sm:inline-block dark:bg-zinc-800" aria-hidden="true" />
            <span className="hidden text-xs font-medium text-zinc-500 sm:inline-block dark:text-zinc-400">
              {activeLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigateTo('communication')}
              title="Notifications & annonces"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
            >
              <Bell className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleAdminTheme}
              title={adminDark ? 'Passer au mode clair' : 'Passer au mode sombre'}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {adminDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-zinc-700" />}
              <span className="hidden sm:inline">{adminDark ? 'Clair' : 'Sombre'}</span>
            </button>

            <div
              title={`${user.prenom} ${user.nom} (${user.role})`}
              className="flex items-center gap-2.5 pl-1"
            >
              <div className="hidden text-right sm:block">
                <div className="text-xs font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
                  {user.prenom} {user.nom}
                </div>
                <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{user.role}</div>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 font-display text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                className="fixed inset-0 z-30 bg-black/70 backdrop-blur-xs lg:hidden"
              />
            )}
          </AnimatePresence>

          {/* Obsidian Carbon Left Sidebar */}
          <aside
            className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 dark:border-zinc-800/80 dark:bg-[#0D0D10] ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 lg:hidden dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950 font-display text-sm font-extrabold text-white dark:bg-white dark:text-zinc-950">
                  A
                </span>
                <span className="font-display text-sm font-bold tracking-wider">ADMIN</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className={`relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'text-white dark:text-zinc-950'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900/80 dark:hover:text-zinc-100'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="admin-active-nav"
                        transition={{ type: 'spring', stiffness: 440, damping: 36 }}
                        className="absolute inset-0 rounded-lg bg-zinc-950 shadow-xs dark:bg-white"
                      />
                    )}
                    <Icon className="relative z-10 h-4 w-4 shrink-0" />
                    <span className="relative z-10 truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800/80">
              <div className="mb-2 px-2 py-1 text-[11px] text-zinc-500 dark:text-zinc-500">
                AcademiaHA · Direction
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Déconnexion</span>
              </button>
            </div>
          </aside>

          <main className="mx-auto w-full max-w-[1360px] flex-1 p-5 sm:p-6 lg:p-8">
            <PageTransition routeKey={section}>
              {section === 'dashboard' && <AdminDashboard onNavigate={navigateTo} />}
              {section === 'students' && (
                <AdminStudents
                  intent={studentIntent}
                  onClearIntent={() => setStudentIntent({})}
                  onOpenCreatePage={() => navigateTo('add-student')}
                />
              )}
              {section === 'add-student' && <AdminStudentCreateForm onNavigate={navigateTo} />}
              {section === 'pedagogy' && <AdminPedagogy />}
              {section === 'grades' && <AdminGrades />}
              {section === 'finance' && <AdminFinance key={financeTab} initialTab={financeTab} />}
              {section === 'communication' && <AdminCommunication />}
              {section === 'security' && <AdminUsersAndHA currentUserRole={user.role} />}
            </PageTransition>
          </main>
        </div>
      </div>
    </div>
  );
};
