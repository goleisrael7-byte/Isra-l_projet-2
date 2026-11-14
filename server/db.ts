import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './security.ts';

const DB_FILE = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'scolarite.db');

let dbInstance: DatabaseSync | null = null;

export function getDb(customPath?: string): DatabaseSync {
  if (dbInstance && !customPath) return dbInstance;
  const target = customPath || DB_FILE;
  if (target !== ':memory:') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
  }
  const db = new DatabaseSync(target);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  runMigrations(db);
  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

function runMigrations(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set<number>(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (r) => r.version
    )
  );

  if (!applied.has(1)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'ADMIN_SCOLARITE', 'ENSEIGNANT', 'ETUDIANT')),
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        last_login TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash TEXT NOT NULL UNIQUE,
        user_agent TEXT,
        ip_address TEXT,
        revoked INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS filieres (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        nom TEXT NOT NULL,
        description TEXT,
        frais_annuels REAL NOT NULL DEFAULT 1200000,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS niveaux (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        nom TEXT NOT NULL,
        ordre INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL UNIQUE,
        filiere_id INTEGER REFERENCES filieres(id) ON DELETE SET NULL,
        niveau_id INTEGER REFERENCES niveaux(id) ON DELETE SET NULL,
        annee_academique TEXT NOT NULL DEFAULT '2025-2026',
        capacite INTEGER NOT NULL DEFAULT 40,
        salle_principale TEXT DEFAULT 'Bât. A - 101'
      );

      CREATE TABLE IF NOT EXISTS enseignants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
        matricule TEXT NOT NULL UNIQUE,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        telephone TEXT,
        specialite TEXT NOT NULL,
        statut TEXT NOT NULL DEFAULT 'ACTIF' CHECK(statut IN ('ACTIF', 'INACTIF'))
      );

      CREATE TABLE IF NOT EXISTS eleves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
        matricule TEXT NOT NULL UNIQUE,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        telephone TEXT,
        date_naissance TEXT,
        adresse TEXT,
        contact_urgence TEXT,
        classe_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        statut TEXT NOT NULL DEFAULT 'ACTIF' CHECK(statut IN ('ACTIF', 'INACTIF', 'DIPLOME')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        nom TEXT NOT NULL,
        filiere_id INTEGER NOT NULL REFERENCES filieres(id) ON DELETE CASCADE,
        niveau_id INTEGER NOT NULL REFERENCES niveaux(id) ON DELETE CASCADE,
        semestre TEXT NOT NULL CHECK(semestre IN ('S1', 'S2')),
        credits INTEGER NOT NULL DEFAULT 6
      );

      CREATE TABLE IF NOT EXISTS matieres (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        nom TEXT NOT NULL,
        ue_id INTEGER NOT NULL REFERENCES ues(id) ON DELETE CASCADE,
        coefficient REAL NOT NULL DEFAULT 2,
        enseignant_id INTEGER REFERENCES enseignants(id) ON DELETE SET NULL,
        volume_horaire INTEGER NOT NULL DEFAULT 36
      );

      CREATE TABLE IF NOT EXISTS emplois_du_temps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        classe_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        matiere_id INTEGER NOT NULL REFERENCES matieres(id) ON DELETE CASCADE,
        enseignant_id INTEGER REFERENCES enseignants(id) ON DELETE SET NULL,
        jour_semaine TEXT NOT NULL CHECK(jour_semaine IN ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi')),
        heure_debut TEXT NOT NULL,
        heure_fin TEXT NOT NULL,
        salle TEXT NOT NULL,
        type_cours TEXT NOT NULL DEFAULT 'CM' CHECK(type_cours IN ('CM', 'TD', 'TP')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eleve_id INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
        matiere_id INTEGER REFERENCES matieres(id) ON DELETE CASCADE,
        matiere TEXT NOT NULL,
        semestre TEXT NOT NULL DEFAULT 'S1' CHECK(semestre IN ('S1', 'S2')),
        type_evaluation TEXT NOT NULL DEFAULT 'Examen' CHECK(type_evaluation IN ('CC', 'TP', 'Examen')),
        valeur REAL NOT NULL CHECK(valeur >= 0 AND valeur <= 20),
        commentaire TEXT,
        publie INTEGER NOT NULL DEFAULT 0,
        saisi_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS inscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eleve_id INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
        classe_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        annee_academique TEXT NOT NULL,
        date_inscription TEXT NOT NULL DEFAULT (date('now')),
        type_inscription TEXT NOT NULL DEFAULT 'NOUVELLE' CHECK(type_inscription IN ('NOUVELLE', 'REINSCRIPTION')),
        statut TEXT NOT NULL DEFAULT 'VALIDEE' CHECK(statut IN ('EN_ATTENTE', 'VALIDEE', 'ANNULEE'))
      );

      CREATE TABLE IF NOT EXISTS paiements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eleve_id INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
        reference TEXT NOT NULL UNIQUE,
        montant REAL NOT NULL CHECK(montant > 0),
        mode_paiement TEXT NOT NULL CHECK(mode_paiement IN ('VIREMENT', 'CARTE', 'ESPECES', 'MOBILE_MONEY')),
        libelle TEXT NOT NULL,
        date_paiement TEXT NOT NULL DEFAULT (date('now')),
        enregistre_par INTEGER REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eleve_id INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
        type_document TEXT NOT NULL CHECK(type_document IN ('ATTESTATION_SCOLARITE', 'CERTIFICAT_INSCRIPTION', 'RELEVE_NOTES', 'QUITTANCE_PAIEMENT')),
        titre TEXT NOT NULL,
        reference TEXT NOT NULL UNIQUE,
        statut TEXT NOT NULL DEFAULT 'DISPONIBLE' CHECK(statut IN ('DISPONIBLE', 'ARCHIVE')),
        date_generation TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'ANNONCE' CHECK(type IN ('ANNONCE', 'RESULTATS', 'EMPLOI_DU_TEMPS', 'SCOLARITE')),
        cible_type TEXT NOT NULL DEFAULT 'TOUS' CHECK(cible_type IN ('TOUS', 'FILIERE', 'CLASSE', 'ELEVE')),
        cible_id INTEGER,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS notifications_lues (
        notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lu_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (notification_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_email TEXT,
        action TEXT NOT NULL,
        ressource TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_eleves_matricule ON eleves(matricule);
      CREATE INDEX IF NOT EXISTS idx_eleves_classe ON eleves(classe_id);
      CREATE INDEX IF NOT EXISTS idx_notes_eleve ON notes(eleve_id);
      CREATE INDEX IF NOT EXISTS idx_notes_matiere ON notes(matiere_id);
      CREATE INDEX IF NOT EXISTS idx_paiements_eleve ON paiements(eleve_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
    `);

    db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
      1,
      'initial_relational_schema'
    );
  }

  if (!applied.has(2)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT NOT NULL UNIQUE,
        eleve_id INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
        montant REAL NOT NULL CHECK(montant > 0),
        devise TEXT NOT NULL DEFAULT 'XOF',
        canal TEXT NOT NULL CHECK(canal IN ('WAVE', 'ORANGE_MONEY', 'MTN_MOMO', 'CARTE_BANCAIRE')),
        provider TEXT NOT NULL DEFAULT 'ACADEMIA_PAY',
        provider_ref TEXT,
        telephone_payeur TEXT,
        libelle TEXT NOT NULL,
        statut TEXT NOT NULL DEFAULT 'EN_ATTENTE' CHECK(statut IN ('EN_ATTENTE', 'REUSSI', 'ECHOUE', 'ANNULE')),
        webhook_signature TEXT,
        paid_at TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_payment_tx_eleve ON payment_transactions(eleve_id);
      CREATE INDEX IF NOT EXISTS idx_payment_tx_statut ON payment_transactions(statut);
    `);

    db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
      2,
      'payment_gateway_transactions'
    );
  }
}

