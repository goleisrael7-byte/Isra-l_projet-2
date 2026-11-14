import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  GraduationCap,
  Megaphone,
  Pencil,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { apiDownloadCsv, apiFetch } from '../../lib/api';
import type { AdminSection, FinanceTab } from '../AdminPortal';
import { FilierePerformanceChart, NiveauEnrollmentChart } from '../Charts';
import { AnimatedNumber, EASE_PRO } from '../ui/MotionPrimitives';

interface DashboardData {
  kpis: {
    totalEleves: number;
    elevesActifs: number;
    totalEnseignants: number;
    totalClasses: number;
    totalFilieres: number;
    tauxReussite: number;
    moyenneGenerale: number;
    totalPaiements: number;
    fraisAttendus: number;
    draftNotesCount: number;
    pendingTransactionsCount: number;
    totalInscriptions: number;
  };
  perfByFiliere: {
    code: string;
    nom: string;
    nbEleves: number;
    moyenne: number | null;
    tauxReussite: number | null;
  }[];
  enrollmentsByNiveau: { code: string; nom: string; total: number }[];
  recentStudents: {
    id: number;
    matricule: string;
    nom: string;
    prenom: string;
    email: string;
    statut: string;
    classeNom: string | null;
    filiereCode: string | null;
    filiereNom: string | null;
  }[];
  recentInscriptions: {
    id: number;
    eleve_id: number;
    annee_academique: string;
    type_inscription: string;
    statut: string;
    date_inscription: string;
    matricule: string;
    eleveNom: string;
    classeNom: string;
    filiereCode: string;
  }[];
  pendingTransactions: {
    id: number;
    transaction_id: string;
    eleve_id: number;
    montant: number;
    devise: string;
    canal: string;
    provider: string;
    statut: string;
    webhook_signature: string | null;
    created_at: string;
    matricule: string;
    eleveEmail: string;
    eleveNom: string;
  }[];
  recentAudit: {
    id: number;
    user_email: string;
    action: string;
    ressource: string;
    details: string;
    created_at: string;
  }[];
  recentNotifications: {
    id: number;
    titre: string;
    type: string;
    cible_type: string;
    created_at: string;
  }[];
}

