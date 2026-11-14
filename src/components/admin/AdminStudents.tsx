import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { apiDownloadCsv, apiFetch } from '../../lib/api';
import { downloadTranscriptPdf } from '../../lib/pdf';
import type { DocumentRecord, PaymentRecord, StudentRecord, TranscriptData } from '../../types';
import { EASE_PRO, SlideOverDrawer } from '../ui/MotionPrimitives';

interface PedagogyLookup {
  filieres: { id: number; code: string; nom: string }[];
  classes: { id: number; nom: string; filiere_id: number | null }[];
}

interface AdminStudentsProps {
  intent?: { inspectId?: number; editId?: number; createTick?: number };
  onClearIntent?: () => void;
  onOpenCreatePage?: () => void;
}

export const AdminStudents: React.FC<AdminStudentsProps> = ({ intent, onClearIntent, onOpenCreatePage }) => {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [lookup, setLookup] = useState<PedagogyLookup>({ filieres: [], classes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [filiereId, setFiliereId] = useState('');
  const [statutFilter, setStatutFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [editing, setEditing] = useState<StudentRecord | null>(null);
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    date_naissance: '2004-01-15',
    adresse: '',
    contact_urgence: '',
    classe_id: '',
    matricule: '',
    password: '',
  });

  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState(
    'nom;prenom;email;telephone;classe\nKoffi;Salimata;salimata.koffi@etudiant.academie-ha.edu;+33 6 12 00 11 22;L3-GL-A'
  );
  const [importResult, setImportResult] = useState<string | null>(null);

  const [dossier, setDossier] = useState<{
    student: StudentRecord;
    transcript: TranscriptData;
    payments: PaymentRecord[];
    documents: DocumentRecord[];
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (filiereId) params.set('filiereId', filiereId);
      if (statutFilter) params.set('statut', statutFilter);

      const [studs, ped] = await Promise.all([
        apiFetch<StudentRecord[]>(`/api/admin/students?${params.toString()}`),
        apiFetch<PedagogyLookup>('/api/admin/pedagogy'),
      ]);
      setStudents(studs);
      setLookup({ filieres: ped.filieres, classes: ped.classes });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement étudiants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [filiereId, statutFilter]);

  useEffect(() => {
    if (!intent) return;
    if (intent.createTick && lookup.classes.length >= 0) {
      openCreate();
      onClearIntent?.();
      return;
    }
    if (intent.inspectId && students.length > 0) {
      const target = students.find((s) => s.id === intent.inspectId);
      if (target) {
        void openDossier(target);
        onClearIntent?.();
      }
      return;
    }
    if (intent.editId && students.length > 0) {
      const target = students.find((s) => s.id === intent.editId);
      if (target) {
        openEdit(target);
        onClearIntent?.();
      }
    }
  }, [intent, students, lookup.classes.length]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setForm({
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      date_naissance: '2004-01-15',
      adresse: '',
      contact_urgence: '',
      classe_id: lookup.classes[0] ? String(lookup.classes[0].id) : '',
      matricule: '',
      password: '',
    });
    setShowForm(true);
  };

  const openEdit = (s: StudentRecord) => {
    setEditing(s);
    setFormError(null);
    setForm({
      nom: s.nom,
      prenom: s.prenom,
      email: s.email,
      telephone: s.telephone || '',
      date_naissance: s.date_naissance || '',
      adresse: s.adresse || '',
      contact_urgence: s.contact_urgence || '',
      classe_id: s.classe_id ? String(s.classe_id) : '',
      matricule: s.matricule,
      password: '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setError(null);
    setSuccessBanner(null);
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/admin/students/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...form,
            classe_id: form.classe_id ? Number(form.classe_id) : null,
          }),
        });
        setShowForm(false);
        setSuccessBanner(`Dossier de ${form.prenom} ${form.nom} mis à jour.`);
        await loadData();
      } else {
        const created = await apiFetch<StudentRecord>('/api/admin/students', {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            classe_id: form.classe_id ? Number(form.classe_id) : null,
            password: form.password.trim() || undefined,
          }),
        });
        setShowForm(false);
        setQ('');
        setFiliereId('');
        setStatutFilter('');
        setSuccessBanner(
          `Étudiant créé : ${created.prenom} ${created.nom} (${created.matricule}) — Identifiant : ${created.email} · Mot de passe : ${form.password.trim() || 'Etudiant2026!'}`
        );
        const [studs, ped] = await Promise.all([
          apiFetch<StudentRecord[]>('/api/admin/students'),
          apiFetch<PedagogyLookup>('/api/admin/pedagogy'),
        ]);
        setStudents(studs);
        setLookup({ filieres: ped.filieres, classes: ped.classes });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Impossible d’enregistrer cet étudiant.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (s: StudentRecord) => {
    const nextStatut = s.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF';
    try {
      await apiFetch(`/api/admin/students/${s.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ statut: nextStatut }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur changement statut');
    }
  };

  const handleDelete = async (s: StudentRecord) => {
    try {
      await apiFetch(`/api/admin/students/${s.id}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur suppression');
    }
  };

  const openDossier = async (s: StudentRecord) => {
    try {
      const data = await apiFetch<{
        student: StudentRecord;
        transcript: TranscriptData;
        payments: PaymentRecord[];
        documents: DocumentRecord[];
      }>(`/api/admin/students/${s.id}/dossier`);
      setDossier(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur ouverture dossier');
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportResult(null);
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      setImportResult('Le fichier doit contenir une ligne d’en-tête et au moins un étudiant.');
      return;
    }
    const headers = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
    const parsed = lines.slice(1).map((line) => {
      const cols = line.split(/[;,]/).map((c) => c.trim().replace(/^"|"$/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = cols[idx] || '';
      });
      return obj;
    });

    try {
      const res = await apiFetch<{ imported: number; skipped: number }>('/api/admin/students/import', {
        method: 'POST',
        body: JSON.stringify({ students: parsed }),
      });
      setImportResult(`${res.imported} étudiant(s) importé(s), ${res.skipped} ignoré(s).`);
      await loadData();
    } catch (err) {
      setImportResult(err instanceof Error ? err.message : 'Erreur import');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Gestion des étudiants
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Dossiers académiques, attribution de matricules uniques et import/export CSV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Importer CSV</span>
          </button>
          <button
            type="button"
            onClick={() => void apiDownloadCsv('/api/admin/students/export', 'etudiants-academia-ha.csv')}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exporter CSV</span>
          </button>
          <button
            type="button"
            onClick={() => (onOpenCreatePage ? onOpenCreatePage() : openCreate())}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Ajouter un étudiant</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {successBanner && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <span>{successBanner}</span>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-xs font-semibold underline"
          >
            Fermer
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/80 dark:bg-[#111114]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadData();
          }}
          className="relative min-w-[240px] flex-1"
        >
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par nom, matricule, email ou filière..."
            className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pr-3 pl-10 text-sm text-zinc-900 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-[#16161B] dark:text-white dark:focus:border-zinc-600"
          />
        </form>

        <select
          value={filiereId}
          onChange={(e) => setFiliereId(e.target.value)}
          className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-100"
        >
          <option value="">Toutes les filières</option>
          {lookup.filieres.map((f) => (
            <option key={f.id} value={f.id}>
              {f.code} — {f.nom}
            </option>
          ))}
        </select>

        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-100"
        >
          <option value="">Tous statuts</option>
          <option value="ACTIF">Actifs</option>
          <option value="INACTIF">Désactivés</option>
          <option value="DIPLOME">Diplômés</option>
        </select>

        <button
          type="button"
          onClick={() => void loadData()}
          className="h-9 rounded-lg border border-zinc-200 bg-zinc-100 px-4 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-200 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Rechercher
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3.5">Matricule</th>
                <th className="px-5 py-3.5">Étudiant</th>
                <th className="px-5 py-3.5">Classe & Filière</th>
                <th className="px-5 py-3.5 text-right">Moyenne</th>
                <th className="px-5 py-3.5 text-right">Scolarité payée</th>
                <th className="px-5 py-3.5">Statut</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-zinc-500">
                    Chargement des dossiers...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-zinc-500">
                    Aucun étudiant ne correspond aux filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const initials = `${s.prenom[0] || ''}${s.nom[0] || ''}`.toUpperCase();
                  return (
                    <tr
                      key={s.id}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-[#16161B]"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                        {s.matricule}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 font-display text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-950 dark:text-zinc-100">
                              {s.prenom} {s.nom}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-zinc-800 dark:text-zinc-200">
                          {s.classeNom || 'Non affecté'}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {s.filiereNom || '—'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                        {s.moyenneGenerale !== null && s.moyenneGenerale !== undefined
                          ? `${Number(s.moyenneGenerale).toFixed(2)}/20`
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                        {Number(s.totalPaye || 0).toLocaleString('fr-FR')} /{' '}
                        {Number(s.fraisAnnuels || 0).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold">
                        <span
                          className={
                            s.statut === 'ACTIF'
                              ? 'rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                              : 'rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                          }
                        >
                          {s.statut === 'ACTIF' ? 'Actif' : s.statut === 'INACTIF' ? 'Désactivé' : 'Diplômé'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void openDossier(s)}
                            title="Consulter le dossier académique"
                            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            title="Modifier l’étudiant"
                            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleStatus(s)}
                            title={s.statut === 'ACTIF' ? 'Désactiver le compte' : 'Réactiver le compte'}
                            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-amber-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-amber-400"
                          >
                            {s.statut === 'ACTIF' ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(s)}
                            title="Supprimer définitivement"
                            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Animated Create / Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: EASE_PRO }}
              className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#111114]"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
                <h2 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
                  {editing ? `Modifier ${editing.prenom} ${editing.nom}` : 'Nouvel étudiant'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                >
                  {formError}
                </div>
              )}

              <form onSubmit={handleSave} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Prénom *</label>
                  <input
                    required
                    value={form.prenom}
                    onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nom *</label>
                  <input
                    required
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Email institutionnel *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="prenom.nom@etudiant.academie-ha.edu"
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Classe</label>
                  <select
                    value={form.classe_id}
                    onChange={(e) => setForm({ ...form, classe_id: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                  >
                    <option value="">Non affectée</option>
                    {lookup.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Matricule {!editing && '(auto si vide)'}
                  </label>
                  <input
                    value={form.matricule}
                    disabled={Boolean(editing)}
                    onChange={(e) => setForm({ ...form, matricule: e.target.value })}
                    placeholder="MAT-2026-XXX"
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 font-mono text-sm disabled:opacity-60 dark:border-zinc-800 dark:bg-[#16161B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Téléphone</label>
                  <input
                    value={form.telephone}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Date de naissance
                  </label>
                  <input
                    type="date"
                    value={form.date_naissance}
                    onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                  />
                </div>
                {!editing && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Mot de passe initial (optionnel)
                    </label>
                    <input
                      type="text"
                      minLength={6}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Etudiant2026! par défaut"
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                    />
                  </div>
                )}
                <div className={editing ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Adresse</label>
                  <input
                    value={form.adresse}
                    onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Contact d’urgence
                  </label>
                  <input
                    value={form.contact_urgence}
                    onChange={(e) => setForm({ ...form, contact_urgence: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="h-9 rounded-lg border border-zinc-200 px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-9 rounded-lg bg-zinc-950 px-5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    {saving ? 'Enregistrement...' : editing ? 'Enregistrer' : 'Créer le dossier'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Animated Import CSV Modal */}
      <AnimatePresence>
        {showImport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImport(false)}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: EASE_PRO }}
              className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#111114]"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
                <h2 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
                  Importer une liste d’étudiants (CSV)
                </h2>
                <button
                  type="button"
                  onClick={() => setShowImport(false)}
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleImportCsv} className="mt-4 space-y-4">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Collez vos lignes CSV séparées par <code>;</code> ou chargez un fichier <code>.csv</code>. Mot de
                  passe initial attribué : <code className="font-mono">Etudiant2026!</code>
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) setCsvText(await file.text());
                  }}
                  className="block w-full text-xs text-zinc-600 dark:text-zinc-300"
                />
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-800 dark:bg-[#16161B]"
                />
                {importResult && (
                  <div className="rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                    {importResult}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImport(false)}
                    className="h-9 rounded-lg border border-zinc-200 px-4 text-xs font-semibold dark:border-zinc-800"
                  >
                    Fermer
                  </button>
                  <button
                    type="submit"
                    className="h-9 rounded-lg bg-zinc-950 px-5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    Lancer l’import
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-Over Academic Dossier Drawer */}
      <SlideOverDrawer
        open={Boolean(dossier)}
        onClose={() => setDossier(null)}
        title={dossier ? `${dossier.student.prenom} ${dossier.student.nom}` : ''}
        subtitle={
          dossier
            ? `${dossier.student.matricule} · ${dossier.student.filiereNom || ''} · ${dossier.student.classeNom || ''}`
            : ''
        }
        headerActions={
          dossier && (
            <button
              type="button"
              onClick={() => downloadTranscriptPdf(dossier.student, dossier.transcript)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-3.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Relevé PDF</span>
            </button>
          )
        }
      >
        {dossier && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-[#16161B]">
                <div className="text-xs text-zinc-500">Moyenne annuelle</div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
                  {dossier.transcript.annualAverage !== null
                    ? `${dossier.transcript.annualAverage.toFixed(2)}/20`
                    : '—'}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-[#16161B]">
                <div className="text-xs text-zinc-500">Crédits ECTS</div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
                  {dossier.transcript.totalCreditsObtenus} / {dossier.transcript.totalCredits}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-[#16161B]">
                <div className="text-xs text-zinc-500">Paiements cumulés</div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums">
                  {dossier.payments
                    .reduce((acc, p) => acc + Number(p.montant), 0)
                    .toLocaleString('fr-FR')}{' '}
                  FCFA
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                Notes enregistrées ({dossier.transcript.rawNotes.length})
              </h3>
              <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-600 dark:bg-[#16161B] dark:text-zinc-400">
                    <tr>
                      <th className="px-3.5 py-2.5">Sem.</th>
                      <th className="px-3.5 py-2.5">Matière</th>
                      <th className="px-3.5 py-2.5">Type</th>
                      <th className="px-3.5 py-2.5 text-right">Note</th>
                      <th className="px-3.5 py-2.5">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {dossier.transcript.rawNotes.map((n) => (
                      <tr key={n.id}>
                        <td className="px-3.5 py-2.5 font-mono">{n.semestre}</td>
                        <td className="px-3.5 py-2.5 font-medium">{n.matiereNom}</td>
                        <td className="px-3.5 py-2.5">{n.typeEvaluation}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-semibold tabular-nums">
                          {Number(n.valeur).toFixed(2)}/20
                        </td>
                        <td className="px-3.5 py-2.5">{n.publie ? 'Publiée' : 'Brouillon'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
};
