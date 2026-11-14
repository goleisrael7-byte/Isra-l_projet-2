import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateAnnualAverage,
  calculateSemesterSummary,
  calculateSubjectAverages,
  formatMatricule,
  getMention,
} from '../server/calculations.ts';
import { getDb, seedDatabaseIfEmpty } from '../server/db.ts';
import { ResilientCache } from '../server/resilience.ts';
import {
  hashPassword,
  signAccessToken,
  verifyAccessToken,
  verifyPassword,
} from '../server/security.ts';
import {
  initiateGatewayCheckout,
  signPaymentPayload,
  verifyPaymentSignature,
} from '../server/paymentGateway.ts';

test('Calcul des moyennes par matière, semestre, annuel et crédits ECTS', () => {
  const grades = [
    {
      matiereId: 1,
      matiereNom: 'PostgreSQL HA',
      matiereCode: 'INF-301',
      ueNom: 'Architecture',
      ueCode: 'UE-301',
      credits: 6,
      coefficient: 4,
      semestre: 'S1',
      typeEvaluation: 'CC',
      valeur: 14,
      publie: true,
    },
    {
      matiereId: 1,
      matiereNom: 'PostgreSQL HA',
      matiereCode: 'INF-301',
      ueNom: 'Architecture',
      ueCode: 'UE-301',
      credits: 6,
      coefficient: 4,
      semestre: 'S1',
      typeEvaluation: 'Examen',
      valeur: 16,
      publie: true,
    },
    {
      matiereId: 2,
      matiereNom: 'Sécurité JWT',
      matiereCode: 'INF-302',
      ueNom: 'Architecture',
      ueCode: 'UE-301',
      credits: 4,
      coefficient: 2,
      semestre: 'S1',
      typeEvaluation: 'Examen',
      valeur: 12,
      publie: true,
    },
  ];

  const subjects = calculateSubjectAverages(grades);
  assert.equal(subjects.length, 2);
  // 16*0.6 + 14*0.4 = 9.6 + 5.6 = 15.2
  assert.equal(subjects[0].moyenne, 15.2);
  assert.equal(subjects[1].moyenne, 12);

  const s1 = calculateSemesterSummary('S1', subjects);
  // (15.2*4 + 12*2) / 6 = (60.8 + 24)/6 = 14.13
  assert.equal(s1.moyenne, 14.13);
  assert.equal(s1.creditsObtenus, 10);
  assert.equal(s1.mention, 'Bien');

  const s2 = calculateSemesterSummary('S2', subjects);
  assert.equal(calculateAnnualAverage(s1, s2), 14.13);
  assert.equal(getMention(16.5), 'Très Bien');
  assert.equal(formatMatricule(2026, 7), 'MAT-2026-007');
});

test('Hachage scrypt et vérification des jetons JWT stateless', () => {
  const hash = hashPassword('SecretHA2026!');
  assert.equal(verifyPassword('SecretHA2026!', hash), true);
  assert.equal(verifyPassword('MauvaisMotDePasse', hash), false);

  const token = signAccessToken({
    sub: 42,
    email: 'amina.diallo@etudiant.academie-ha.edu',
    role: 'ETUDIANT',
    nom: 'Diallo',
    prenom: 'Amina',
    eleveId: 1,
    enseignantId: null,
  });

  const decoded = verifyAccessToken(token);
  assert.ok(decoded);
  assert.equal(decoded.sub, 42);
  assert.equal(decoded.role, 'ETUDIANT');
  assert.equal(decoded.eleveId, 1);
  assert.equal(verifyAccessToken(token + 'tampered'), null);
});

test('Base de données relationnelle SQLite en mémoire, seed et contraintes', () => {
  const db = getDb(':memory:');
  seedDatabaseIfEmpty(db);

  const usersCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const elevesCount = (db.prepare('SELECT COUNT(*) as c FROM eleves').get() as { c: number }).c;
  const txCount = (db.prepare('SELECT COUNT(*) as c FROM payment_transactions').get() as { c: number }).c;
  assert.ok(usersCount >= 10);
  assert.equal(elevesCount, 8);
  assert.equal(txCount, 2);

  // Contrainte CHECK (valeur BETWEEN 0 AND 20)
  assert.throws(() => {
    db.prepare(
      "INSERT INTO notes (eleve_id, matiere, semestre, type_evaluation, valeur) VALUES (1, 'Test', 'S1', 'Examen', 25)"
    ).run();
  });
});

