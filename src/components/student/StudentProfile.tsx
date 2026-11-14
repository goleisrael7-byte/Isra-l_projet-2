import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Save } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { StudentRecord } from '../../types';

export const StudentProfile: React.FC = () => {
  const [profile, setProfile] = useState<StudentRecord | null>(null);
  const [form, setForm] = useState({ telephone: '', adresse: '', contact_urgence: '' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<StudentRecord>('/api/student/profile')
      .then((p) => {
        setProfile(p);
        setForm({
          telephone: p.telephone || '',
          adresse: p.adresse || '',
          contact_urgence: p.contact_urgence || '',
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur chargement profil'));
  }, []);

  if (!profile) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Chargement de votre profil...
      </div>
    );
  }

  const initials = `${profile.prenom[0] || ''}${profile.nom[0] || ''}`.toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
          Mon profil
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Informations personnelles, rattachement académique et coordonnées autorisées.
        </p>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 lg:col-span-5 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-950 font-display text-lg font-bold text-white dark:bg-white dark:text-zinc-950">
              {initials}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
                {profile.prenom} {profile.nom}
              </h2>
              <div className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                {profile.matricule}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{profile.email}</div>
            </div>
          </div>

          <dl className="divide-y divide-zinc-200/80 text-sm dark:divide-zinc-800/70">
            <div className="flex justify-between py-2.5">
              <dt className="text-zinc-500 dark:text-zinc-400">Filière</dt>
              <dd className="text-right font-medium text-zinc-900 dark:text-zinc-100">
                {profile.filiereNom || '—'}
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-zinc-500 dark:text-zinc-400">Niveau & Classe</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {profile.niveauNom} · {profile.classeNom}
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-zinc-500 dark:text-zinc-400">Date de naissance</dt>
              <dd className="font-mono text-xs text-zinc-800 dark:text-zinc-200">{profile.date_naissance || '—'}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-zinc-500 dark:text-zinc-400">Statut dossier</dt>
              <dd className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {profile.statut}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-6 lg:col-span-7">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setMessage(null);
              try {
                const updated = await apiFetch<StudentRecord>('/api/student/profile', {
                  method: 'PUT',
                  body: JSON.stringify(form),
                });
                setProfile(updated);
                setMessage('Vos coordonnées ont été mises à jour.');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur sauvegarde');
              }
            }}
            className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
              Coordonnées modifiables
            </h2>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Téléphone</label>
              <input
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-950 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-[#16161B] dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Adresse postale</label>
              <input
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-950 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-[#16161B] dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Contact d’urgence
              </label>
              <input
                value={form.contact_urgence}
                onChange={(e) => setForm({ ...form, contact_urgence: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-950 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-[#16161B] dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Enregistrer les coordonnées</span>
            </button>
          </form>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setMessage(null);
              try {
                await apiFetch('/api/auth/change-password', {
                  method: 'POST',
                  body: JSON.stringify(pwdForm),
                });
                setPwdForm({ currentPassword: '', newPassword: '' });
                setMessage('Mot de passe modifié avec succès.');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur mot de passe');
              }
            }}
            className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <div className="flex items-center gap-2 font-display text-base font-semibold text-zinc-950 dark:text-white">
              <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Sécurité du compte</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="password"
                required
                placeholder="Mot de passe actuel"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                className="h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-950 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-[#16161B] dark:text-white"
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Nouveau mot de passe (min. 8 car.)"
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                className="h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-950 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-[#16161B] dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-4 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Mettre à jour le mot de passe
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
