import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Plus, Send } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { downloadTranscriptPdf } from '../../lib/pdf';
import type { StudentRecord, TranscriptData } from '../../types';

interface GradeRow {
  id: number;
  eleve_id: number;
  matricule: string;
  eleveNom: string;
  elevePrenom: string;
  classeId: number;
  classeNom: string;
  matiere_id: number;
  matiereCode: string;
  matiereNom: string;
  coefficient: number;
  semestre: 'S1' | 'S2';
  type_evaluation: 'CC' | 'TP' | 'Examen';
  valeur: number;
  commentaire: string | null;
  publie: number;
}

interface Lookup {
  classes: { id: number; nom: string }[];
  matieres: { id: number; code: string; nom: string; semestre: string }[];
}

export const AdminGrades: React.FC = () => {
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [lookup, setLookup] = useState<Lookup>({ classes: [], matieres: [] });

  const [classeId, setClasseId] = useState('');
  const [semestre, setSemestre] = useState('S1');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    eleve_id: '',
    matiere_id: '',
    semestre: 'S1',
    type_evaluation: 'Examen',
    valeur: '15',
    commentaire: '',
    publie: true,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const load = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (classeId) params.set('classeId', classeId);
      if (semestre) params.set('semestre', semestre);

      const [gr, studs, ped] = await Promise.all([
        apiFetch<GradeRow[]>(`/api/admin/grades?${params.toString()}`),
        apiFetch<StudentRecord[]>('/api/admin/students'),
        apiFetch<Lookup>('/api/admin/pedagogy'),
      ]);
      setGrades(gr);
      setStudents(studs);
      setLookup({ classes: ped.classes, matieres: ped.matieres });

      if (!form.eleve_id && studs[0]) {
        setForm((f) => ({
          ...f,
          eleve_id: String(studs[0].id),
          matiere_id: String(ped.matieres[0]?.id || ''),
        }));
      }
      if (!classeId && ped.classes[0]) {
        setClasseId(String(ped.classes[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement notes');
    }
  };

  useEffect(() => {
    void load();
  }, [classeId, semestre]);

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/api/admin/grades', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          eleve_id: Number(form.eleve_id),
          matiere_id: Number(form.matiere_id),
          valeur: Number(form.valeur),
        }),
      });
      setMessage('Note enregistrée et moyennes recalculées.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur saisie note');
    }
  };

  const handlePublish = async () => {
    if (!classeId) return;
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ updated: number; publie: boolean }>('/api/admin/grades/publish', {
        method: 'POST',
        body: JSON.stringify({ classe_id: Number(classeId), semestre, publie: true }),
      });
      setMessage(`${res.updated} note(s) publiée(s) pour le semestre ${semestre} et notification envoyée aux étudiants.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur publication');
    }
  };

  const handleGenerateTranscript = async (eleveId: number) => {
    try {
      const data = await apiFetch<{ student: StudentRecord; transcript: TranscriptData }>(
        `/api/admin/grades/transcript/${eleveId}`
      );
      downloadTranscriptPdf(data.student, data.transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur génération relevé');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-950 dark:text-white">
            Gestion des notes et résultats
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Saisie pondérée, calcul automatique des moyennes, publication aux étudiants et relevés PDF.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handlePublish()}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 whitespace-nowrap shrink-0 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Publier résultats ({semestre})</span>
        </button>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleAddGrade}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-zinc-800/80 dark:bg-[#111114]"
        >
          <h2 className="font-display text-base font-semibold">Saisir une note</h2>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Étudiant</label>
            <select
              value={form.eleve_id}
              onChange={(e) => setForm({ ...form, eleve_id: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.matricule} — {s.prenom} {s.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Matière</label>
            <select
              value={form.matiere_id}
              onChange={(e) => setForm({ ...form, matiere_id: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              {lookup.matieres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Sem.</label>
              <select
                value={form.semestre}
                onChange={(e) => setForm({ ...form, semestre: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              >
                <option value="S1">S1</option>
                <option value="S2">S2</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Type</label>
              <select
                value={form.type_evaluation}
                onChange={(e) => setForm({ ...form, type_evaluation: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              >
                <option value="Examen">Examen</option>
                <option value="CC">CC</option>
                <option value="TP">TP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Note /20</label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="20"
                required
                value={form.valeur}
                onChange={(e) => setForm({ ...form, valeur: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 font-mono text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              />
            </div>
          </div>
          <input
            placeholder="Appréciation / commentaire"
            value={form.commentaire}
            onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.publie}
              onChange={(e) => setForm({ ...form, publie: e.target.checked })}
            />
            <span>Publier immédiatement à l’étudiant</span>
          </label>
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Enregistrer la note</span>
          </button>
        </form>

        <div className="space-y-4 lg:col-span-8">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800/80 dark:bg-[#111114]">
            <select
              value={classeId}
              onChange={(e) => setClasseId(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              <option value="">Toutes les classes</option>
              {lookup.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-[#16161B]">
              {['S1', 'S2'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSemestre(s)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    semestre === s
                      ? 'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Semestre {s}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Étudiant</th>
                  <th className="px-4 py-3">Matière</th>
                  <th className="px-4 py-3">Éval.</th>
                  <th className="px-4 py-3 text-right">Note /20</th>
                  <th className="px-4 py-3">Diffusion</th>
                  <th className="px-4 py-3 text-right">Relevé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {grades.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {g.elevePrenom} {g.eleveNom}
                      </div>
                      <div className="font-mono text-xs text-slate-500">
                        {g.matricule} · {g.classeNom}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{g.matiereNom}</div>
                      <div className="text-xs text-slate-500">Coeff. {g.coefficient}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{g.type_evaluation}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {editingId === g.id ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            await apiFetch(`/api/admin/grades/${g.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ valeur: Number(editValue), commentaire: g.commentaire || '' }),
                            });
                            setEditingId(null);
                            await load();
                          }}
                          className="inline-flex items-center gap-1"
                        >
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="20"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 w-16 rounded border border-slate-300 px-1.5 text-right text-xs dark:border-zinc-800 dark:bg-[#16161B]"
                          />
                          <button type="submit" className="text-xs font-semibold text-[#1E3A8A] dark:text-blue-400">
                            OK
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(g.id);
                            setEditValue(String(g.valeur));
                          }}
                          title="Cliquer pour modifier la note"
                          className={`rounded px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                            g.valeur >= 10
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {Number(g.valeur).toFixed(2)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={g.publie ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                        {g.publie ? 'Publiée' : 'Brouillon'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleGenerateTranscript(g.eleve_id)}
                        title="Télécharger relevé PDF"
                        className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-[#0F294A] dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
