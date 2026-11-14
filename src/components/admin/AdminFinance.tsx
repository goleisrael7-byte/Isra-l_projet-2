import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, CreditCard, FileCheck2, FileText, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { downloadOfficialDocumentPdf, downloadPaymentReceiptPdf } from '../../lib/pdf';
import type {
  DocumentRecord,
  PaymentChannel,
  PaymentRecord,
  PaymentTransactionRecord,
  StudentRecord,
} from '../../types';

interface FinanceData {
  balances: {
    id: number;
    matricule: string;
    nom: string;
    prenom: string;
    classeNom: string;
    filiereNom: string;
    fraisAnnuels: number;
    totalPaye: number;
  }[];
  payments: PaymentRecord[];
  inscriptions: {
    id: number;
    eleve_id: number;
    matricule: string;
    eleveNom: string;
    classeNom: string;
    annee_academique: string;
    type_inscription: string;
    statut: string;
    date_inscription: string;
  }[];
  documents: DocumentRecord[];
}

export const AdminFinance: React.FC<{
  initialTab?: 'paiements' | 'passerelle' | 'inscriptions' | 'documents';
}> = ({ initialTab = 'paiements' }) => {
  const [tab, setTab] = useState<'paiements' | 'passerelle' | 'inscriptions' | 'documents'>(initialTab);
  const [data, setData] = useState<FinanceData | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransactionRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<{ id: number; nom: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [payForm, setPayForm] = useState({
    eleve_id: '',
    montant: '300000',
    mode_paiement: 'VIREMENT',
    libelle: 'Règlement tranche scolarité 2025-2026',
  });
  const [gwForm, setGwForm] = useState<{
    eleve_id: string;
    montant: string;
    canal: PaymentChannel;
    telephone: string;
    libelle: string;
  }>({
    eleve_id: '',
    montant: '250000',
    canal: 'WAVE',
    telephone: '',
    libelle: 'Ordre de paiement scolarité en ligne',
  });
  const [inscForm, setInscForm] = useState({
    eleve_id: '',
    classe_id: '',
    annee_academique: '2026-2027',
    type_inscription: 'REINSCRIPTION',
  });
  const [docForm, setDocForm] = useState({
    eleve_id: '',
    type_document: 'ATTESTATION_SCOLARITE',
  });

  const load = async () => {
    try {
      const [fin, txs, studs, ped] = await Promise.all([
        apiFetch<FinanceData>('/api/admin/finance'),
        apiFetch<PaymentTransactionRecord[]>('/api/admin/payments/transactions'),
        apiFetch<StudentRecord[]>('/api/admin/students'),
        apiFetch<{ classes: { id: number; nom: string }[] }>('/api/admin/pedagogy'),
      ]);
      setData(fin);
      setTransactions(txs);
      setStudents(studs);
      setClasses(ped.classes);
      if (!payForm.eleve_id && studs[0]) {
        const firstId = String(studs[0].id);
        setPayForm((f) => ({ ...f, eleve_id: firstId }));
        setGwForm((f) => ({ ...f, eleve_id: firstId, telephone: studs[0].telephone || '' }));
        setInscForm((f) => ({ ...f, eleve_id: firstId, classe_id: String(ped.classes[0]?.id || '') }));
        setDocForm((f) => ({ ...f, eleve_id: firstId }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement finance');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!data) {
    return <div className="py-10 text-center text-sm text-slate-500">Chargement de la gestion administrative...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Gestion administrative & scolarité
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Paiements guichet, passerelle API Mobile Money / Carte, réinscriptions et attestations officielles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-[#111114]">
          {(
            [
              ['paiements', 'Paiements & Soldes'],
              ['passerelle', 'Passerelle API'],
              ['inscriptions', 'Inscriptions'],
              ['documents', 'Documents & Certificats'],
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
                  layoutId="finance-tab-pill"
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs font-semibold underline">
            Fermer
          </button>
        </div>
      )}

      {tab === 'paiements' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setSuccessMsg(null);
              try {
                await apiFetch('/api/admin/payments', {
                  method: 'POST',
                  body: JSON.stringify({
                    ...payForm,
                    eleve_id: Number(payForm.eleve_id),
                    montant: Number(payForm.montant),
                  }),
                });
                setSuccessMsg('Paiement guichet enregistré et quittance générée.');
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur paiement');
              }
            }}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <div className="flex items-center gap-2 font-display text-base font-semibold">
              <CreditCard className="h-4 w-4 text-[#1D4ED8] dark:text-blue-400" />
              <span>Enregistrer un paiement</span>
            </div>
            <select
              value={payForm.eleve_id}
              onChange={(e) => setPayForm({ ...payForm, eleve_id: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.matricule} — {s.prenom} {s.nom}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                required
                min="1000"
                placeholder="Montant (FCFA)"
                value={payForm.montant}
                onChange={(e) => setPayForm({ ...payForm, montant: e.target.value })}
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              />
              <select
                value={payForm.mode_paiement}
                onChange={(e) => setPayForm({ ...payForm, mode_paiement: e.target.value })}
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              >
                <option value="VIREMENT">Virement</option>
                <option value="CARTE">Carte bancaire</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="ESPECES">Espèces</option>
              </select>
            </div>
            <input
              required
              placeholder="Libellé"
              value={payForm.libelle}
              onChange={(e) => setPayForm({ ...payForm, libelle: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <button
              type="submit"
              className="h-10 w-full rounded-xl bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Valider et générer la quittance
            </button>
          </form>

          <div className="space-y-6 lg:col-span-8">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
              <div className="border-b border-slate-200 px-4 py-3 font-display text-sm font-semibold dark:border-slate-800">
                Situation financière par étudiant
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600 dark:bg-[#16161B] dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-2.5">Étudiant</th>
                      <th className="px-4 py-2.5 text-right">Frais dus</th>
                      <th className="px-4 py-2.5 text-right">Payé</th>
                      <th className="px-4 py-2.5 text-right">Solde restant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.balances.map((b) => {
                      const solde = Math.max(0, b.fraisAnnuels - b.totalPaye);
                      return (
                        <tr key={b.id}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">
                              {b.prenom} {b.nom}
                            </div>
                            <div className="font-mono text-xs text-slate-500">
                              {b.matricule} · {b.classeNom}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                            {Number(b.fraisAnnuels).toLocaleString('fr-FR')}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-emerald-700 dark:text-emerald-400">
                            {Number(b.totalPaye).toLocaleString('fr-FR')}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono text-xs font-semibold tabular-nums ${
                              solde === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {solde.toLocaleString('fr-FR')} FCFA
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
              <div className="border-b border-slate-200 px-4 py-3 font-display text-sm font-semibold dark:border-slate-800">
                Historique des règlements
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 dark:bg-[#16161B] dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-2.5">Référence</th>
                      <th className="px-4 py-2.5">Étudiant</th>
                      <th className="px-4 py-2.5">Mode</th>
                      <th className="px-4 py-2.5 text-right">Montant</th>
                      <th className="px-4 py-2.5 text-right">Reçu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.payments.map((p) => {
                      const st = students.find((s) => s.id === p.eleve_id);
                      return (
                        <tr key={p.id}>
                          <td className="px-4 py-2.5 font-mono font-semibold">{p.reference}</td>
                          <td className="px-4 py-2.5">{p.eleveNom}</td>
                          <td className="px-4 py-2.5">{p.mode_paiement}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                            {Number(p.montant).toLocaleString('fr-FR')} FCFA
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {st && (
                              <button
                                type="button"
                                onClick={() => downloadPaymentReceiptPdf(st, p)}
                                className="inline-flex items-center gap-1 text-[#1D4ED8] hover:underline dark:text-blue-400"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span>PDF</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'passerelle' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setSuccessMsg(null);
              try {
                const res = await apiFetch<{ transaction: PaymentTransactionRecord }>('/api/payments/checkout', {
                  method: 'POST',
                  body: JSON.stringify({
                    eleve_id: Number(gwForm.eleve_id),
                    montant: Number(gwForm.montant),
                    canal: gwForm.canal,
                    telephone: gwForm.telephone,
                    libelle: gwForm.libelle,
                  }),
                });
                setSuccessMsg(
                  `Session API créée : ${res.transaction.transaction_id} (${res.transaction.canal} · ${Number(res.transaction.montant).toLocaleString('fr-FR')} FCFA). L’étudiant peut la finaliser ou vous pouvez la confirmer ci-contre.`
                );
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur initiation session paiement');
              }
            }}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <div className="flex items-center gap-2 font-display text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-[#1D4ED8] dark:text-blue-400" />
              <span>Initier un ordre de paiement API</span>
            </div>
            <p className="text-xs text-slate-500">
              Crée une transaction signée HMAC-SHA256 (Wave, Orange Money, MTN MoMo ou Carte) directement sur le compte
              de l’étudiant.
            </p>
            <select
              value={gwForm.eleve_id}
              onChange={(e) => {
                const selected = students.find((s) => String(s.id) === e.target.value);
                setGwForm({ ...gwForm, eleve_id: e.target.value, telephone: selected?.telephone || '' });
              }}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.matricule} — {s.prenom} {s.nom}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                required
                min="500"
                value={gwForm.montant}
                onChange={(e) => setGwForm({ ...gwForm, montant: e.target.value })}
                placeholder="Montant FCFA"
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              />
              <select
                value={gwForm.canal}
                onChange={(e) => setGwForm({ ...gwForm, canal: e.target.value as PaymentChannel })}
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
              >
                <option value="WAVE">Wave Mobile</option>
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="MTN_MOMO">MTN MoMo</option>
                <option value="CARTE_BANCAIRE">Carte Bancaire</option>
              </select>
            </div>
            <input
              value={gwForm.telephone}
              onChange={(e) => setGwForm({ ...gwForm, telephone: e.target.value })}
              placeholder="Téléphone payeur"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <input
              required
              value={gwForm.libelle}
              onChange={(e) => setGwForm({ ...gwForm, libelle: e.target.value })}
              placeholder="Libellé"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <button
              type="submit"
              className="h-10 w-full rounded-xl bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Créer la session de paiement
            </button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-8 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="border-b border-slate-200 px-4 py-3 font-display text-sm font-semibold dark:border-slate-800">
              Transactions Passerelle API ({transactions.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-[#16161B] dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2.5">Transaction</th>
                    <th className="px-4 py-2.5">Étudiant</th>
                    <th className="px-4 py-2.5">Canal · Provider</th>
                    <th className="px-4 py-2.5 text-right">Montant</th>
                    <th className="px-4 py-2.5">Statut</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-2.5 font-mono font-semibold">{tx.transaction_id}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{tx.eleveNom}</div>
                        <div className="font-mono text-[11px] text-slate-500">{tx.matricule}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div>{tx.canal}</div>
                        <div className="font-mono text-[11px] text-slate-400">{tx.provider}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                        {Number(tx.montant).toLocaleString('fr-FR')} {tx.devise}
                      </td>
                      <td className="px-4 py-2.5 font-semibold">
                        <span
                          className={
                            tx.statut === 'REUSSI'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : tx.statut === 'EN_ATTENTE'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-red-700 dark:text-red-400'
                          }
                        >
                          {tx.statut}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {tx.statut === 'EN_ATTENTE' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              setError(null);
                              await apiFetch('/api/payments/confirm', {
                                method: 'POST',
                                body: JSON.stringify({
                                  transaction_id: tx.transaction_id,
                                  signature: tx.webhook_signature || '',
                                  outcome: 'REUSSI',
                                }),
                              });
                              setSuccessMsg(`Transaction ${tx.transaction_id} confirmée et quittance générée.`);
                              await load();
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Valider</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'inscriptions' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch('/api/admin/inscriptions', {
                method: 'POST',
                body: JSON.stringify({
                  ...inscForm,
                  eleve_id: Number(inscForm.eleve_id),
                  classe_id: Number(inscForm.classe_id),
                }),
              });
              await load();
            }}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <h2 className="font-display text-base font-semibold">Inscription / Réinscription</h2>
            <select
              value={inscForm.eleve_id}
              onChange={(e) => setInscForm({ ...inscForm, eleve_id: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.matricule} — {s.prenom} {s.nom}
                </option>
              ))}
            </select>
            <select
              value={inscForm.classe_id}
              onChange={(e) => setInscForm({ ...inscForm, classe_id: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
            <input
              value={inscForm.annee_academique}
              onChange={(e) => setInscForm({ ...inscForm, annee_academique: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            />
            <select
              value={inscForm.type_inscription}
              onChange={(e) => setInscForm({ ...inscForm, type_inscription: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              <option value="REINSCRIPTION">Réinscription</option>
              <option value="NOUVELLE">Nouvelle inscription</option>
            </select>
            <button
              type="submit"
              className="h-10 w-full rounded-xl bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Valider l’inscription
            </button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-8 dark:border-zinc-800/80 dark:bg-[#111114]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-[#16161B] dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Étudiant</th>
                  <th className="px-4 py-3">Classe</th>
                  <th className="px-4 py-3">Année</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.inscriptions.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{i.eleveNom}</div>
                      <div className="font-mono text-xs text-slate-500">{i.matricule}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{i.classeNom}</td>
                    <td className="px-4 py-3 font-mono text-xs">{i.annee_academique}</td>
                    <td className="px-4 py-3 text-xs">{i.type_inscription}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {i.statut}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch('/api/admin/documents/generate', {
                method: 'POST',
                body: JSON.stringify({
                  eleve_id: Number(docForm.eleve_id),
                  type_document: docForm.type_document,
                }),
              });
              await load();
            }}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <div className="flex items-center gap-2 font-display text-base font-semibold">
              <FileCheck2 className="h-4 w-4 text-[#1D4ED8] dark:text-blue-400" />
              <span>Délivrer un document</span>
            </div>
            <select
              value={docForm.eleve_id}
              onChange={(e) => setDocForm({ ...docForm, eleve_id: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.matricule} — {s.prenom} {s.nom}
                </option>
              ))}
            </select>
            <select
              value={docForm.type_document}
              onChange={(e) => setDocForm({ ...docForm, type_document: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-zinc-800 dark:bg-[#16161B]"
            >
              <option value="ATTESTATION_SCOLARITE">Attestation de scolarité</option>
              <option value="CERTIFICAT_INSCRIPTION">Certificat d’inscription</option>
              <option value="RELEVE_NOTES">Relevé de notes officiel</option>
            </select>
            <button
              type="submit"
              className="h-10 w-full rounded-xl bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Générer le document
            </button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-8 dark:border-zinc-800/80 dark:bg-[#111114]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-[#16161B] dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Référence</th>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Étudiant</th>
                  <th className="px-4 py-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.documents.map((d) => {
                  const st = students.find((s) => s.id === d.eleve_id);
                  return (
                    <tr key={d.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{d.reference}</td>
                      <td className="px-4 py-3 font-medium">{d.titre}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{d.eleveNom}</td>
                      <td className="px-4 py-3 text-right">
                        {st && (
                          <button
                            type="button"
                            onClick={() => downloadOfficialDocumentPdf(st, d)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:underline dark:text-blue-400"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Télécharger</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
