import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Copy, Download, RefreshCw, ShieldAlert, Trash2, UserPlus } from 'lucide-react';
import { apiDownloadCsv, apiFetch } from '../../lib/api';

interface UserRow {
  id: number;
  email: string;
  role: string;
  nom: string;
  prenom: string;
  active: number;
  last_login: string | null;
}

interface SessionRow {
  id: number;
  user_id: number;
  utilisateur: string;
  email: string;
  role: string;
  user_agent: string;
  ip_address: string;
  revoked: number;
  expires_at: string;
  created_at: string;
}

interface AuditRow {
  id: number;
  user_email: string;
  action: string;
  ressource: string;
  details: string;
  ip_address: string;
  created_at: string;
}

interface HaStatus {
  instance: {
    server: string;
    pid: number;
    nodeVersion: string;
    uptimeSeconds: number;
    memoryMb: number;
    statelessMode: boolean;
  };
  database: {
    engine: string;
    fileSizeKb: number;
    circuitBreaker: { name: string; state: string; failures: number; failureThreshold: number };
  };
  cache: {
    backend: string;
    activeKeys: number;
    hits: number;
    misses: number;
    hitRatio: number;
  };
  artifacts: {
    id: string;
    filename: string;
    category: string;
    description: string;
    content: string;
  }[];
}