export function seedDatabaseIfEmpty(db: DatabaseSync) {
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (email, password_hash, role, nom, prenom, active) VALUES (?, ?, ?, ?, ?, 1)'
  );

  const adminPass = hashPassword('AdminHA2026!');
  const scolaritePass = hashPassword('Scolarite2026!');
  const profPass = hashPassword('Enseignant2026!');
  const studentPass = hashPassword('Etudiant2026!');

  const uSuperAdmin = Number(
    insertUser.run('admin@academie-ha.edu', adminPass, 'SUPER_ADMIN', 'Benoît', 'Hélène').lastInsertRowid
  );
  const uScolarite = Number(
    insertUser.run('scolarite@academie-ha.edu', scolaritePass, 'ADMIN_SCOLARITE', 'Kouassi', 'Marc').lastInsertRowid
  );
  const uProf1 = Number(
    insertUser.run('n.mercier@academie-ha.edu', profPass, 'ENSEIGNANT', 'Mercier', 'Nicolas').lastInsertRowid
  );
  const uProf2 = Number(
    insertUser.run('s.benali@academie-ha.edu', profPass, 'ENSEIGNANT', 'Benali', 'Samira').lastInsertRowid
  );
  const uProf3 = Number(
    insertUser.run('t.lefevre@academie-ha.edu', profPass, 'ENSEIGNANT', 'Lefèvre', 'Thomas').lastInsertRowid
  );

  // Filières
  const insertFiliere = db.prepare(
    'INSERT INTO filieres (code, nom, description, frais_annuels) VALUES (?, ?, ?, ?)'
  );
  const fGL = Number(
    insertFiliere.run(
      'GL',
      'Génie Logiciel & Systèmes Distribués',
      'Architecture logicielle, API REST, conteneurisation et cloud.',
      1450000
    ).lastInsertRowid
  );
  const fCYB = Number(
    insertFiliere.run(
      'CYB',
      'Cybersécurité & Haute Disponibilité',
      'Réseaux résilients, HAProxy, réplication PostgreSQL et sécurité applicative.',
      1600000
    ).lastInsertRowid
  );
  const fDATA = Number(
    insertFiliere.run(
      'DATA',
      'Ingénierie des Données & IA',
      'Bases de données avancées, pipelines analytiques et apprentissage automatique.',
      1550000
    ).lastInsertRowid
  );

  // Niveaux
  const insertNiveau = db.prepare('INSERT INTO niveaux (code, nom, ordre) VALUES (?, ?, ?)');
  const nL2 = Number(insertNiveau.run('L2', 'Licence 2', 2).lastInsertRowid);
  const nL3 = Number(insertNiveau.run('L3', 'Licence 3', 3).lastInsertRowid);
  const nM1 = Number(insertNiveau.run('M1', 'Master 1', 4).lastInsertRowid);
  const nM2 = Number(insertNiveau.run('M2', 'Master 2', 5).lastInsertRowid);

  // Classes
  const insertClasse = db.prepare(
    'INSERT INTO classes (nom, filiere_id, niveau_id, annee_academique, capacite, salle_principale) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const cL3GL = Number(insertClasse.run('L3-GL-A', fGL, nL3, '2025-2026', 35, 'Labo Turing 204').lastInsertRowid);
  const cL2GL = Number(insertClasse.run('L2-GL-A', fGL, nL2, '2025-2026', 40, 'Amphi B-102').lastInsertRowid);
  const cM1CYB = Number(insertClasse.run('M1-CYB-A', fCYB, nM1, '2025-2026', 30, 'Salle Réseau 301').lastInsertRowid);
  const cM2DATA = Number(insertClasse.run('M2-DATA-A', fDATA, nM2, '2025-2026', 28, 'Labo Ada 402').lastInsertRowid);

  // Enseignants
  const insertEns = db.prepare(
    'INSERT INTO enseignants (user_id, matricule, nom, prenom, email, telephone, specialite) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const e1 = Number(
    insertEns.run(uProf1, 'ENS-2026-01', 'Mercier', 'Nicolas', 'n.mercier@academie-ha.edu', '+33 6 12 45 89 10', 'Bases de Données & Réplication').lastInsertRowid
  );
  const e2 = Number(
    insertEns.run(uProf2, 'ENS-2026-02', 'Benali', 'Samira', 's.benali@academie-ha.edu', '+33 6 28 74 11 03', 'Systèmes Distribués & HAProxy').lastInsertRowid
  );
  const e3 = Number(
    insertEns.run(uProf3, 'ENS-2026-03', 'Lefèvre', 'Thomas', 't.lefevre@academie-ha.edu', '+33 6 41 09 32 78', 'Développement Full-Stack & Sécurité').lastInsertRowid
  );

  // UEs & Matières
  const insertUE = db.prepare(
    'INSERT INTO ues (code, nom, filiere_id, niveau_id, semestre, credits) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertMat = db.prepare(
    'INSERT INTO matieres (code, nom, ue_id, coefficient, enseignant_id, volume_horaire) VALUES (?, ?, ?, ?, ?, ?)'
  );

  // L3 GL S1 & S2
  const ueGL1 = Number(insertUE.run('UE-GL301', 'Architecture & Bases de Données', fGL, nL3, 'S1', 12).lastInsertRowid);
  const ueGL2 = Number(insertUE.run('UE-GL302', 'Ingénierie Web & Sécurité', fGL, nL3, 'S1', 10).lastInsertRowid);
  const ueGL3 = Number(insertUE.run('UE-GL303', 'Systèmes & Haute Disponibilité', fGL, nL3, 'S2', 12).lastInsertRowid);

  const mBDD = Number(insertMat.run('INF-301', 'PostgreSQL & Réplication WAL', ueGL1, 4, e1, 48).lastInsertRowid);
  const mArch = Number(insertMat.run('INF-302', 'Architecture Microservices', ueGL1, 3, e3, 36).lastInsertRowid);
  const mWeb = Number(insertMat.run('INF-303', 'React, TypeScript & API REST', ueGL2, 3, e3, 42).lastInsertRowid);
  const mSec = Number(insertMat.run('INF-304', 'Sécurité Applicative & JWT', ueGL2, 2, e2, 30).lastInsertRowid);
  const mHA = Number(insertMat.run('INF-305', 'HAProxy, Keepalived & Patroni', ueGL3, 4, e2, 45).lastInsertRowid);
  const mDevOps = Number(insertMat.run('INF-306', 'Docker & Automatisation Ansible', ueGL3, 3, e1, 36).lastInsertRowid);

  // M1 CYB S1 & S2
  const ueCYB1 = Number(insertUE.run('UE-CYB401', 'Infrastructures Critiques HA', fCYB, nM1, 'S1', 12).lastInsertRowid);
  const ueCYB2 = Number(insertUE.run('UE-CYB402', 'Cryptographie & Audit', fCYB, nM1, 'S2', 12).lastInsertRowid);
  const mHAProxy = Number(insertMat.run('CYB-401', 'Load Balancing & Failover VRRP', ueCYB1, 4, e2, 48).lastInsertRowid);
  const mPgHA = Number(insertMat.run('CYB-402', 'Cluster PostgreSQL & Patroni', ueCYB1, 4, e1, 48).lastInsertRowid);
  const mAudit = Number(insertMat.run('CYB-403', 'Audit de Sécurité & Pentest', ueCYB2, 3, e3, 36).lastInsertRowid);

  // Students (including 2 featured demo accounts + 6 more for rich stats)
  const insertEleve = db.prepare(
    `INSERT INTO eleves (user_id, matricule, nom, prenom, email, telephone, date_naissance, adresse, contact_urgence, classe_id, statut)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const studentsSeed = [
    {
      email: 'amina.diallo@etudiant.academie-ha.edu',
      nom: 'Diallo',
      prenom: 'Amina',
      matricule: 'MAT-2026-001',
      tel: '+33 6 55 12 88 90',
      dob: '2004-05-14',
      addr: '18 Rue Pasteur, 69007 Lyon',
      urg: 'Mamadou Diallo (+33 6 11 22 33 44)',
      classeId: cL3GL,
      statut: 'ACTIF',
    },
    {
      email: 'lucas.morel@etudiant.academie-ha.edu',
      nom: 'Morel',
      prenom: 'Lucas',
      matricule: 'MAT-2026-002',
      tel: '+33 6 44 90 12 31',
      dob: '2003-11-22',
      addr: '42 Avenue Jean Jaurès, 69007 Lyon',
      urg: 'Claire Morel (+33 6 77 88 99 00)',
      classeId: cM1CYB,
      statut: 'ACTIF',
    },
    {
      email: 'chloe.bernard@etudiant.academie-ha.edu',
      nom: 'Bernard',
      prenom: 'Chloé',
      matricule: 'MAT-2026-003',
      tel: '+33 6 33 41 20 19',
      dob: '2004-02-08',
      addr: '5 Place Bellecour, 69002 Lyon',
      urg: 'Pierre Bernard (+33 6 14 25 36 47)',
      classeId: cL3GL,
      statut: 'ACTIF',
    },
    {
      email: 'yanis.tazi@etudiant.academie-ha.edu',
      nom: 'Tazi',
      prenom: 'Yanis',
      matricule: 'MAT-2026-004',
      tel: '+33 6 71 09 45 62',
      dob: '2004-08-19',
      addr: '112 Cours Gambetta, 69003 Lyon',
      urg: 'Nadia Tazi (+33 6 82 91 02 13)',
      classeId: cL3GL,
      statut: 'ACTIF',
    },
    {
      email: 'ines.kone@etudiant.academie-ha.edu',
      nom: 'Koné',
      prenom: 'Inès',
      matricule: 'MAT-2026-005',
      tel: '+33 6 19 88 73 20',
      dob: '2003-04-30',
      addr: '9 Rue Garibaldi, 69006 Lyon',
      urg: 'Ibrahim Koné (+33 6 95 44 12 08)',
      classeId: cM1CYB,
      statut: 'ACTIF',
    },
    {
      email: 'hugo.lambert@etudiant.academie-ha.edu',
      nom: 'Lambert',
      prenom: 'Hugo',
      matricule: 'MAT-2026-006',
      tel: '+33 6 22 65 43 11',
      dob: '2005-01-12',
      addr: '27 Rue de la République, 69002 Lyon',
      urg: 'Sophie Lambert (+33 6 31 54 76 98)',
      classeId: cL2GL,
      statut: 'ACTIF',
    },
    {
      email: 'sarah.mansouri@etudiant.academie-ha.edu',
      nom: 'Mansouri',
      prenom: 'Sarah',
      matricule: 'MAT-2026-007',
      tel: '+33 6 88 32 19 45',
      dob: '2002-09-25',
      addr: '74 Boulevard Vivier-Merle, 69003 Lyon',
      urg: 'Karim Mansouri (+33 6 60 12 39 87)',
      classeId: cM2DATA,
      statut: 'ACTIF',
    },
    {
      email: 'theo.dubois@etudiant.academie-ha.edu',
      nom: 'Dubois',
      prenom: 'Théo',
      matricule: 'MAT-2026-008',
      tel: '+33 6 47 58 69 70',
      dob: '2004-12-03',
      addr: '14 Rue Mercière, 69002 Lyon',
      urg: 'Marc Dubois (+33 6 09 87 65 43)',
      classeId: cL3GL,
      statut: 'ACTIF',
    },
  ];

  const eleveIds: number[] = [];
  for (const s of studentsSeed) {
    const uid = Number(
      insertUser.run(s.email, studentPass, 'ETUDIANT', s.nom, s.prenom).lastInsertRowid
    );
    const eid = Number(
      insertEleve.run(
        uid,
        s.matricule,
        s.nom,
        s.prenom,
        s.email,
        s.tel,
        s.dob,
        s.addr,
        s.urg,
        s.classeId,
        s.statut
      ).lastInsertRowid
    );
    eleveIds.push(eid);
  }

  // Inscriptions
  const insertInsc = db.prepare(
    'INSERT INTO inscriptions (eleve_id, classe_id, annee_academique, type_inscription, statut) VALUES (?, ?, ?, ?, ?)'
  );
  eleveIds.forEach((eid, idx) => {
    insertInsc.run(eid, studentsSeed[idx].classeId, '2025-2026', idx % 3 === 0 ? 'NOUVELLE' : 'REINSCRIPTION', 'VALIDEE');
  });

  // Emplois du temps
  const insertEdt = db.prepare(
    'INSERT INTO emplois_du_temps (classe_id, matiere_id, enseignant_id, jour_semaine, heure_debut, heure_fin, salle, type_cours) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  // L3-GL-A
  insertEdt.run(cL3GL, mBDD, e1, 'Lundi', '08:30', '10:30', 'Labo Turing 204', 'CM');
  insertEdt.run(cL3GL, mWeb, e3, 'Lundi', '10:45', '12:45', 'Labo Turing 204', 'TP');
  insertEdt.run(cL3GL, mArch, e3, 'Mardi', '09:00', '11:00', 'Amphi A-101', 'CM');
  insertEdt.run(cL3GL, mSec, e2, 'Mercredi', '14:00', '16:00', 'Salle Réseau 301', 'TD');
  insertEdt.run(cL3GL, mHA, e2, 'Jeudi', '08:30', '11:30', 'Labo Cloud 305', 'TP');
  insertEdt.run(cL3GL, mDevOps, e1, 'Vendredi', '13:30', '16:30', 'Labo Turing 204', 'TP');
  // M1-CYB-A
  insertEdt.run(cM1CYB, mHAProxy, e2, 'Lundi', '09:00', '12:00', 'Salle Réseau 301', 'CM');
  insertEdt.run(cM1CYB, mPgHA, e1, 'Mardi', '14:00', '17:00', 'Labo Cloud 305', 'TP');
  insertEdt.run(cM1CYB, mAudit, e3, 'Jeudi', '10:00', '12:00', 'Salle 208', 'TD');

  // Notes (Amina = eleveIds[0], Lucas = eleveIds[1], etc.)
  const insertNote = db.prepare(
    'INSERT INTO notes (eleve_id, matiere_id, matiere, semestre, type_evaluation, valeur, commentaire, publie, saisi_par) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  // Amina (L3-GL-A) - S1 Published
  insertNote.run(eleveIds[0], mBDD, 'PostgreSQL & Réplication WAL', 'S1', 'CC', 16.5, 'Excellente maîtrise du streaming WAL.', 1, uProf1);
  insertNote.run(eleveIds[0], mBDD, 'PostgreSQL & Réplication WAL', 'S1', 'Examen', 17.0, 'Très bonne copie.', 1, uProf1);
  insertNote.run(eleveIds[0], mArch, 'Architecture Microservices', 'S1', 'CC', 15.0, 'Bon travail pratique.', 1, uProf3);
  insertNote.run(eleveIds[0], mArch, 'Architecture Microservices', 'S1', 'Examen', 14.5, 'Analyse solide.', 1, uProf3);
  insertNote.run(eleveIds[0], mWeb, 'React, TypeScript & API REST', 'S1', 'TP', 18.0, 'Architecture modulaire exemplaire.', 1, uProf3);
  insertNote.run(eleveIds[0], mWeb, 'React, TypeScript & API REST', 'S1', 'Examen', 16.0, 'Code propre.', 1, uProf3);
  insertNote.run(eleveIds[0], mSec, 'Sécurité Applicative & JWT', 'S1', 'Examen', 15.5, 'RBAC bien implémenté.', 1, uProf2);
  // S2 Amina (1 published, 1 unpublished draft to test publish flow!)
  insertNote.run(eleveIds[0], mHA, 'HAProxy, Keepalived & Patroni', 'S2', 'TP', 17.5, 'Failover testé en 1.8s.', 1, uProf2);
  insertNote.run(eleveIds[0], mDevOps, 'Docker & Automatisation Ansible', 'S2', 'CC', 16.0, 'Playbooks idempotents.', 0, uProf1);

  // Chloé, Yanis, Théo (L3-GL-A)
  insertNote.run(eleveIds[2], mBDD, 'PostgreSQL & Réplication WAL', 'S1', 'Examen', 13.5, 'Assez bien.', 1, uProf1);
  insertNote.run(eleveIds[2], mWeb, 'React, TypeScript & API REST', 'S1', 'Examen', 14.0, 'Bon rendu.', 1, uProf3);
  insertNote.run(eleveIds[2], mArch, 'Architecture Microservices', 'S1', 'Examen', 12.5, 'Correct.', 1, uProf3);
  insertNote.run(eleveIds[3], mBDD, 'PostgreSQL & Réplication WAL', 'S1', 'Examen', 11.0, 'Passable.', 1, uProf1);
  insertNote.run(eleveIds[3], mWeb, 'React, TypeScript & API REST', 'S1', 'Examen', 9.5, 'À consolider.', 1, uProf3);
  insertNote.run(eleveIds[7], mBDD, 'PostgreSQL & Réplication WAL', 'S1', 'Examen', 15.0, 'Bon niveau.', 1, uProf1);

  // Lucas & Inès (M1-CYB-A)
  insertNote.run(eleveIds[1], mHAProxy, 'Load Balancing & Failover VRRP', 'S1', 'TP', 16.5, 'VIP Keepalived opérationnelle.', 1, uProf2);
  insertNote.run(eleveIds[1], mHAProxy, 'Load Balancing & Failover VRRP', 'S1', 'Examen', 15.5, 'Très bien.', 1, uProf2);
  insertNote.run(eleveIds[1], mPgHA, 'Cluster PostgreSQL & Patroni', 'S1', 'Examen', 14.8, 'Bonne compréhension etcd.', 1, uProf1);
  insertNote.run(eleveIds[4], mHAProxy, 'Load Balancing & Failover VRRP', 'S1', 'Examen', 17.2, 'Excellent.', 1, uProf2);
  insertNote.run(eleveIds[4], mPgHA, 'Cluster PostgreSQL & Patroni', 'S1', 'Examen', 16.0, 'Très rigoureux.', 1, uProf1);

  // Paiements
  const insertPay = db.prepare(
    'INSERT INTO paiements (eleve_id, reference, montant, mode_paiement, libelle, date_paiement, enregistre_par) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  insertPay.run(eleveIds[0], 'PAY-2026-0001', 750000, 'VIREMENT', 'Acompte inscription L3 GL (Tranche 1)', '2025-09-18', uScolarite);
  insertPay.run(eleveIds[0], 'PAY-2026-0042', 400000, 'CARTE', 'Deuxième tranche scolarité 2025-2026', '2026-01-12', uScolarite);
  insertPay.run(eleveIds[1], 'PAY-2026-0008', 1600000, 'VIREMENT', 'Règlement intégral M1 Cybersécurité', '2025-09-22', uScolarite);
  insertPay.run(eleveIds[2], 'PAY-2026-0015', 900000, 'MOBILE_MONEY', 'Tranche 1 scolarité L3 GL', '2025-10-03', uScolarite);
  insertPay.run(eleveIds[3], 'PAY-2026-0021', 600000, 'ESPECES', 'Frais d’inscription L3 GL', '2025-10-08', uScolarite);
  insertPay.run(eleveIds[4], 'PAY-2026-0029', 1200000, 'VIREMENT', 'Tranches 1 & 2 M1 Cybersécurité', '2025-11-15', uScolarite);

  // Documents administratifs
  const insertDoc = db.prepare(
    'INSERT INTO documents (eleve_id, type_document, titre, reference, statut) VALUES (?, ?, ?, ?, ?)'
  );
  insertDoc.run(eleveIds[0], 'ATTESTATION_SCOLARITE', 'Attestation de Scolarité 2025-2026', 'DOC-2026-001A', 'DISPONIBLE');
  insertDoc.run(eleveIds[0], 'CERTIFICAT_INSCRIPTION', 'Certificat d’Inscription L3 Génie Logiciel', 'DOC-2026-001B', 'DISPONIBLE');
  insertDoc.run(eleveIds[1], 'ATTESTATION_SCOLARITE', 'Attestation de Scolarité 2025-2026', 'DOC-2026-002A', 'DISPONIBLE');
  insertDoc.run(eleveIds[1], 'CERTIFICAT_INSCRIPTION', 'Certificat d’Inscription M1 Cybersécurité', 'DOC-2026-002B', 'DISPONIBLE');

  // Notifications
  const insertNotif = db.prepare(
    'INSERT INTO notifications (titre, message, type, cible_type, cible_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertNotif.run(
    'Publication des résultats du Semestre 1',
    'Les notes et moyennes du Semestre 1 (2025-2026) sont officiellement disponibles dans votre espace Résultats.',
    'RESULTATS',
    'TOUS',
    null,
    uScolarite
  );
  insertNotif.run(
    'Travaux pratiques Cluster PostgreSQL & Patroni',
    'Le créneau TP de Jeudi 08h30 pour la classe L3-GL-A se tiendra en Labo Cloud 305 (cluster HA opérationnel).',
    'EMPLOI_DU_TEMPS',
    'CLASSE',
    cL3GL,
    uProf2
  );
  insertNotif.run(
    'Échéance solde scolarité — Semestre 2',
    'Rappel : le règlement de la dernière tranche des frais de scolarité est attendu avant le 30 mars 2026.',
    'SCOLARITE',
    'TOUS',
    null,
    uScolarite
  );

  // Audit logs
  const insertAudit = db.prepare(
    'INSERT INTO audit_logs (user_id, user_email, action, ressource, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertAudit.run(uSuperAdmin, 'admin@academie-ha.edu', 'INITIALISATION_SYSTEME', 'DATABASE', 'Migration v1 et jeu de données académique initialisé', '127.0.0.1');
  insertAudit.run(uScolarite, 'scolarite@academie-ha.edu', 'PUBLICATION_NOTES', 'SEMESTRE_S1', 'Publication des résultats S1 pour L3-GL-A et M1-CYB-A', '192.168.56.21');

  // Seed gateway transactions matching seeded digital payments
  const insertTx = db.prepare(
    `INSERT INTO payment_transactions
      (transaction_id, eleve_id, montant, devise, canal, provider, provider_ref, telephone_payeur, libelle, statut, paid_at)
     VALUES (?, ?, ?, 'XOF', ?, 'ACADEMIA_PAY', ?, ?, ?, 'REUSSI', ?)`
  );
  insertTx.run(
    'TX-2026-SEED01',
    eleveIds[0],
    400000,
    'CARTE_BANCAIRE',
    'GW-CAR-9F42A1B0',
    '+33 6 55 12 88 90',
    'Deuxième tranche scolarité 2025-2026',
    '2026-01-12 10:15:00'
  );
  insertTx.run(
    'TX-2026-SEED02',
    eleveIds[2],
    900000,
    'WAVE',
    'GW-WAV-3C81E7D4',
    '+33 6 33 41 20 19',
    'Tranche 1 scolarité L3 GL',
    '2025-10-03 14:22:00'
  );
}
