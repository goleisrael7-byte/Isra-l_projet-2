import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Plus,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { downloadOfficialDocumentPdf, downloadPaymentReceiptPdf } from '../../lib/pdf';
import type {
  DocumentRecord,
  NotificationRecord,
  PaymentChannel,
  PaymentRecord,
  PaymentTransactionRecord,
  StudentRecord,
} from '../../types';
import { EASE_PRO } from '../ui/MotionPrimitives';

const CHANNELS: {
  id: PaymentChannel;
  label: string;
  subtitle: string;
  kind: 'mobile' | 'card';
}[] = [
  { id: 'WAVE', label: 'Wave Mobile', subtitle: 'Paiement instantané sans frais', kind: 'mobile' },
  { id: 'ORANGE_MONEY', label: 'Orange Money', subtitle: 'Validation USSD #144#', kind: 'mobile' },
  { id: 'MTN_MOMO', label: 'MTN MoMo', subtitle: 'Validation code PIN mobile', kind: 'mobile' },
  { id: 'CARTE_BANCAIRE', label: 'Carte Bancaire', subtitle: 'Visa · Mastercard · 3-D Secure', kind: 'card' },
];

function formatCanalName(canal: PaymentChannel): string {
  return CHANNELS.find((c) => c.id === canal)?.label || canal;
}

