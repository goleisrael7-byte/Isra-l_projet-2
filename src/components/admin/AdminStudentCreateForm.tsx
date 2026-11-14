import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Hash,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import type { StudentRecord } from '../../types';
import type { AdminSection, FinanceTab } from '../AdminPortal';

interface ClassOption {
  id: number;
  nom: string;
  filiere_id: number | null;
  filiereNom?: string | null;
  filiereCode?: string | null;
  niveauNom?: string | null;
  fraisAnnuels?: number | null;
  annee_academique?: string;
  capacite?: number;
  effectif?: number;
}

interface CreatedStudentResponse extends StudentRecord {
  initialPassword?: string;
}

interface AdminStudentCreateFormProps {
  onNavigate: (
    target: AdminSection,
    options?: {
      financeTab?: FinanceTab;
      inspectStudentId?: number;
      editStudentId?: number;
      createStudent?: boolean;
    }
  ) => void;
}

function slugifyEmailPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function computeAge(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const dob = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;
  const diffYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (diffYears < 0 || diffYears > 120) return null;
  return Math.floor(diffYears);
}

const INITIAL_FORM = {
  prenom: '',
  nom: '',
  date_naissance: '2004-05-15',
  telephone: '',
  adresse: '',
  contact_urgence: '',
  classe_id: '',
  annee_academique: '2025-2026',
  type_inscription: 'NOUVELLE' as 'NOUVELLE' | 'REINSCRIPTION',
  matriculeMode: 'AUTO' as 'AUTO' | 'MANUAL',
  matricule: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export const AdminStudentCreateForm: React.FC<AdminStudentCreateFormProps> = ({ onNavigate }) => {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [nextMatricule, setNextMatricule] = useState<string>('MAT-2026-...');
  const [loadingInit, setLoadingInit] = useState(true);
  const [refreshingMat, setRefreshingMat] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);
  const [showPwd, setShowPwd] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdStudent, setCreatedStudent] = useState<CreatedStudentResponse | null>(null);

  const fetchInitialData = async (preserveForm = false) => {
    setRefreshingMat(true);
    try {
      const [ped, nextMat] = await Promise.all([
        apiFetch<{ classes: ClassOption[] }>('/api/admin/pedagogy'),
        apiFetch<{ matricule: string }>('/api/admin/students/next-matricule'),
      ]);
      setClasses(ped.classes);
      setNextMatricule(nextMat.matricule);
      if (!preserveForm) {
        setForm((prev) => ({
          ...prev,
          classe_id: prev.classe_id || (ped.classes[0] ? String(ped.classes[0].id) : ''),
        }));
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Impossible de charger les paramètres.');
    } finally {
      setLoadingInit(false);
      setRefreshingMat(false);
    }
  };

  useEffect(() => {
    void fetchInitialData();
  }, []);

  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === form.classe_id) || null,
    [classes, form.classe_id]
  );

  const age = useMemo(() => computeAge(form.date_naissance), [form.date_naissance]);

  const setField = <K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
    if (globalError) setGlobalError(null);
  };

  const handleGenerateEmail = () => {
    const p = slugifyEmailPart(form.prenom);
    const n = slugifyEmailPart(form.nom);
    if (!p && !n) {
      setFieldErrors((prev) => ({
        ...prev,
        email: 'Renseignez d’abord le prénom et le nom pour générer l’email.',
      }));
      return;
    }
    const local = [p, n].filter(Boolean).join('.');
    setField('email', `${local}@etudiant.academie-ha.edu`);
  };

  const validateClient = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    const prenom = form.prenom.trim();
    const nom = form.nom.trim();
    const email = form.email.trim().toLowerCase();
    const tel = form.telephone.trim();
    const dob = form.date_naissance.trim();
    const pwd = form.password.trim();
    const confirm = form.confirmPassword.trim();

    if (prenom.length < 2) {
      errs.prenom = 'Le prénom doit contenir au moins 2 caractères.';
    }
    if (nom.length < 2) {
      errs.nom = 'Le nom doit contenir au moins 2 caractères.';
    }
    if (!dob) {
      errs.date_naissance = 'La date de naissance est obligatoire.';
    } else if (age === null || age < 14 || age > 90) {
      errs.date_naissance = 'L’âge doit être compris entre 14 et 90 ans.';
    }
    if (tel && !/^[+\d\s().-]{7,25}$/.test(tel)) {
      errs.telephone = 'Numéro invalide (ex. +225 07 01 02 03 04).';
    }
    if (!form.classe_id) {
      errs.classe_id = 'Veuillez affecter l’étudiant à une classe.';
    }
    if (!/^\d{4}-\d{4}$/.test(form.annee_academique.trim())) {
      errs.annee_academique = 'Format attendu : 2025-2026.';
    }
    if (form.matriculeMode === 'MANUAL') {
      const mat = form.matricule.trim().toUpperCase();
      if (!mat) {
        errs.matricule = 'Saisissez un matricule ou passez en mode automatique.';
      } else if (!/^[A-Z0-9-]{4,30}$/.test(mat)) {
        errs.matricule = '4 à 30 caractères alphanumériques majuscules ou tirets (ex. MAT-2026-099).';
      }
    }
    if (!email) {
      errs.email = 'L’adresse email institutionnelle est obligatoire.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errs.email = 'Adresse email invalide.';
    }
    if (pwd) {
      if (pwd.length < 6) {
        errs.password = 'Le mot de passe doit contenir au moins 6 caractères.';
      }
      if (pwd !== confirm) {
        errs.confirmPassword = 'La confirmation ne correspond pas au mot de passe.';
      }
    } else if (confirm) {
      errs.password = 'Saisissez le mot de passe initial.';
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    const errs = validateClient();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setGlobalError('Veuillez corriger les champs signalés avant d’enregistrer.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiFetch<CreatedStudentResponse>('/api/admin/students', {
        method: 'POST',
        body: JSON.stringify({
          prenom: form.prenom.trim(),
          nom: form.nom.trim(),
          email: form.email.trim().toLowerCase(),
          telephone: form.telephone.trim(),
          date_naissance: form.date_naissance,
          adresse: form.adresse.trim(),
          contact_urgence: form.contact_urgence.trim(),
          classe_id: Number(form.classe_id),
          annee_academique: form.annee_academique.trim(),
          type_inscription: form.type_inscription,
          matricule: form.matriculeMode === 'MANUAL' ? form.matricule.trim().toUpperCase() : '',
          password: form.password.trim() || undefined,
        }),
      });
      setCreatedStudent(created);
      setFieldErrors({});
      await fetchInitialData(true);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
      setGlobalError(err instanceof Error ? err.message : 'Erreur lors de la création de l’étudiant.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForNew = async () => {
    setCreatedStudent(null);
    setFieldErrors({});
    setGlobalError(null);
    setForm({
      ...INITIAL_FORM,
      classe_id: classes[0] ? String(classes[0].id) : '',
    });
    await fetchInitialData(true);
  };

  const inputClass = (field: string) =>
    `mt-1.5 h-10 w-full rounded-lg border px-3 text-sm text-zinc-950 transition-colors focus:outline-none dark:text-white ${
      fieldErrors[field]
        ? 'border-red-500 bg-red-50/40 focus:border-red-500 dark:border-red-500/80 dark:bg-red-950/20'
        : 'border-zinc-200 bg-zinc-50 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-[#16161B] dark:focus:border-zinc-600'
    }`;

  const previewInitials = `${form.prenom.trim()[0] || 'E'}${form.nom.trim()[0] || 'T'}`.toUpperCase();
  const previewMatricule =
    form.matriculeMode === 'MANUAL' && form.matricule.trim()
      ? form.matricule.trim().toUpperCase()
      : nextMatricule;

  const readiness = [
    {
      label: 'Identité complète',
      ok: form.prenom.trim().length >= 2 && form.nom.trim().length >= 2 && age !== null && age >= 14,
    },
    {
      label: 'Email institutionnel valide',
      ok: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()),
    },
    {
      label: 'Classe & Filière affectées',
      ok: Boolean(selectedClass),
    },
    {
      label: 'Matricule unique prêt',
      ok: form.matriculeMode === 'AUTO' || /^[A-Z0-9-]{4,30}$/.test(form.matricule.trim().toUpperCase()),
    },
  ];

  if (createdStudent) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
              Étudiant enregistré en base de données
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Compte utilisateur, dossier académique, inscription et notification de bienvenue créés atomiquement.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('students')}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Liste des étudiants</span>
          </button>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-white p-6 dark:border-emerald-500/30 dark:bg-[#111114]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800/80">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <div className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  INSCRIPTION VALIDÉE · {createdStudent.matricule}
                </div>
                <h2 className="font-display mt-0.5 text-xl font-bold text-zinc-950 dark:text-white">
                  {createdStudent.prenom} {createdStudent.nom}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {createdStudent.filiereNom || 'Filière générale'} · {createdStudent.classeNom || 'Non affecté'}
                </p>
              </div>
            </div>
            <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              ACTIF
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-zinc-800/80 dark:bg-[#16161B]">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Matricule unique attribué</div>
              <div className="mt-1 font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                {createdStudent.matricule}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-zinc-800/80 dark:bg-[#16161B]">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Identifiant de connexion</div>
              <div className="mt-1 truncate font-mono text-sm font-semibold text-zinc-950 dark:text-white">
                {createdStudent.email}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-zinc-800/80 dark:bg-[#16161B]">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Mot de passe initial</div>
              <div className="mt-1 font-mono text-sm font-semibold text-zinc-950 dark:text-white">
                {createdStudent.initialPassword || 'Etudiant2026!'}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleResetForNew()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <UserPlus className="h-4 w-4" />
              <span>Ajouter un autre étudiant</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('students', { inspectStudentId: createdStudent.id })}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Eye className="h-4 w-4" />
              <span>Consulter le dossier</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('students')}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              <span>Retour à l’annuaire</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Ajouter un étudiant
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Validation complète des données, attribution automatique de matricule unique et enregistrement en base.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('students')}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Liste des étudiants</span>
        </button>
      </div>

      {globalError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Form Sections */}
        <div className="space-y-6 lg:col-span-8">
          {/* Section 1: Identity */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800/80">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                  1. Identité & État civil
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Informations personnelles vérifiées de l’étudiant.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.prenom}
                  onChange={(e) => setField('prenom', e.target.value)}
                  placeholder="Ex. Amina"
                  className={inputClass('prenom')}
                />
                {fieldErrors.prenom && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.prenom}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Nom de famille <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => setField('nom', e.target.value)}
                  placeholder="Ex. Diallo"
                  className={inputClass('nom')}
                />
                {fieldErrors.nom && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.nom}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Date de naissance <span className="text-red-500">*</span>
                  </label>
                  {age !== null && (
                    <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{age} ans</span>
                  )}
                </div>
                <input
                  type="date"
                  value={form.date_naissance}
                  onChange={(e) => setField('date_naissance', e.target.value)}
                  className={inputClass('date_naissance')}
                />
                {fieldErrors.date_naissance && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.date_naissance}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Téléphone mobile
                </label>
                <input
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => setField('telephone', e.target.value)}
                  placeholder="+225 07 01 02 03 04"
                  className={inputClass('telephone')}
                />
                {fieldErrors.telephone && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.telephone}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Adresse de résidence
                </label>
                <input
                  type="text"
                  value={form.adresse}
                  onChange={(e) => setField('adresse', e.target.value)}
                  placeholder="Quartier, rue, ville..."
                  className={inputClass('adresse')}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Contact d’urgence (nom & téléphone)
                </label>
                <input
                  type="text"
                  value={form.contact_urgence}
                  onChange={(e) => setField('contact_urgence', e.target.value)}
                  placeholder="Ex. M. Ibrahim Diallo (+225 05 00 11 22 33)"
                  className={inputClass('contact_urgence')}
                />
              </div>
            </div>
          </section>

          {/* Section 2: Academic Assignment & Unique Matricule */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800/80">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                  2. Affectation académique & Matricule unique
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Classe d’inscription et génération anti-collision du matricule étudiant.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Classe & Filière d’affectation <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.classe_id}
                  onChange={(e) => setField('classe_id', e.target.value)}
                  disabled={loadingInit}
                  className={inputClass('classe_id')}
                >
                  <option value="">Sélectionner une classe...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom} — {c.filiereNom || 'Filière'} ({c.effectif ?? 0}/{c.capacite ?? 40} inscrits)
                    </option>
                  ))}
                </select>
                {fieldErrors.classe_id && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.classe_id}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Année académique <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.annee_academique}
                  onChange={(e) => setField('annee_academique', e.target.value)}
                  className={inputClass('annee_academique')}
                >
                  <option value="2025-2026">2025-2026</option>
                  <option value="2026-2027">2026-2027</option>
                  <option value="2024-2025">2024-2025</option>
                </select>
                {fieldErrors.annee_academique && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.annee_academique}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Type d’inscription
                </label>
                <div className="mt-1.5 grid h-10 grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-[#16161B]">
                  {(['NOUVELLE', 'REINSCRIPTION'] as const).map((t) => {
                    const active = form.type_inscription === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setField('type_inscription', t)}
                        className={`rounded-md text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                            : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                        }`}
                      >
                        {t === 'NOUVELLE' ? 'Nouvelle' : 'Réinscription'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Matricule attribution block */}
              <div className="sm:col-span-2 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800/80 dark:bg-[#16161B]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    <Hash className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Attribution du matricule unique</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-[#111114]">
                    <button
                      type="button"
                      onClick={() => setField('matriculeMode', 'AUTO')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        form.matriculeMode === 'AUTO'
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      Automatique
                    </button>
                    <button
                      type="button"
                      onClick={() => setField('matriculeMode', 'MANUAL')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        form.matriculeMode === 'MANUAL'
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      Personnalisé
                    </button>
                  </div>
                </div>

                {form.matriculeMode === 'AUTO' ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-base font-bold tabular-nums text-blue-600 dark:text-blue-400">
                        {nextMatricule}
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Séquence unique vérifiée automatiquement contre toute collision en base SQLite.
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={refreshingMat}
                      onClick={() => void fetchInitialData(true)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshingMat ? 'animate-spin' : ''}`} />
                      <span>Actualiser</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={form.matricule}
                      onChange={(e) => setField('matricule', e.target.value.toUpperCase())}
                      placeholder="Ex. MAT-2026-099"
                      className={`${inputClass('matricule')} font-mono uppercase`}
                    />
                    {fieldErrors.matricule && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.matricule}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Student Account Credentials */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800/80">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                  3. Identifiants Portail Étudiant
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Accès sécurisé JWT pour consulter les notes, l’emploi du temps et régler la scolarité.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Email institutionnel <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateEmail}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Générer depuis le nom</span>
                  </button>
                </div>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="prenom.nom@etudiant.academie-ha.edu"
                  className={inputClass('email')}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Mot de passe initial (optionnel)
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setField('password', e.target.value)}
                    placeholder="Etudiant2026! par défaut"
                    className={`${inputClass('password')} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    aria-label={showPwd ? 'Masquer' : 'Afficher'}
                    className="absolute right-2.5 top-1/2 mt-0.5 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Confirmer le mot de passe
                </label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setField('confirmPassword', e.target.value)}
                  placeholder="Répéter si personnalisé"
                  className={inputClass('confirmPassword')}
                />
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            </div>
          </section>

          {/* Bottom Submit Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800/80 dark:bg-[#111114]">
            <button
              type="button"
              onClick={() => {
                setForm({
                  ...INITIAL_FORM,
                  classe_id: classes[0] ? String(classes[0].id) : '',
                });
                setFieldErrors({});
                setGlobalError(null);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Réinitialiser</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('students')}
                className="h-9 rounded-lg border border-zinc-200 px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{submitting ? 'Enregistrement en cours...' : 'Créer le dossier étudiant'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Live Preview & Validation Checklist */}
        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Aperçu du dossier
            </div>

            <div className="mt-4 flex items-center gap-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-zinc-800/80 dark:bg-[#16161B]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 font-display text-sm font-bold text-white dark:bg-white dark:text-zinc-950">
                {previewInitials}
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-bold text-zinc-950 dark:text-white">
                  {form.prenom.trim() || 'Prénom'} {form.nom.trim() || 'Nom'}
                </div>
                <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {form.email.trim() || 'email@etudiant.academie-ha.edu'}
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {previewMatricule}
                </div>
              </div>
            </div>

            <dl className="mt-4 divide-y divide-zinc-200/80 text-xs dark:divide-zinc-800/70">
              <div className="flex justify-between gap-2 py-2.5">
                <dt className="text-zinc-500 dark:text-zinc-400">Classe</dt>
                <dd className="font-semibold text-zinc-950 dark:text-zinc-100">
                  {selectedClass ? selectedClass.nom : 'Non sélectionnée'}
                </dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5">
                <dt className="text-zinc-500 dark:text-zinc-400">Filière</dt>
                <dd className="text-right font-medium text-zinc-800 dark:text-zinc-200">
                  {selectedClass?.filiereNom || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5">
                <dt className="text-zinc-500 dark:text-zinc-400">Inscription</dt>
                <dd className="font-mono text-zinc-800 dark:text-zinc-200">
                  {form.type_inscription} · {form.annee_academique}
                </dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5">
                <dt className="text-zinc-500 dark:text-zinc-400">Frais de scolarité</dt>
                <dd className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {selectedClass?.fraisAnnuels
                    ? `${Number(selectedClass.fraisAnnuels).toLocaleString('fr-FR')} FCFA`
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Contrôles de validation
            </div>
            <ul className="mt-3.5 space-y-2.5">
              {readiness.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${
                      item.ok ? 'text-emerald-500' : 'text-zinc-300 dark:text-zinc-700'
                    }`}
                  />
                  <span className={item.ok ? 'font-medium text-zinc-950 dark:text-white' : ''}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-zinc-200/80 bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800/80 dark:bg-[#16161B] dark:text-zinc-400">
              Lors de la validation, l’étudiant reçoit automatiquement son matricule unique, son inscription validée et
              un message d’accueil dans son espace personnel.
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
};