test('Cache résilient avec TTL et invalidation par préfixe', () => {
  const cache = new ResilientCache();
  cache.set('admin:dashboard', { total: 8 }, 5000);
  assert.deepEqual(cache.get('admin:dashboard'), { total: 8 });
  cache.invalidatePrefix('admin:');
  assert.equal(cache.get('admin:dashboard'), null);
});

test('Passerelle de paiement API : signature HMAC-SHA256 et session checkout', async () => {
  const sig = signPaymentPayload('TX-2026-TEST01', 1, 150000, 'WAVE');
  assert.equal(verifyPaymentSignature('TX-2026-TEST01', 1, 150000, 'WAVE', sig), true);
  assert.equal(verifyPaymentSignature('TX-2026-TEST01', 1, 999999, 'WAVE', sig), false);

  const session = await initiateGatewayCheckout(
    {
      transactionId: 'TX-2026-TEST02',
      montant: 200000,
      devise: 'XOF',
      canal: 'ORANGE_MONEY',
      libelle: 'Test tranche scolarité',
      studentName: 'Amina Diallo',
      studentEmail: 'amina.diallo@etudiant.academie-ha.edu',
      telephone: '+225 07 00 00 00',
      returnUrl: 'http://localhost:3000/#/espace-etudiant',
      notifyUrl: 'http://localhost:3000/api/payments/webhook',
    },
    1
  );

  assert.equal(session.provider, 'ACADEMIA_PAY');
  assert.ok(session.providerRef.startsWith('GW-ORA-'));
  assert.equal(verifyPaymentSignature('TX-2026-TEST02', 1, 200000, 'ORANGE_MONEY', session.signature), true);
});

test('Attribution séquentielle de matricule unique et enregistrement étudiant sans collision', () => {
  const db = getDb(':memory:');
  seedDatabaseIfEmpty(db);

  const nextMat = () => {
    const rows = db.prepare("SELECT matricule FROM eleves WHERE matricule LIKE 'MAT-2026-%'").all() as {
      matricule: string;
    }[];
    const maxSeq = rows.reduce((acc, r) => {
      const m = /^MAT-\d{4}-(\d+)$/.exec(r.matricule);
      return m ? Math.max(acc, Number(m[1])) : acc;
    }, 0);
    const maxId = (db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM eleves').get() as { m: number }).m;
    let seq = Math.max(maxSeq, maxId) + 1;
    let mat = formatMatricule(2026, seq);
    while (db.prepare('SELECT 1 FROM eleves WHERE matricule = ?').get(mat)) {
      seq += 1;
      mat = formatMatricule(2026, seq);
    }
    return mat;
  };

  const mat1 = nextMat();
  assert.equal(mat1, 'MAT-2026-009');

  const uid = Number(
    db
      .prepare('INSERT INTO users (email, password_hash, role, nom, prenom, active) VALUES (?, ?, ?, ?, ?, 1)')
      .run('kone.mariam@etudiant.academie-ha.edu', hashPassword('Etudiant2026!'), 'ETUDIANT', 'Koné', 'Mariam')
      .lastInsertRowid
  );
  const eid = Number(
    db
      .prepare(
        `INSERT INTO eleves (user_id, matricule, nom, prenom, email, classe_id, statut)
         VALUES (?, ?, ?, ?, ?, 1, 'ACTIF')`
      )
      .run(uid, mat1, 'Koné', 'Mariam', 'kone.mariam@etudiant.academie-ha.edu').lastInsertRowid
  );
  db.prepare(
    'INSERT INTO inscriptions (eleve_id, classe_id, annee_academique, type_inscription, statut) VALUES (?, 1, ?, ?, ?)'
  ).run(eid, '2025-2026', 'NOUVELLE', 'VALIDEE');

  db.prepare(
    `INSERT INTO notifications (titre, message, type, cible_type, cible_id, created_by)
     VALUES (?, ?, 'ANNONCE', 'ELEVE', ?, ?)`
  ).run('Bienvenue', 'Compte actif', eid, uid);

  assert.equal(nextMat(), 'MAT-2026-010');

  // Vérifier l'unicité stricte du matricule en base
  assert.throws(() => {
    db.prepare(
      `INSERT INTO eleves (matricule, nom, prenom, email, statut) VALUES (?, 'Test', 'Doublon', 'doublon@etudiant.academie-ha.edu', 'ACTIF')`
    ).run(mat1);
  });
});

