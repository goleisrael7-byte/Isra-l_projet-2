import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { TimetableSlot } from '../../types';

interface PedagogyData {
  filieres: { id: number; code: string; nom: string; description: string; frais_annuels: number }[];
  niveaux: { id: number; code: string; nom: string; ordre: number }[];
  classes: {
    id: number;
    nom: string;
    filiereNom: string;
    niveauNom: string;
    capacite: number;
    salle_principale: string;
    effectif: number;
  }[];
  ues: {
    id: number;
    code: string;
    nom: string;
    filiereCode: string;
    niveauCode: string;
    semestre: string;
    credits: number;
  }[];
  matieres: {
    id: number;
    code: string;
    nom: string;
    ueCode: string;
    semestre: string;
    coefficient: number;
    enseignantNom: string | null;
    volume_horaire: number;
  }[];
  enseignants: {
    id: number;
    matricule: string;
    nom: string;
    prenom: string;
    email: string;
    specialite: string;
  }[];
  timetable: TimetableSlot[];
}

type PedTab = 'filieres' | 'classes' | 'matieres' | 'enseignants' | 'edt';

export const AdminPedagogy: React.FC = () => {
  const [tab, setTab] = useState<PedTab>('filieres');
  const [data, setData] = useState<PedagogyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filiereForm, setFiliereForm] = useState({ code: '', nom: '', description: '', frais_annuels: '1400000' });
  const [classeForm, setClasseForm] = useState({ nom: '', filiere_id: '', niveau_id: '', capacite: '35', salle_principale: '' });
  const [ueForm, setUeForm] = useState({ code: '', nom: '', filiere_id: '', niveau_id: '', semestre: 'S1', credits: '6' });
  const [matForm, setMatForm] = useState({ code: '', nom: '', ue_id: '', coefficient: '3', enseignant_id: '', volume_horaire: '36' });
  const [ensForm, setEnsForm] = useState({ nom: '', prenom: '', email: '', specialite: '' });
  const [edtForm, setEdtForm] = useState({
    classe_id: '',
    matiere_id: '',
    enseignant_id: '',
    jour_semaine: 'Lundi',
    heure_debut: '08:30',
    heure_fin: '10:30',
    salle: 'Labo 201',
    type_cours: 'CM',
  });

  const load = async () => {
    try {
      const res = await apiFetch<PedagogyData>('/api/admin/pedagogy');
      setData(res);
      if (res.filieres[0] && !classeForm.filiere_id) {
        setClasseForm((f) => ({ ...f, filiere_id: String(res.filieres[0].id), niveau_id: String(res.niveaux[0]?.id || '') }));
        setUeForm((f) => ({ ...f, filiere_id: String(res.filieres[0].id), niveau_id: String(res.niveaux[0]?.id || '') }));
      }
      if (res.ues[0] && !matForm.ue_id) {
        setMatForm((f) => ({ ...f, ue_id: String(res.ues[0].id), enseignant_id: String(res.enseignants[0]?.id || '') }));
      }
      if (res.classes[0] && !edtForm.classe_id) {
        setEdtForm((f) => ({
          ...f,
          classe_id: String(res.classes[0].id),
          matiere_id: String(res.matieres[0]?.id || ''),
          enseignant_id: String(res.enseignants[0]?.id || ''),
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement pédagogie');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!data) {
    return <div className="py-10 text-center text-sm text-slate-500">Chargement de la structure pédagogique...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Gestion pédagogique
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Filières, niveaux, classes, unités d’enseignement, matières, enseignants et emplois du temps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-[#111114]">
          {(
            [
              ['filieres', 'Filières'],
              ['classes', 'Classes & Niveaux'],
              ['matieres', 'UE & Matières'],
              ['enseignants', 'Enseignants'],
              ['edt', 'Emplois du temps'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tab === id
                  ? 'text-white dark:text-zinc-950'
                  : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {tab === id && (
                <motion.span
                  layoutId="pedagogy-tab-pill"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  className="absolute inset-0 rounded-lg bg-zinc-950 shadow-xs dark:bg-white"
                />
              )}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {tab === 'filieres' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await apiFetch('/api/admin/filieres', {
                  method: 'POST',
                  body: JSON.stringify({ ...filiereForm, frais_annuels: Number(filiereForm.frais_annuels) }),
                });
                setFiliereForm({ code: '', nom: '', description: '', frais_annuels: '1400000' });
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur création filière');
              }
            }}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <h2 className="font-display text-base font-semibold">Nouvelle filière</h2>
            <input
              required
              placeholder="Code (ex: IA)"
              value={filiereForm.code}
              onChange={(e) => setFiliereForm({ ...filiereForm, code: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <input
              required
              placeholder="Intitulé complet"
              value={filiereForm.nom}
              onChange={(e) => setFiliereForm({ ...filiereForm, nom: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <input
              type="number"
              required
              placeholder="Frais annuels (FCFA)"
              value={filiereForm.frais_annuels}
              onChange={(e) => setFiliereForm({ ...filiereForm, frais_annuels: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <textarea
              rows={2}
              placeholder="Description pédagogique"
              value={filiereForm.description}
              onChange={(e) => setFiliereForm({ ...filiereForm, description: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Créer la filière</span>
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8 dark:border-zinc-800/80 dark:bg-[#111114]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Filière</th>
                  <th className="px-4 py-3 text-right">Frais annuels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.filieres.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#1E3A8A] dark:text-blue-400">
                      {f.code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{f.nom}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{f.description}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {Number(f.frais_annuels).toLocaleString('fr-FR')} FCFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'classes' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await apiFetch('/api/admin/classes', {
                  method: 'POST',
                  body: JSON.stringify({
                    ...classeForm,
                    filiere_id: Number(classeForm.filiere_id),
                    niveau_id: Number(classeForm.niveau_id),
                    capacite: Number(classeForm.capacite),
                  }),
                });
                setClasseForm({ ...classeForm, nom: '', salle_principale: '' });
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur création classe');
              }
            }}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <h2 className="font-display text-base font-semibold">Nouvelle classe</h2>
            <input
              required
              placeholder="Nom de la classe (ex: L3-GL-B)"
              value={classeForm.nom}
              onChange={(e) => setClasseForm({ ...classeForm, nom: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <select
              value={classeForm.filiere_id}
              onChange={(e) => setClasseForm({ ...classeForm, filiere_id: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              {data.filieres.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
            <select
              value={classeForm.niveau_id}
              onChange={(e) => setClasseForm({ ...classeForm, niveau_id: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              {data.niveaux.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.code} — {n.nom}
                </option>
              ))}
            </select>
            <input
              placeholder="Salle principale"
              value={classeForm.salle_principale}
              onChange={(e) => setClasseForm({ ...classeForm, salle_principale: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Ajouter la classe</span>
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8 dark:border-zinc-800/80 dark:bg-[#111114]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Classe</th>
                  <th className="px-4 py-3">Filière & Niveau</th>
                  <th className="px-4 py-3">Salle</th>
                  <th className="px-4 py-3 text-right">Effectif / Capacité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.classes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono font-semibold text-[#0F294A] dark:text-blue-400">
                      {c.nom}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.filiereNom}</div>
                      <div className="text-xs text-slate-500">{c.niveauNom}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{c.salle_principale}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {c.effectif} / {c.capacite}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'matieres' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  await apiFetch('/api/admin/ues', {
                    method: 'POST',
                    body: JSON.stringify({
                      ...ueForm,
                      filiere_id: Number(ueForm.filiere_id),
                      niveau_id: Number(ueForm.niveau_id),
                      credits: Number(ueForm.credits),
                    }),
                  });
                  setUeForm({ ...ueForm, code: '', nom: '' });
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Erreur création UE');
                }
              }}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]"
            >
              <h2 className="font-display text-base font-semibold">Nouvelle Unité d’Enseignement (UE)</h2>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  placeholder="Code UE"
                  value={ueForm.code}
                  onChange={(e) => setUeForm({ ...ueForm, code: e.target.value })}
                  className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                />
                <select
                  value={ueForm.semestre}
                  onChange={(e) => setUeForm({ ...ueForm, semestre: e.target.value })}
                  className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                >
                  <option value="S1">Semestre 1</option>
                  <option value="S2">Semestre 2</option>
                </select>
              </div>
              <input
                required
                placeholder="Intitulé de l’UE"
                value={ueForm.nom}
                onChange={(e) => setUeForm({ ...ueForm, nom: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={ueForm.filiere_id}
                  onChange={(e) => setUeForm({ ...ueForm, filiere_id: e.target.value })}
                  className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs dark:border-zinc-800 dark:bg-[#16161B]"
                >
                  {data.filieres.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code}
                    </option>
                  ))}
                </select>
                <select
                  value={ueForm.niveau_id}
                  onChange={(e) => setUeForm({ ...ueForm, niveau_id: e.target.value })}
                  className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs dark:border-zinc-800 dark:bg-[#16161B]"
                >
                  {data.niveaux.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.code}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="h-10 w-full rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Ajouter l’UE
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  await apiFetch('/api/admin/matieres', {
                    method: 'POST',
                    body: JSON.stringify({
                      ...matForm,
                      ue_id: Number(matForm.ue_id),
                      coefficient: Number(matForm.coefficient),
                      enseignant_id: matForm.enseignant_id ? Number(matForm.enseignant_id) : null,
                      volume_horaire: Number(matForm.volume_horaire),
                    }),
                  });
                  setMatForm({ ...matForm, code: '', nom: '' });
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Erreur création matière');
                }
              }}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]"
            >
              <h2 className="font-display text-base font-semibold">Nouvelle matière</h2>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  placeholder="Code (INF-308)"
                  value={matForm.code}
                  onChange={(e) => setMatForm({ ...matForm, code: e.target.value })}
                  className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                />
                <input
                  type="number"
                  step="0.5"
                  required
                  placeholder="Coeff."
                  value={matForm.coefficient}
                  onChange={(e) => setMatForm({ ...matForm, coefficient: e.target.value })}
                  className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm dark:border-zinc-800 dark:bg-[#16161B]"
                />
              </div>
              <input
                required
                placeholder="Nom de la matière"
                value={matForm.nom}
                onChange={(e) => setMatForm({ ...matForm, nom: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              />
              <select
                value={matForm.ue_id}
                onChange={(e) => setMatForm({ ...matForm, ue_id: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              >
                {data.ues.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} ({u.semestre}) — {u.nom}
                  </option>
                ))}
              </select>
              <select
                value={matForm.enseignant_id}
                onChange={(e) => setMatForm({ ...matForm, enseignant_id: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              >
                <option value="">Enseignant à affecter</option>
                {data.enseignants.map((ens) => (
                  <option key={ens.id} value={ens.id}>
                    {ens.prenom} {ens.nom}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-10 w-full rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Ajouter la matière
              </button>
            </form>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8 dark:border-zinc-800/80 dark:bg-[#111114]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Matière & UE</th>
                  <th className="px-4 py-3">Enseignant</th>
                  <th className="px-4 py-3 text-right">Coeff.</th>
                  <th className="px-4 py-3 text-right">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.matieres.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1E3A8A] dark:text-blue-400">
                      {m.code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{m.nom}</div>
                      <div className="text-xs text-slate-500">
                        {m.ueCode} · {m.semestre}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                      {m.enseignantNom || 'Non affecté'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums">
                      {m.coefficient}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {m.volume_horaire}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'enseignants' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await apiFetch('/api/admin/enseignants', {
                  method: 'POST',
                  body: JSON.stringify(ensForm),
                });
                setEnsForm({ nom: '', prenom: '', email: '', specialite: '' });
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur création enseignant');
              }
            }}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <h2 className="font-display text-base font-semibold">Recruter un enseignant</h2>
            <input
              required
              placeholder="Prénom"
              value={ensForm.prenom}
              onChange={(e) => setEnsForm({ ...ensForm, prenom: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <input
              required
              placeholder="Nom"
              value={ensForm.nom}
              onChange={(e) => setEnsForm({ ...ensForm, nom: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <input
              type="email"
              required
              placeholder="Email institutionnel"
              value={ensForm.email}
              onChange={(e) => setEnsForm({ ...ensForm, email: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <input
              required
              placeholder="Spécialité (ex: Réseaux & Cloud)"
              value={ensForm.specialite}
              onChange={(e) => setEnsForm({ ...ensForm, specialite: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <button
              type="submit"
              className="h-10 w-full rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Créer le profil enseignant
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8 dark:border-zinc-800/80 dark:bg-[#111114]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Matricule</th>
                  <th className="px-4 py-3">Enseignant</th>
                  <th className="px-4 py-3">Spécialité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.enseignants.map((ens) => (
                  <tr key={ens.id}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1E3A8A] dark:text-blue-400">
                      {ens.matricule}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {ens.prenom} {ens.nom}
                      </div>
                      <div className="text-xs text-slate-500">{ens.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">{ens.specialite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'edt' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await apiFetch('/api/admin/timetable', {
                  method: 'POST',
                  body: JSON.stringify({
                    ...edtForm,
                    classe_id: Number(edtForm.classe_id),
                    matiere_id: Number(edtForm.matiere_id),
                    enseignant_id: edtForm.enseignant_id ? Number(edtForm.enseignant_id) : null,
                  }),
                });
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur création créneau');
              }
            }}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <h2 className="font-display text-base font-semibold">Planifier un cours</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Les étudiants de la classe reçoivent automatiquement une notification.
            </p>
            <select
              value={edtForm.classe_id}
              onChange={(e) => setEdtForm({ ...edtForm, classe_id: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              {data.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
            <select
              value={edtForm.matiere_id}
              onChange={(e) => setEdtForm({ ...edtForm, matiere_id: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              {data.matieres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.nom}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={edtForm.jour_semaine}
                onChange={(e) => setEdtForm({ ...edtForm, jour_semaine: e.target.value })}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              >
                {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
              <select
                value={edtForm.type_cours}
                onChange={(e) => setEdtForm({ ...edtForm, type_cours: e.target.value })}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              >
                <option value="CM">Cours Magistral</option>
                <option value="TD">TD</option>
                <option value="TP">TP</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={edtForm.heure_debut}
                onChange={(e) => setEdtForm({ ...edtForm, heure_debut: e.target.value })}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              />
              <input
                type="time"
                value={edtForm.heure_fin}
                onChange={(e) => setEdtForm({ ...edtForm, heure_fin: e.target.value })}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              />
            </div>
            <input
              required
              placeholder="Salle (ex: Labo Cloud 305)"
              value={edtForm.salle}
              onChange={(e) => setEdtForm({ ...edtForm, salle: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <button
              type="submit"
              className="h-10 w-full rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Ajouter le créneau
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8 dark:border-zinc-800/80 dark:bg-[#111114]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Jour & Horaire</th>
                  <th className="px-4 py-3">Classe</th>
                  <th className="px-4 py-3">Matière</th>
                  <th className="px-4 py-3">Salle</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.timetable.map((slot) => (
                  <tr key={slot.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{slot.jour_semaine}</div>
                      <div className="font-mono text-xs tabular-nums text-slate-500">
                        {slot.heure_debut} – {slot.heure_fin} · {slot.type_cours}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1E3A8A] dark:text-blue-400">
                      {slot.classeNom}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{slot.matiereNom}</div>
                      <div className="text-xs text-slate-500">{slot.enseignantNom || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{slot.salle}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/timetable/${slot.id}`, { method: 'DELETE' });
                          await load();
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