export const AdminUsersAndHA: React.FC<{ currentUserRole: string }> = ({ currentUserRole }) => {
  const [tab, setTab] = useState<'users' | 'sessions' | 'audit' | 'ha'>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [ha, setHa] = useState<HaStatus | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<string>('pg-schema');
  const [probeResult, setProbeResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [userForm, setUserForm] = useState({
    prenom: '',
    nom: '',
    email: '',
    role: 'ADMIN_SCOLARITE',
    password: '',
  });

  const load = async () => {
    setError(null);
    try {
      const [u, s, a, h] = await Promise.all([
        apiFetch<UserRow[]>('/api/admin/users'),
        apiFetch<SessionRow[]>('/api/admin/sessions'),
        apiFetch<AuditRow[]>('/api/admin/audit-logs'),
        apiFetch<HaStatus>('/api/admin/ha-status'),
      ]);
      setUsers(u);
      setSessions(s);
      setLogs(a);
      setHa(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement sécurité');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runProbe = async () => {
    const t0 = performance.now();
    const [healthRes, whoamiRes] = await Promise.all([
      fetch('/health').then((r) => r.json()),
      fetch('/whoami').then((r) => r.json()),
    ]);
    const ms = Math.round(performance.now() - t0);
    setProbeResult(
      `GET /health -> ${healthRes.status} (DB: ${healthRes.db}) | GET /whoami -> nœud ${whoamiRes.server} (PID ${whoamiRes.pid}) en ${ms} ms`
    );
  };

  const activeArtifact = ha?.artifacts.find((a) => a.id === selectedArtifact) || ha?.artifacts[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Utilisateurs, Sécurité & Haute Disponibilité
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Contrôle d’accès RBAC, révocation de sessions, audit et artefacts d’infrastructure Projet 6.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-[#111114]">
          {(
            [
              ['users', 'Comptes & Rôles'],
              ['sessions', 'Sessions JWT'],
              ['audit', 'Journal d’audit'],
              ['ha', 'Infrastructure HA & API'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                tab === id
                  ? 'text-white dark:text-zinc-950'
                  : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {tab === id && (
                <motion.span
                  layoutId="ha-tab-pill"
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

      {tab === 'users' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {currentUserRole === 'SUPER_ADMIN' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  await apiFetch('/api/admin/users', {
                    method: 'POST',
                    body: JSON.stringify(userForm),
                  });
                  setUserForm({ prenom: '', nom: '', email: '', role: 'ADMIN_SCOLARITE', password: '' });
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Erreur création compte');
                }
              }}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-zinc-800/80 dark:bg-[#111114]"
            >
              <div className="flex items-center gap-2 font-display text-base font-semibold">
                <UserPlus className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
                <span>Créer un compte administrateur</span>
              </div>
              <input
                required
                placeholder="Prénom"
                value={userForm.prenom}
                onChange={(e) => setUserForm({ ...userForm, prenom: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              />
              <input
                required
                placeholder="Nom"
                value={userForm.nom}
                onChange={(e) => setUserForm({ ...userForm, nom: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              />
              <input
                type="email"
                required
                placeholder="Email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              />
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              >
                <option value="ADMIN_SCOLARITE">ADMIN_SCOLARITE</option>
                <option value="ENSEIGNANT">ENSEIGNANT</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
              <input
                type="password"
                minLength={8}
                placeholder="Mot de passe (min. 8 car.)"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              />
              <button
                type="submit"
                className="h-10 w-full rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Créer le compte
              </button>
            </form>
          )}

          <div
            className={`overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114] ${
              currentUserRole === 'SUPER_ADMIN' ? 'lg:col-span-8' : 'lg:col-span-12'
            }`}
          >
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Rôle RBAC</th>
                  <th className="px-4 py-3">Dernière connexion</th>
                  <th className="px-4 py-3 text-right">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">
                        {u.prenom} {u.nom}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1E3A8A] dark:text-blue-400">
                      {u.role}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {u.last_login ? new Date(u.last_login).toLocaleString('fr-FR') : 'Jamais'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {currentUserRole === 'SUPER_ADMIN' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/admin/users/${u.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ active: !u.active }),
                              });
                              await load();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Erreur modification');
                            }
                          }}
                          className={`text-xs font-semibold hover:underline ${
                            u.active ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {u.active ? 'Actif (désactiver)' : 'Désactivé (activer)'}
                        </button>
                      ) : (
                        <span className="text-xs">{u.active ? 'Actif' : 'Désactivé'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Compte</th>
                <th className="px-4 py-3">Appareil & IP</th>
                <th className="px-4 py-3">Créée le</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{s.utilisateur}</div>
                    <div className="font-mono text-xs text-slate-500">
                      {s.email} · {s.role}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                    <div className="max-w-xs truncate">{s.user_agent}</div>
                    <div className="font-mono text-slate-400">{s.ip_address}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">
                    {new Date(s.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {s.revoked ? (
                      <span className="text-red-700 dark:text-red-400">Révoquée</span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!s.revoked && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/sessions/${s.id}/revoke`, { method: 'POST' });
                          await load();
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>Révoquer</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audit' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Horodatage</th>
                <th className="px-4 py-3">Acteur</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-slate-500">
                    {new Date(l.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{l.user_email || 'Système'}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-[#1E3A8A] dark:text-blue-400">
                    {l.action}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'ha' && ha && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800/80 dark:bg-[#111114]">
              <div className="text-xs text-slate-500">Nœud applicatif</div>
              <div className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">
                {ha.instance.server}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-500">
                PID {ha.instance.pid} · {ha.instance.memoryMb} Mo RAM
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800/80 dark:bg-[#111114]">
              <div className="text-xs text-slate-500">Circuit Breaker DB</div>
              <div className="mt-1 font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
                {ha.database.circuitBreaker.state}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Base locale : {ha.database.fileSizeKb} Ko · WAL actif
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800/80 dark:bg-[#111114]">
              <div className="text-xs text-slate-500">Cache en mémoire (API Redis)</div>
              <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#0F294A] dark:text-blue-400">
                {ha.cache.hitRatio}% Hit Ratio
              </div>
              <div className="mt-1 font-mono text-xs tabular-nums text-slate-500">
                {ha.cache.activeKeys} clés · {ha.cache.hits} hits / {ha.cache.misses} misses
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800/80 dark:bg-[#111114]">
              <div className="text-xs text-slate-500">Opérations & Sauvegarde</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void runProbe()}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Tester /health</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch('/api/admin/ha-cache/clear', { method: 'POST' });
                    await load();
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Vider cache</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void apiDownloadCsv(
                      '/api/admin/backup',
                      `backup-scolarite-${new Date().toISOString().slice(0, 10)}.json`
                    )
                  }
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-zinc-950 px-2.5 text-xs font-semibold text-white dark:bg-white dark:text-zinc-950"
                >
                  <Download className="h-3 w-3" />
                  <span>Backup JSON</span>
                </button>
              </div>
            </div>
          </div>

          {probeResult && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 font-mono text-xs text-[#0F294A] dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
              {probeResult}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <h2 className="font-display text-base font-semibold">
                  Artefacts d’infrastructure Haute Disponibilité (Projet 6)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Schéma PostgreSQL 16, HAProxy, Keepalived VIP (192.168.56.100), Vagrantfile 6 VMs et Docker Compose.
                </p>
              </div>
              <a
                href="/api/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[#1E3A8A] hover:underline dark:text-blue-400"
              >
                Spec OpenAPI / Swagger JSON
              </a>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {ha.artifacts.map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => setSelectedArtifact(art.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeArtifact?.id === art.id
                      ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-300'
                  }`}
                >
                  {art.filename}
                </button>
              ))}
            </div>

            {activeArtifact && (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {activeArtifact.category} — {activeArtifact.description}
                  </span>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(activeArtifact.content)}
                    className="inline-flex items-center gap-1 font-semibold text-[#1E3A8A] hover:underline dark:text-blue-400"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copier</span>
                  </button>
                </div>
                <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 dark:border-slate-800">
                  {activeArtifact.content}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
