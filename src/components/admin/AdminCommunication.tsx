import React, { useEffect, useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { NotificationRecord, StudentRecord } from '../../types';

interface Lookup {
  filieres: { id: number; code: string; nom: string }[];
  classes: { id: number; nom: string }[];
}

export const AdminCommunication: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [lookup, setLookup] = useState<Lookup>({ filieres: [], classes: [] });
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    titre: '',
    message: '',
    type: 'ANNONCE',
    cible_type: 'TOUS',
    cible_id: '',
  });

  const load = async () => {
    try {
      const [notifs, ped, studs] = await Promise.all([
        apiFetch<NotificationRecord[]>('/api/admin/notifications'),
        apiFetch<Lookup>('/api/admin/pedagogy'),
        apiFetch<StudentRecord[]>('/api/admin/students'),
      ]);
      setNotifications(notifs);
      setLookup({ filieres: ped.filieres, classes: ped.classes });
      setStudents(studs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement notifications');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await apiFetch('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          cible_id: form.cible_type === 'TOUS' ? null : Number(form.cible_id),
        }),
      });
      setForm({ titre: '', message: '', type: 'ANNONCE', cible_type: 'TOUS', cible_id: '' });
      setSuccess('Annonce publiée et transmise en temps réel aux destinataires.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur envoi annonce');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-950 dark:text-white">
          Communication & Annonces
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Diffusez des annonces générales ou des notifications ciblées par filière, classe ou étudiant.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-zinc-800/80 dark:bg-[#111114]"
        >
          <div className="flex items-center gap-2 font-display text-base font-semibold">
            <Megaphone className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
            <span>Nouvelle communication</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Objet</label>
            <input
              required
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              placeholder="Ex: Calendrier des examens partiels"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Catégorie</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              >
                <option value="ANNONCE">Annonce générale</option>
                <option value="RESULTATS">Résultats</option>
                <option value="EMPLOI_DU_TEMPS">Emploi du temps</option>
                <option value="SCOLARITE">Rappel scolarité</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Audience</label>
              <select
                value={form.cible_type}
                onChange={(e) => setForm({ ...form, cible_type: e.target.value, cible_id: '' })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              >
                <option value="TOUS">Tous les étudiants</option>
                <option value="FILIERE">Par filière</option>
                <option value="CLASSE">Par classe</option>
                <option value="ELEVE">Étudiant spécifique</option>
              </select>
            </div>
          </div>

          {form.cible_type === 'FILIERE' && (
            <select
              required
              value={form.cible_id}
              onChange={(e) => setForm({ ...form, cible_id: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              <option value="">Choisir une filière...</option>
              {lookup.filieres.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} — {f.nom}
                </option>
              ))}
            </select>
          )}

          {form.cible_type === 'CLASSE' && (
            <select
              required
              value={form.cible_id}
              onChange={(e) => setForm({ ...form, cible_id: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              <option value="">Choisir une classe...</option>
              {lookup.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          )}

          {form.cible_type === 'ELEVE' && (
            <select
              required
              value={form.cible_id}
              onChange={(e) => setForm({ ...form, cible_id: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              <option value="">Choisir un étudiant...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.matricule} — {s.prenom} {s.nom}
                </option>
              ))}
            </select>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Message</label>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Rédigez l’information officielle..."
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
          </div>

          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Diffuser la notification</span>
          </button>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-zinc-800/80 dark:bg-[#111114]">
          <h2 className="font-display text-base font-semibold">Historique des notifications diffusées</h2>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.map((n) => (
              <div key={n.id} className="py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{n.titre}</h3>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-slate-400">
                    {new Date(n.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {n.type} · Cible : {n.cible_type} · Par {n.auteur || 'Administration'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