interface AdminDashboardProps {
  onNavigate?: (
    target: AdminSection,
    options?: { financeTab?: FinanceTab; inspectStudentId?: number; editStudentId?: number; createStudent?: boolean }
  ) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [validatingTx, setValidatingTx] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardData>('/api/admin/dashboard');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleConfirmTx = async (tx: DashboardData['pendingTransactions'][number]) => {
    setValidatingTx(tx.transaction_id);
    setActionBanner(null);
    try {
      await apiFetch('/api/payments/confirm', {
        method: 'POST',
        body: JSON.stringify({
          transaction_id: tx.transaction_id,
          signature: tx.webhook_signature || '',
          outcome: 'REUSSI',
        }),
      });
      setActionBanner(`Transaction ${tx.transaction_id} validée et quittance générée.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de valider la transaction');
    } finally {
      setValidatingTx(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-14 animate-pulse rounded-xl bg-zinc-200 dark:bg-[#111114]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        {error || 'Impossible de charger les indicateurs.'}
      </div>
    );
  }

  const recoveryRate =
    data.kpis.fraisAttendus > 0
      ? Math.round((data.kpis.totalPaiements / data.kpis.fraisAttendus) * 100)
      : 0;

  const filteredRecentStudents = data.recentStudents.filter((s) => {
    if (!studentQuery.trim()) return true;
    const q = studentQuery.toLowerCase();
    return (
      s.nom.toLowerCase().includes(q) ||
      s.prenom.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.matricule.toLowerCase().includes(q)
    );
  });

  const featuredTx = data.pendingTransactions[0];

  return (
    <div className="space-y-6">
      {/* Header Row matching IMG_2093 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">
            Tableau de bord Admin
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Vue d’ensemble et pilotage de l’établissement
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void load()}
            title="Actualiser les données"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() =>
              void apiDownloadCsv(
                '/api/admin/backup',
                `rapport-academia-ha-${new Date().toISOString().slice(0, 10)}.json`
              )
            }
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exporter Rapport</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('security')}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Paramètres & HA</span>
          </button>
        </div>
      </div>

      {actionBanner && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span>{actionBanner}</span>
          <button type="button" onClick={() => setActionBanner(null)} className="underline">
            Fermer
          </button>
        </div>
      )}

      {/* Row 1: 4 Equal Stat KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0, ease: EASE_PRO }}
          className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-[#111114] dark:hover:border-zinc-700"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{data.kpis.elevesActifs} actifs</span>
            </span>
          </div>
          <div className="mt-4 font-mono text-3xl font-bold tracking-tight tabular-nums text-zinc-950 dark:text-white">
            <AnimatedNumber value={data.kpis.totalEleves} />
          </div>
          <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Étudiants</div>
          <div className="mt-2.5 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-500">
            <span>{data.kpis.totalEnseignants} enseignants</span>
            <span aria-hidden="true">·</span>
            <span>{data.kpis.totalInscriptions} inscriptions</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.04, ease: EASE_PRO }}
          className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-[#111114] dark:hover:border-zinc-700"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{data.kpis.totalFilieres} filières</span>
            </span>
          </div>
          <div className="mt-4 font-mono text-3xl font-bold tracking-tight tabular-nums text-zinc-950 dark:text-white">
            <AnimatedNumber value={data.kpis.totalClasses} />
          </div>
          <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Classes actives</div>
          <div className="mt-2.5 text-[11px] text-zinc-500 dark:text-zinc-500">
            Réparties sur {data.kpis.totalFilieres} pôles académiques
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08, ease: EASE_PRO }}
          className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-[#111114] dark:hover:border-zinc-700"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{data.kpis.draftNotesCount} brouillon(s)</span>
            </span>
          </div>
          <div className="mt-4 font-mono text-3xl font-bold tracking-tight tabular-nums text-zinc-950 dark:text-white">
            <AnimatedNumber value={data.kpis.tauxReussite} decimals={1} suffix="%" />
          </div>
          <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Taux de réussite</div>
          <div className="mt-2.5 text-[11px] text-zinc-500 dark:text-zinc-500">
            Moyenne globale : {Number(data.kpis.moyenneGenerale).toFixed(2)}/20
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12, ease: EASE_PRO }}
          className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-[#111114] dark:hover:border-zinc-700"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{recoveryRate}% encaissé</span>
            </span>
          </div>
          <div className="mt-4 truncate font-mono text-2xl font-bold tracking-tight tabular-nums text-zinc-950 sm:text-3xl dark:text-white">
            <AnimatedNumber value={data.kpis.totalPaiements} />
          </div>
          <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Recouvrement (FCFA)</div>
          <div className="mt-2.5 truncate text-[11px] text-zinc-500 dark:text-zinc-500">
            Sur {data.kpis.fraisAttendus.toLocaleString('fr-FR')} FCFA attendus
          </div>
        </motion.div>
      </div>

      {/* Row 2: 3 Action Strip Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-start gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xl font-bold tabular-nums text-zinc-950 dark:text-white">
              {data.kpis.pendingTransactionsCount}
            </div>
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Transactions API en attente
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('finance', { financeTab: 'passerelle' })}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
            >
              <span>Ouvrir la passerelle</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
            <UserCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xl font-bold tabular-nums text-zinc-950 dark:text-white">
              {data.kpis.totalInscriptions}
            </div>
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Inscriptions enregistrées
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('finance', { financeTab: 'inscriptions' })}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <span>Consulter le registre</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400">
            <Clock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xl font-bold tabular-nums text-zinc-950 dark:text-white">
              {data.kpis.draftNotesCount}
            </div>
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Notes en attente de publication
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('grades')}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:underline dark:text-cyan-400"
            >
              <span>Publier les notes</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Asymmetric 8 / 4 Split Grid mirroring IMG_2093 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
          {/* Card 1: Étudiants récents (mirrors Recent Users) */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                Étudiants récents
              </h2>
              <div className="flex items-center gap-2">
                {showSearch && (
                  <input
                    type="search"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Filtrer..."
                    className="h-8 w-40 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-100"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setShowSearch((s) => !s)}
                  title="Filtrer les étudiants récents"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('students')}
                  className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                >
                  Voir tout
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {filteredRecentStudents.length === 0 ? (
                <div className="rounded-xl border border-zinc-200/70 bg-zinc-50 p-4 text-center text-xs text-zinc-500 dark:border-zinc-800/70 dark:bg-[#16161B] dark:text-zinc-400">
                  Aucun étudiant récent trouvé.
                </div>
              ) : (
                filteredRecentStudents.map((s) => {
                  const initials = `${s.prenom[0] || ''}${s.nom[0] || ''}`.toUpperCase();
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 transition-colors hover:border-zinc-300 dark:border-zinc-800/70 dark:bg-[#16161B] dark:hover:border-zinc-700"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 font-display text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                            {s.prenom} {s.nom}
                          </div>
                          <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{s.email}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                              {s.filiereCode || s.classeNom || 'Non affecté'}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                s.statut === 'ACTIF'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                                  : 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                              }`}
                            >
                              {s.statut === 'ACTIF' ? 'Actif' : s.statut}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-500">
                              {s.matricule}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onNavigate?.('students', { inspectStudentId: s.id })}
                          title="Consulter le dossier académique"
                          className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate?.('students', { editStudentId: s.id })}
                          title="Modifier l’étudiant"
                          className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Card 2: Inscriptions & Dossiers récents (mirrors Recent Jobs / Pending Applications) */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                Inscriptions récentes
              </h2>
              <button
                type="button"
                onClick={() => onNavigate?.('finance', { financeTab: 'inscriptions' })}
                className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              >
                Voir tout
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {data.recentInscriptions.map((insc) => {
                const initials = insc.eleveNom
                  .split(' ')
                  .map((p) => p[0] || '')
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                return (
                  <div
                    key={insc.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 transition-colors hover:border-zinc-300 dark:border-zinc-800/70 dark:bg-[#16161B] dark:hover:border-zinc-700"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 font-display text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-950 dark:text-white">
                            {insc.eleveNom}
                          </span>
                          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                            {insc.type_inscription}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          Classe : {insc.classeNom} ({insc.filiereCode}) · {insc.annee_academique}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                          {insc.matricule} · {new Date(insc.date_inscription).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate?.('students', { inspectStudentId: insc.eleve_id })}
                      className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 whitespace-nowrap shrink-0"
                    >
                      Consulter
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card 3: Performances académiques & Effectifs */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 xl:col-span-7 dark:border-zinc-800/80 dark:bg-[#111114]">
              <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                Performances par filière
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Moyenne pondérée et taux de validation (notes ≥ 10/20)
              </p>
              <div className="mt-4">
                <FilierePerformanceChart data={data.perfByFiliere} />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 xl:col-span-5 dark:border-zinc-800/80 dark:bg-[#111114]">
              <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                Répartition par niveau
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Effectifs inscrits par cycle LMD
              </p>
              <NiveauEnrollmentChart data={data.enrollmentsByNiveau} />
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Quick Actions (mirrors IMG_2093 right stack) */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
            <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
              Actions rapides
            </h2>

            <div className="mt-4 space-y-2.5">
              {[
                {
                  title: 'Nouvel étudiant',
                  sub: `${data.kpis.totalEleves} dossiers enregistrés`,
                  icon: Users,
                  action: () => onNavigate?.('students', { createStudent: true }),
                },
                {
                  title: 'Pédagogie & Classes',
                  sub: `${data.kpis.totalClasses} classes · ${data.kpis.totalFilieres} filières`,
                  icon: BookOpen,
                  action: () => onNavigate?.('pedagogy'),
                },
                {
                  title: 'Notes & Résultats',
                  sub: `${data.kpis.draftNotesCount} note(s) à publier`,
                  icon: GraduationCap,
                  action: () => onNavigate?.('grades'),
                },
                {
                  title: 'Passerelle Paiements',
                  sub: `${data.kpis.pendingTransactionsCount} transaction(s) en attente`,
                  icon: CreditCard,
                  action: () => onNavigate?.('finance', { financeTab: 'passerelle' }),
                },
                {
                  title: 'Communication',
                  sub: 'Diffuser une annonce ciblée',
                  icon: Megaphone,
                  action: () => onNavigate?.('communication'),
                },
                {
                  title: 'Audit & Cluster HA',
                  sub: 'Journaux système & réplication',
                  icon: ShieldCheck,
                  action: () => onNavigate?.('security'),
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={item.action}
                    className="flex w-full items-center gap-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 text-left transition-all hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800/80 dark:bg-[#16161B] dark:hover:border-zinc-700 dark:hover:bg-[#1C1C22]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-200/70 text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{item.title}</div>
                      <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{item.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Featured Payment Gateway Action Widget (mirrors Demo Requests card) */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                Passerelle API
              </h2>
              <button
                type="button"
                onClick={() => onNavigate?.('finance', { financeTab: 'passerelle' })}
                className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              >
                Voir tout
              </button>
            </div>

            {featuredTx ? (
              <div className="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800/70 dark:bg-[#16161B]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                      {featuredTx.eleveNom}
                    </div>
                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {featuredTx.eleveEmail}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      featuredTx.statut === 'EN_ATTENTE'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {featuredTx.statut === 'EN_ATTENTE' ? 'En attente' : 'Validée'}
                  </span>
                </div>

                <div className="mt-2 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                  {Number(featuredTx.montant).toLocaleString('fr-FR')} {featuredTx.devise} · {featuredTx.canal}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  Réf : {featuredTx.transaction_id} ·{' '}
                  {new Date(featuredTx.created_at).toLocaleDateString('fr-FR')}
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  {featuredTx.statut === 'EN_ATTENTE' ? (
                    <button
                      type="button"
                      disabled={validatingTx === featuredTx.transaction_id}
                      onClick={() => void handleConfirmTx(featuredTx)}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{validatingTx ? '...' : 'Valider'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigate?.('finance', { financeTab: 'passerelle' })}
                      className="inline-flex h-8 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                    >
                      Passerelle
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate?.('finance', { financeTab: 'passerelle' })}
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-zinc-950 px-3 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    Détails
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 text-xs text-zinc-500 dark:border-zinc-800/70 dark:bg-[#16161B] dark:text-zinc-400">
                Aucune transaction récente.
              </div>
            )}
          </section>

          {/* Compact Audit Trail Card */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                Audit récent
              </h2>
              <button
                type="button"
                onClick={() => onNavigate?.('security')}
                className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              >
                Journaux
              </button>
            </div>
            <div className="mt-3 divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
              {data.recentAudit.slice(0, 4).map((log) => (
                <div key={log.id} className="py-2.5 text-xs">
                  <div className="font-medium text-zinc-900 dark:text-zinc-200">{log.details}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-500">
                    <span className="truncate">{log.user_email || 'Système'}</span>
                    <span className="shrink-0 font-mono tabular-nums">
                      {new Date(log.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