export const StudentDocuments: React.FC = () => {
  const [data, setData] = useState<{ student: StudentRecord; documents: DocumentRecord[] } | null>(null);
  const [requesting, setRequesting] = useState(false);

  const load = async () => {
    const res = await apiFetch<{ student: StudentRecord; documents: DocumentRecord[] }>('/api/student/documents');
    setData(res);
  };

  useEffect(() => {
    void load();
  }, []);

  const requestDoc = async (type_document: 'ATTESTATION_SCOLARITE' | 'CERTIFICAT_INSCRIPTION') => {
    setRequesting(true);
    try {
      await apiFetch('/api/student/documents/request', {
        method: 'POST',
        body: JSON.stringify({ type_document }),
      });
      await load();
    } finally {
      setRequesting(false);
    }
  };

  if (!data) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Chargement de vos documents...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Mes documents
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Attestations de scolarité, certificats d’inscription et quittances de paiement officielles.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            disabled={requesting}
            onClick={() => void requestDoc('ATTESTATION_SCOLARITE')}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 whitespace-nowrap shrink-0 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Générer une attestation</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            disabled={requesting}
            onClick={() => void requestDoc('CERTIFICAT_INSCRIPTION')}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Certificat d’inscription</span>
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <div className="min-w-0">
              <div className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                {doc.reference} · {doc.statut}
              </div>
              <h2 className="mt-1 truncate font-display text-base font-semibold text-zinc-950 dark:text-white">
                {doc.titre}
              </h2>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Émis le {new Date(doc.date_generation).toLocaleDateString('fr-FR')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => downloadOfficialDocumentPdf(data.student, doc)}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Download className="h-3.5 w-3.5" />
              <span>PDF</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const StudentTuition: React.FC = () => {
  const [data, setData] = useState<{
    student: StudentRecord;
    fraisAnnuels: number;
    totalPaye: number;
    soldeRestant: number;
    payments: PaymentRecord[];
  } | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransactionRecord[]>([]);

  const [canal, setCanal] = useState<PaymentChannel>('WAVE');
  const [montant, setMontant] = useState<string>('150000');
  const [telephone, setTelephone] = useState<string>('');
  const [libelle, setLibelle] = useState<string>('Règlement tranche scolarité 2025-2026');

  const [initiating, setInitiating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<{ message: string; payment?: PaymentRecord | null } | null>(null);

  const [activeCheckout, setActiveCheckout] = useState<{
    transaction: PaymentTransactionRecord;
    checkoutSession: {
      provider: string;
      providerRef: string;
      checkoutUrl: string | null;
      instructions: string;
      signature: string;
    };
  } | null>(null);

  const load = async () => {
    try {
      const [tuitionRes, txRes] = await Promise.all([
        apiFetch<{
          student: StudentRecord;
          fraisAnnuels: number;
          totalPaye: number;
          soldeRestant: number;
          payments: PaymentRecord[];
        }>('/api/student/tuition'),
        apiFetch<PaymentTransactionRecord[]>('/api/student/payments/transactions'),
      ]);
      setData(tuitionRes);
      setTransactions(txRes);
      if (!telephone && tuitionRes.student.telephone) {
        setTelephone(tuitionRes.student.telephone);
      }
      if (tuitionRes.soldeRestant > 0 && Number(montant) > tuitionRes.soldeRestant) {
        setMontant(String(tuitionRes.soldeRestant));
      }
    } catch {
      setData(null);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);
    setPaySuccess(null);
    setInitiating(true);
    try {
      const res = await apiFetch<{
        transaction: PaymentTransactionRecord;
        checkoutSession: {
          provider: string;
          providerRef: string;
          checkoutUrl: string | null;
          instructions: string;
          signature: string;
        };
      }>('/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          montant: Number(montant),
          canal,
          telephone,
          libelle,
        }),
      });
      setActiveCheckout(res);
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Erreur lors de l’initiation du paiement.');
    } finally {
      setInitiating(false);
    }
  };

  const handleConfirm = async (outcome: 'REUSSI' | 'ECHOUE' | 'ANNULE') => {
    if (!activeCheckout) return;
    setConfirming(true);
    setPayError(null);
    try {
      const res = await apiFetch<{
        transaction: PaymentTransactionRecord;
        payment: PaymentRecord | null;
      }>('/api/payments/confirm', {
        method: 'POST',
        body: JSON.stringify({
          transaction_id: activeCheckout.transaction.transaction_id,
          signature: activeCheckout.checkoutSession.signature || activeCheckout.transaction.webhook_signature,
          outcome,
        }),
      });
      setActiveCheckout(null);
      if (outcome === 'REUSSI') {
        setPaySuccess({
          message: `Paiement de ${Number(res.transaction.montant).toLocaleString('fr-FR')} FCFA validé (${res.transaction.transaction_id}).`,
          payment: res.payment,
        });
      } else {
        setPayError(`Transaction ${res.transaction.transaction_id} marquée : ${outcome}.`);
      }
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Erreur confirmation transaction.');
    } finally {
      setConfirming(false);
    }
  };

  if (!data) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Chargement de votre scolarité...
      </div>
    );
  }

  const paidPercent =
    data.fraisAnnuels > 0 ? Math.min(100, Math.round((data.totalPaye / data.fraisAnnuels) * 100)) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
          Ma scolarité
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Frais annuels, règlement en ligne via passerelle API sécurisée (Wave, Orange Money, MTN MoMo, Carte) et
          quittances PDF.
        </p>
      </div>

      {paySuccess && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          <div className="flex items-center gap-2.5 font-medium">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span>{paySuccess.message}</span>
          </div>
          {paySuccess.payment && (
            <button
              type="button"
              onClick={() => downloadPaymentReceiptPdf(data.student, paySuccess.payment!)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Télécharger le reçu PDF</span>
            </button>
          )}
        </div>
      )}

      {payError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {payError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Frais annuels ({data.student.filiereCode})
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {Number(data.fraisAnnuels).toLocaleString('fr-FR')} FCFA
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${paidPercent}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">{paidPercent}% acquittés</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Total payé</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {Number(data.totalPaye).toLocaleString('fr-FR')} FCFA
          </div>
          <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            {data.payments.length} versement(s) validé(s)
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Solde restant dû</div>
          <div
            className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
              data.soldeRestant === 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {Number(data.soldeRestant).toLocaleString('fr-FR')} FCFA
          </div>
          <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            {data.soldeRestant === 0 ? 'Scolarité intégralement soldée' : 'Paiement par tranche disponible'}
          </div>
        </div>
      </div>

      {/* Payment Gateway Checkout Section — Obsidian Carbon Pro */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-[#16161B]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                Passerelle de Paiement Scolarité (API)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Règlement immédiat sécurisé par signature HMAC-SHA256 et génération automatique de quittance.
              </p>
            </div>
          </div>
          <div className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
            Devise : XOF / FCFA
          </div>
        </div>

        <form onSubmit={handleCheckout} className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              1. Choisissez votre moyen de paiement
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CHANNELS.map((ch) => {
                const selected = canal === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setCanal(ch.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      selected
                        ? 'border-zinc-950 bg-zinc-100 dark:border-white dark:bg-[#1C1C22]'
                        : 'border-zinc-200 bg-zinc-50/70 hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-[#16161B] dark:hover:border-zinc-700'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        selected
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                          : 'bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {ch.kind === 'mobile' ? <Smartphone className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-950 dark:text-white">{ch.label}</div>
                      <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{ch.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 lg:col-span-5">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  2. Montant à régler (FCFA)
                </label>
                {data.soldeRestant > 0 && (
                  <button
                    type="button"
                    onClick={() => setMontant(String(data.soldeRestant))}
                    className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Solder tout ({data.soldeRestant.toLocaleString('fr-FR')})
                  </button>
                )}
              </div>
              <input
                type="number"
                required
                min="500"
                step="500"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 font-mono text-sm font-semibold text-zinc-950 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-[#16161B] dark:text-white"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[100000, 250000, 500000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMontant(String(preset))}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {preset.toLocaleString('fr-FR')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {canal === 'CARTE_BANCAIRE' ? 'Téléphone de confirmation 3-D Secure' : 'Numéro Mobile Money'}
              </label>
              <input
                required
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+225 07 XX XX XX XX"
                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-950 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-[#16161B] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Libellé</label>
              <input
                required
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-950 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-[#16161B] dark:text-white"
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={initiating}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>
                {initiating
                  ? 'Initialisation session sécurisée...'
                  : `Payer ${Number(montant || 0).toLocaleString('fr-FR')} FCFA`}
              </span>
            </motion.button>
          </div>
        </form>
      </section>

      {/* Payments Validated Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
        <div className="border-b border-zinc-200 px-5 py-3.5 font-display text-sm font-semibold text-zinc-950 dark:border-zinc-800 dark:text-white">
          Paiements validés & Quittances ({data.payments.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600 dark:bg-[#16161B] dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3">Référence</th>
                <th className="px-5 py-3">Libellé</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Montant</th>
                <th className="px-5 py-3 text-right">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {data.payments.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-[#16161B]">
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {p.reference}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-zinc-900 dark:text-zinc-100">{p.libelle}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{p.mode_paiement}</div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
                    {new Date(p.date_paiement).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums text-zinc-950 dark:text-white">
                    {Number(p.montant).toLocaleString('fr-FR')} FCFA
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => downloadPaymentReceiptPdf(data.student, p)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Télécharger</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gateway API Transaction Ledger */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
        <div className="border-b border-zinc-200 px-5 py-3.5 font-display text-sm font-semibold text-zinc-950 dark:border-zinc-800 dark:text-white">
          Journal des transactions Passerelle API ({transactions.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 font-semibold text-zinc-600 dark:bg-[#16161B] dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3">Transaction ID</th>
                <th className="px-5 py-3">Canal</th>
                <th className="px-5 py-3">Passerelle</th>
                <th className="px-5 py-3 text-right">Montant</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-zinc-500 dark:text-zinc-400">
                    Aucune transaction en ligne initiée pour le moment.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-[#16161B]">
                    <td className="px-5 py-3 font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      {tx.transaction_id}
                    </td>
                    <td className="px-5 py-3 text-zinc-800 dark:text-zinc-200">{formatCanalName(tx.canal)}</td>
                    <td className="px-5 py-3 font-mono text-zinc-500 dark:text-zinc-400">{tx.provider}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-zinc-950 dark:text-white">
                      {Number(tx.montant).toLocaleString('fr-FR')} {tx.devise}
                    </td>
                    <td className="px-5 py-3 font-semibold">
                      <span
                        className={
                          tx.statut === 'REUSSI'
                            ? 'rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-400'
                            : tx.statut === 'EN_ATTENTE'
                            ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400'
                            : 'rounded-md bg-red-500/15 px-2 py-0.5 text-red-700 dark:text-red-400'
                        }
                      >
                        {tx.statut}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {tx.statut === 'EN_ATTENTE' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveCheckout({
                              transaction: tx,
                              checkoutSession: {
                                provider: tx.provider,
                                providerRef: tx.provider_ref || tx.transaction_id,
                                checkoutUrl: null,
                                instructions: `Finalisez votre règlement ${formatCanalName(tx.canal)} de ${Number(tx.montant).toLocaleString('fr-FR')} FCFA.`,
                                signature: tx.webhook_signature || '',
                              },
                            })
                          }
                          className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Finaliser
                        </button>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Secure Checkout Confirmation Modal */}
      <AnimatePresence>
        {activeCheckout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveCheckout(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: EASE_PRO }}
              className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#111114]"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                    Guichet Sécurisé {activeCheckout.checkoutSession.provider}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCheckout(null)}
                  className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-[#16161B]">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">Montant à autoriser</div>
                  <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
                    {Number(activeCheckout.transaction.montant).toLocaleString('fr-FR')} FCFA
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                    {formatCanalName(activeCheckout.transaction.canal)} · {activeCheckout.transaction.transaction_id}
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {activeCheckout.checkoutSession.instructions}
                </p>

                {activeCheckout.checkoutSession.signature && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-300">
                    HMAC-SHA256 : {activeCheckout.checkoutSession.signature.slice(0, 24)}…
                  </div>
                )}

                {activeCheckout.checkoutSession.checkoutUrl && (
                  <a
                    href={activeCheckout.checkoutSession.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Ouvrir le guichet externe</span>
                  </a>
                )}

                <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={confirming}
                    onClick={() => void handleConfirm('REUSSI')}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{confirming ? 'Validation en cours...' : 'Confirmer et valider le paiement'}</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={confirming}
                      onClick={() => void handleConfirm('ECHOUE')}
                      className="h-9 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      Simuler un échec
                    </button>
                    <button
                      type="button"
                      disabled={confirming}
                      onClick={() => void handleConfirm('ANNULE')}
                      className="h-9 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const StudentNotifications: React.FC = () => {
  const [items, setItems] = useState<NotificationRecord[]>([]);

  const load = async () => {
    const res = await apiFetch<NotificationRecord[]>('/api/student/notifications');
    setItems(res);
  };

  useEffect(() => {
    void load();
  }, []);

  const markRead = async (id: number) => {
    await apiFetch(`/api/student/notifications/${id}/read`, { method: 'POST' });
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
          Annonces & Notifications
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Annonces de l’administration, publications de notes, changements d’emploi du temps et rappels.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((n) => (
          <div
            key={n.id}
            className={`rounded-xl border p-5 transition-colors ${
              n.lu
                ? 'border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]'
                : 'border-blue-500/40 bg-blue-50/40 dark:border-blue-500/40 dark:bg-[#16161B]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Bell className="h-3.5 w-3.5" />
                  <span>{n.type}</span>
                  <span className="text-zinc-400">·</span>
                  <span className="font-mono text-zinc-500 dark:text-zinc-400">
                    {new Date(n.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white">{n.titre}</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{n.message}</p>
              </div>
              {!n.lu ? (
                <button
                  type="button"
                  onClick={() => void markRead(n.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Marquer lu</span>
                </button>
              ) : (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">Lu</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
