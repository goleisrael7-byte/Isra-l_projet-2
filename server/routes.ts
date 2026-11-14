import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import {
  calculateAnnualAverage,
  calculateSemesterSummary,
  calculateSubjectAverages,
  formatMatricule,
  type GradeEntry,
} from './calculations.ts';
import { INFRA_ARTIFACTS } from './infraArtifacts.ts';
import { buildOpenApiSpec } from './openapi.ts';
import {
  formatChannelLabel,
  initiateGatewayCheckout,
  mapChannelToPaymentMode,
  type PaymentChannel,
  verifyPaymentSignature,
} from './paymentGateway.ts';
import { cache, dbCircuitBreaker, logger, withRetry } from './resilience.ts';
import {
  type AuthenticatedRequest,
  createRateLimiter,
  generateRefreshToken,
  hashPassword,
  hashToken,
  REFRESH_TTL_DAYS,
  requireAuth,
  requireRoles,
  sanitizeText,
  signAccessToken,
  type UserRole,
  verifyPassword,
} from './security.ts';

function recordAudit(
  db: DatabaseSync,
  userId: number | null,
  userEmail: string | null,
  action: string,
  ressource: string,
  details: string,
  ip?: string
) {
  try {
    db.prepare(
      'INSERT INTO audit_logs (user_id, user_email, action, ressource, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, userEmail, action, ressource, details, ip || '127.0.0.1');
  } catch (err) {
    logger.log('ERROR', 'AUDIT', 'Failed to write audit log', { error: String(err) });
  }
}

function getStudentFullTranscript(db: DatabaseSync, eleveId: number, publishedOnly: boolean) {
  const query = `
    SELECT
      n.id,
      n.matiere_id as matiereId,
      COALESCE(m.nom, n.matiere) as matiereNom,
      COALESCE(m.code, 'MAT') as matiereCode,
      COALESCE(u.nom, 'Unité Générale') as ueNom,
      COALESCE(u.code, 'UE-GEN') as ueCode,
      COALESCE(u.credits, 4) as credits,
      COALESCE(m.coefficient, 2) as coefficient,
      n.semestre,
      n.type_evaluation as typeEvaluation,
      n.valeur,
      n.commentaire,
      n.publie,
      n.updated_at as updatedAt
    FROM notes n
    LEFT JOIN matieres m ON n.matiere_id = m.id
    LEFT JOIN ues u ON m.ue_id = u.id
    WHERE n.eleve_id = ? ${publishedOnly ? 'AND n.publie = 1' : ''}
    ORDER BY n.semestre ASC, m.code ASC, n.id ASC
  `;
  const rows = db.prepare(query).all(eleveId) as unknown as (Omit<GradeEntry, 'publie'> & {
    id: number;
    commentaire: string | null;
    updatedAt: string;
    publie: number;
  })[];

  const mapped: GradeEntry[] = rows.map((r) => ({
    ...r,
    publie: Boolean(r.publie),
  }));

  const subjectAverages = calculateSubjectAverages(mapped);
  const s1 = calculateSemesterSummary('S1', subjectAverages);
  const s2 = calculateSemesterSummary('S2', subjectAverages);
  const annualAverage = calculateAnnualAverage(s1, s2);

  return {
    rawNotes: rows,
    s1,
    s2,
    annualAverage,
    totalCreditsObtenus: s1.creditsObtenus + s2.creditsObtenus,
    totalCredits: s1.creditsTotaux + s2.creditsTotaux,
  };
}

export function registerRoutes(app: Express, db: DatabaseSync) {
  const authLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30, name: 'auth' });
  const apiLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 300, name: 'api' });

  app.use('/api', apiLimiter);

  // ============================================================================
  // 1. HIGH AVAILABILITY & OPENAPI ENDPOINTS (Projet 6 Spec)
  // ============================================================================
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      await dbCircuitBreaker.execute(async () => {
        await withRetry(async () => {
          db.prepare('SELECT 1 as ok').get();
        }, 2, 50);
      });
      res.status(200).json({
        status: 'ok',
        db: 'connected',
        server: process.env.INSTANCE_NAME || os.hostname(),
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(503).json({
        status: 'ko',
        error: err instanceof Error ? err.message : 'Database unavailable',
      });
    }
  });

  app.get('/whoami', (_req: Request, res: Response) => {
    res.json({
      server: process.env.INSTANCE_NAME || os.hostname(),
      pid: process.pid,
      platform: os.platform(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/openapi.json', (_req: Request, res: Response) => {
    res.json(buildOpenApiSpec());
  });

  // ============================================================================
  // 2. AUTHENTICATION & SESSIONS (JWT + Refresh Tokens)
  // ============================================================================
  app.post('/api/auth/login', authLimiter, (req: Request, res: Response) => {
    const email = sanitizeText(req.body?.email, 180).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis.' });
      return;
    }

    const user = db
      .prepare('SELECT id, email, password_hash, role, nom, prenom, active FROM users WHERE lower(email) = ?')
      .get(email) as
      | {
          id: number;
          email: string;
          password_hash: string;
          role: UserRole;
          nom: string;
          prenom: string;
          active: number;
        }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      logger.log('WARN', 'AUTH', `Échec de connexion pour ${email}`, { ip: req.ip });
      res.status(401).json({ error: 'Identifiants invalides.' });
      return;
    }

    if (!user.active) {
      res.status(403).json({ error: 'Ce compte est désactivé. Contactez l’administration.' });
      return;
    }

    const eleve = db
      .prepare('SELECT id, statut FROM eleves WHERE user_id = ?')
      .get(user.id) as { id: number; statut: string } | undefined;

    if (user.role === 'ETUDIANT' && eleve && eleve.statut === 'INACTIF') {
      res.status(403).json({ error: 'Votre dossier étudiant est actuellement désactivé.' });
      return;
    }

    const enseignant = db
      .prepare('SELECT id FROM enseignants WHERE user_id = ?')
      .get(user.id) as { id: number } | undefined;

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
      eleveId: eleve?.id ?? null,
      enseignantId: enseignant?.id ?? null,
    });

    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000).toISOString();

    db.prepare(
      'INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(
      user.id,
      hashToken(refreshToken),
      sanitizeText(req.headers['user-agent'] || 'Navigateur Web', 200),
      req.ip || '127.0.0.1',
      expiresAt
    );

    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
    recordAudit(db, user.id, user.email, 'CONNEXION', 'SESSION', `Connexion réussie (${user.role})`, req.ip);
    logger.log('INFO', 'AUTH', `Connexion ${user.email} (${user.role})`);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        nom: user.nom,
        prenom: user.prenom,
        eleveId: eleve?.id ?? null,
        enseignantId: enseignant?.id ?? null,
      },
    });
  });

  app.post('/api/auth/refresh', (req: Request, res: Response) => {
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token manquant.' });
      return;
    }

    const tokenHash = hashToken(refreshToken);
    const session = db
      .prepare(
        `SELECT s.id, s.user_id, s.revoked, s.expires_at, u.email, u.role, u.nom, u.prenom, u.active
         FROM sessions s JOIN users u ON s.user_id = u.id
         WHERE s.refresh_token_hash = ?`
      )
      .get(tokenHash) as
      | {
          id: number;
          user_id: number;
          revoked: number;
          expires_at: string;
          email: string;
          role: UserRole;
          nom: string;
          prenom: string;
          active: number;
        }
      | undefined;

    if (!session || session.revoked || !session.active || new Date(session.expires_at) < new Date()) {
      res.status(401).json({ error: 'Session expirée ou révoquée.' });
      return;
    }

    const eleve = db.prepare('SELECT id FROM eleves WHERE user_id = ?').get(session.user_id) as
      | { id: number }
      | undefined;
    const enseignant = db.prepare('SELECT id FROM enseignants WHERE user_id = ?').get(session.user_id) as
      | { id: number }
      | undefined;

    const newRefreshToken = generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000).toISOString();

    db.prepare('UPDATE sessions SET refresh_token_hash = ?, expires_at = ? WHERE id = ?').run(
      hashToken(newRefreshToken),
      newExpiresAt,
      session.id
    );

    const accessToken = signAccessToken({
      sub: session.user_id,
      email: session.email,
      role: session.role,
      nom: session.nom,
      prenom: session.prenom,
      eleveId: eleve?.id ?? null,
      enseignantId: enseignant?.id ?? null,
    });

    res.json({ accessToken, refreshToken: newRefreshToken });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
    if (refreshToken) {
      db.prepare('UPDATE sessions SET revoked = 1 WHERE refresh_token_hash = ?').run(hashToken(refreshToken));
    }
    res.json({ status: 'logged_out' });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = db
      .prepare('SELECT id, email, role, nom, prenom, active, last_login FROM users WHERE id = ?')
      .get(req.user!.sub) as
      | { id: number; email: string; role: UserRole; nom: string; prenom: string; active: number; last_login: string }
      | undefined;

    if (!user || !user.active) {
      res.status(401).json({ error: 'Compte introuvable ou désactivé.' });
      return;
    }

    res.json({
      ...user,
      eleveId: req.user!.eleveId,
      enseignantId: req.user!.enseignantId,
    });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
      return;
    }

    const row = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(req.user!.sub) as { password_hash: string } | undefined;

    if (!row || !verifyPassword(currentPassword, row.password_hash)) {
      res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
      return;
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      hashPassword(newPassword),
      req.user!.sub
    );
    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'CHANGEMENT_MOT_DE_PASSE',
      'USER',
      'Mise à jour du mot de passe personnel',
      req.ip
    );
    res.json({ status: 'password_updated' });
  });

  // ============================================================================
  // 3. ADMINISTRATION SPACE (/api/admin/*)
  // ============================================================================
  const adminAccess = [requireAuth, requireRoles('SUPER_ADMIN', 'ADMIN_SCOLARITE', 'ENSEIGNANT')];
  const strictAdminAccess = [requireAuth, requireRoles('SUPER_ADMIN', 'ADMIN_SCOLARITE')];

  // A. Dashboard Analytics
  app.get('/api/admin/dashboard', ...adminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const cached = cache.get<unknown>('admin:dashboard');
    if (cached) {
      res.json(cached);
      return;
    }

    const totalEleves = (db.prepare('SELECT COUNT(*) as c FROM eleves').get() as { c: number }).c;
    const elevesActifs = (
      db.prepare("SELECT COUNT(*) as c FROM eleves WHERE statut = 'ACTIF'").get() as { c: number }
    ).c;
    const totalEnseignants = (db.prepare('SELECT COUNT(*) as c FROM enseignants').get() as { c: number }).c;
    const totalClasses = (db.prepare('SELECT COUNT(*) as c FROM classes').get() as { c: number }).c;
    const totalFilieres = (db.prepare('SELECT COUNT(*) as c FROM filieres').get() as { c: number }).c;

    const noteStats = db
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN valeur >= 10 THEN 1 ELSE 0 END) as reussies,
                ROUND(AVG(valeur), 2) as moyenneGenerale
         FROM notes`
      )
      .get() as { total: number; reussies: number; moyenneGenerale: number | null };

    const tauxReussite =
      noteStats.total > 0 ? Number(((noteStats.reussies / noteStats.total) * 100).toFixed(1)) : 0;

    const totalPaiements = (
      db.prepare('SELECT COALESCE(SUM(montant), 0) as s FROM paiements').get() as { s: number }
    ).s;

    const expectedFeesRow = db
      .prepare(
        `SELECT COALESCE(SUM(f.frais_annuels), 0) as expected
         FROM eleves e
         JOIN classes c ON e.classe_id = c.id
         JOIN filieres f ON c.filiere_id = f.id
         WHERE e.statut = 'ACTIF'`
      )
      .get() as { expected: number };

    const perfByFiliere = db
      .prepare(
        `SELECT f.code, f.nom,
                COUNT(DISTINCT e.id) as nbEleves,
                ROUND(AVG(n.valeur), 2) as moyenne,
                ROUND(100.0 * SUM(CASE WHEN n.valeur >= 10 THEN 1 ELSE 0 END) / NULLIF(COUNT(n.id), 0), 1) as tauxReussite
         FROM filieres f
         LEFT JOIN classes c ON c.filiere_id = f.id
         LEFT JOIN eleves e ON e.classe_id = c.id
         LEFT JOIN notes n ON n.eleve_id = e.id
         GROUP BY f.id
         ORDER BY f.nom`
      )
      .all();

    const enrollmentsByNiveau = db
      .prepare(
        `SELECT niv.code, niv.nom, COUNT(e.id) as total
         FROM niveaux niv
         LEFT JOIN classes c ON c.niveau_id = niv.id
         LEFT JOIN eleves e ON e.classe_id = c.id
         GROUP BY niv.id
         ORDER BY niv.ordre`
      )
      .all();

    const draftNotesCount = (
      db.prepare('SELECT COUNT(*) as c FROM notes WHERE publie = 0').get() as { c: number }
    ).c;

    const pendingTransactionsCount = (
      db.prepare("SELECT COUNT(*) as c FROM payment_transactions WHERE statut = 'EN_ATTENTE'").get() as { c: number }
    ).c;

    const totalInscriptions = (
      db.prepare('SELECT COUNT(*) as c FROM inscriptions').get() as { c: number }
    ).c;

    const recentStudents = db
      .prepare(
        `SELECT e.id, e.matricule, e.nom, e.prenom, e.email, e.statut, e.created_at,
                c.nom as classeNom, f.code as filiereCode, f.nom as filiereNom
         FROM eleves e
         LEFT JOIN classes c ON e.classe_id = c.id
         LEFT JOIN filieres f ON c.filiere_id = f.id
         ORDER BY e.id DESC
         LIMIT 4`
      )
      .all();

    const recentInscriptions = db
      .prepare(
        `SELECT i.id, i.eleve_id, i.annee_academique, i.type_inscription, i.statut, i.date_inscription,
                e.matricule, e.nom || ' ' || e.prenom as eleveNom,
                c.nom as classeNom, f.code as filiereCode
         FROM inscriptions i
         JOIN eleves e ON i.eleve_id = e.id
         JOIN classes c ON i.classe_id = c.id
         JOIN filieres f ON c.filiere_id = f.id
         ORDER BY i.id DESC
         LIMIT 4`
      )
      .all();

    const pendingTransactions = db
      .prepare(
        `SELECT pt.id, pt.transaction_id, pt.eleve_id, pt.montant, pt.devise, pt.canal, pt.provider,
                pt.statut, pt.webhook_signature, pt.created_at,
                e.matricule, e.email as eleveEmail, e.nom || ' ' || e.prenom as eleveNom
         FROM payment_transactions pt
         JOIN eleves e ON pt.eleve_id = e.id
         ORDER BY CASE WHEN pt.statut = 'EN_ATTENTE' THEN 0 ELSE 1 END, pt.id DESC
         LIMIT 3`
      )
      .all();

    const recentAudit = db
      .prepare('SELECT id, user_email, action, ressource, details, created_at FROM audit_logs ORDER BY id DESC LIMIT 6')
      .all();

    const recentNotifications = db
      .prepare('SELECT id, titre, type, cible_type, created_at FROM notifications ORDER BY id DESC LIMIT 5')
      .all();

    const payload = {
      kpis: {
        totalEleves,
        elevesActifs,
        totalEnseignants,
        totalClasses,
        totalFilieres,
        tauxReussite,
        moyenneGenerale: noteStats.moyenneGenerale ?? 0,
        totalPaiements,
        fraisAttendus: expectedFeesRow.expected,
        draftNotesCount,
        pendingTransactionsCount,
        totalInscriptions,
      },
      perfByFiliere,
      enrollmentsByNiveau,
      recentStudents,
      recentInscriptions,
      pendingTransactions,
      recentAudit,
      recentNotifications,
    };

    cache.set('admin:dashboard', payload, 20_000);
    res.json(payload);
  });

  // B. Students Management
  app.get('/api/admin/students', ...adminAccess, (req: AuthenticatedRequest, res: Response) => {
    const q = sanitizeText(req.query.q, 100).toLowerCase();
    const filiereId = Number(req.query.filiereId) || null;
    const classeId = Number(req.query.classeId) || null;
    const statut = sanitizeText(req.query.statut, 20);

    let sql = `
      SELECT e.*, c.nom as classeNom, f.id as filiereId, f.nom as filiereNom, f.code as filiereCode,
             niv.code as niveauCode,
             (SELECT ROUND(AVG(n.valeur), 2) FROM notes n WHERE n.eleve_id = e.id) as moyenneGenerale,
             (SELECT COALESCE(SUM(p.montant), 0) FROM paiements p WHERE p.eleve_id = e.id) as totalPaye,
             COALESCE(f.frais_annuels, 0) as fraisAnnuels
      FROM eleves e
      LEFT JOIN classes c ON e.classe_id = c.id
      LEFT JOIN filieres f ON c.filiere_id = f.id
      LEFT JOIN niveaux niv ON c.niveau_id = niv.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (q) {
      sql += ` AND (lower(e.nom) LIKE ? OR lower(e.prenom) LIKE ? OR lower(e.matricule) LIKE ? OR lower(e.email) LIKE ? OR lower(COALESCE(f.nom, '')) LIKE ?)`;
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }
    if (filiereId) {
      sql += ' AND f.id = ?';
      params.push(filiereId);
    }
    if (classeId) {
      sql += ' AND e.classe_id = ?';
      params.push(classeId);
    }
    if (statut && ['ACTIF', 'INACTIF', 'DIPLOME'].includes(statut)) {
      sql += ' AND e.statut = ?';
      params.push(statut);
    }

    sql += ' ORDER BY e.id DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  });

  function computeNextUniqueMatricule(year = 2026): string {
    const rows = db.prepare('SELECT matricule FROM eleves WHERE matricule LIKE ?').all(`MAT-${year}-%`) as {
      matricule: string;
    }[];
    let maxSeq = 0;
    for (const row of rows) {
      const match = /^MAT-\d{4}-(\d+)$/.exec(row.matricule);
      if (match) {
        const n = Number(match[1]);
        if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
      }
    }
    const maxId = (db.prepare('SELECT COALESCE(MAX(id), 0) as maxId FROM eleves').get() as { maxId: number }).maxId;
    let seq = Math.max(maxSeq, maxId) + 1;
    let candidate = formatMatricule(year, seq);
    while (db.prepare('SELECT 1 FROM eleves WHERE matricule = ?').get(candidate)) {
      seq += 1;
      candidate = formatMatricule(year, seq);
    }
    return candidate;
  }

  app.get('/api/admin/students/next-matricule', ...strictAdminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const year = 2026;
    res.json({ matricule: computeNextUniqueMatricule(year), year });
  });

  app.post('/api/admin/students', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const nom = sanitizeText(req.body?.nom, 100);
    const prenom = sanitizeText(req.body?.prenom, 100);
    const email = sanitizeText(req.body?.email, 180).toLowerCase();
    const telephone = sanitizeText(req.body?.telephone, 40);
    const dateNaissance = sanitizeText(req.body?.date_naissance, 20);
    const adresse = sanitizeText(req.body?.adresse, 200);
    const contactUrgence = sanitizeText(req.body?.contact_urgence, 150);
    const anneeAcademique = sanitizeText(req.body?.annee_academique, 20) || '2025-2026';
    const rawTypeInscription = sanitizeText(req.body?.type_inscription, 20).toUpperCase() || 'NOUVELLE';
    const requestedMatricule = sanitizeText(req.body?.matricule, 30).toUpperCase();
    const rawClasseId = req.body?.classe_id !== undefined && req.body?.classe_id !== null && req.body?.classe_id !== ''
      ? Number(req.body.classe_id)
      : null;
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

    const fieldErrors: Record<string, string> = {};

    if (!prenom || prenom.length < 2) {
      fieldErrors.prenom = 'Le prénom doit contenir au moins 2 caractères.';
    }
    if (!nom || nom.length < 2) {
      fieldErrors.nom = 'Le nom doit contenir au moins 2 caractères.';
    }
    if (!email) {
      fieldErrors.email = 'L’adresse email institutionnelle est obligatoire.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      fieldErrors.email = 'Format d’adresse email invalide.';
    }
    if (telephone && !/^[+\d\s().-]{7,25}$/.test(telephone)) {
      fieldErrors.telephone = 'Numéro de téléphone invalide (7 à 25 caractères).';
    }
    if (dateNaissance) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateNaissance)) {
        fieldErrors.date_naissance = 'Format de date invalide (AAAA-MM-JJ).';
      } else {
        const dob = new Date(`${dateNaissance}T00:00:00Z`);
        const now = new Date();
        const age = (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (Number.isNaN(dob.getTime()) || age < 14 || age > 90) {
          fieldErrors.date_naissance = 'L’âge de l’étudiant doit être compris entre 14 et 90 ans.';
        }
      }
    }
    if (rawPassword && rawPassword.length < 6) {
      fieldErrors.password = 'Le mot de passe initial doit contenir au moins 6 caractères.';
    }
    if (!['NOUVELLE', 'REINSCRIPTION'].includes(rawTypeInscription)) {
      fieldErrors.type_inscription = 'Type d’inscription invalide.';
    }
    if (!/^\d{4}-\d{4}$/.test(anneeAcademique)) {
      fieldErrors.annee_academique = 'Format d’année académique invalide (ex. 2025-2026).';
    }
    if (requestedMatricule && !/^[A-Z0-9-]{4,30}$/.test(requestedMatricule)) {
      fieldErrors.matricule = 'Le matricule doit contenir 4 à 30 caractères alphanumériques ou tirets.';
    }

    let classeId: number | null = null;
    if (rawClasseId !== null) {
      if (Number.isNaN(rawClasseId)) {
        fieldErrors.classe_id = 'Identifiant de classe invalide.';
      } else {
        const cls = db.prepare('SELECT id FROM classes WHERE id = ?').get(rawClasseId) as { id: number } | undefined;
        if (!cls) {
          fieldErrors.classe_id = 'La classe sélectionnée est introuvable.';
        } else {
          classeId = cls.id;
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      res.status(400).json({ error: Object.values(fieldErrors)[0], fieldErrors });
      return;
    }

    const existsUser = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email);
    const existsEleve = db.prepare('SELECT id FROM eleves WHERE lower(email) = ?').get(email);
    if (existsUser || existsEleve) {
      res.status(409).json({
        error: 'Un compte existe déjà avec cet email.',
        fieldErrors: { email: 'Cette adresse email est déjà attribuée à un autre utilisateur.' },
      });
      return;
    }

    let matricule = requestedMatricule;
    if (matricule) {
      const dupMat = db.prepare('SELECT id FROM eleves WHERE upper(matricule) = ?').get(matricule);
      if (dupMat) {
        res.status(409).json({
          error: `Le matricule ${matricule} est déjà attribué.`,
          fieldErrors: { matricule: `Le matricule ${matricule} est déjà utilisé.` },
        });
        return;
      }
    } else {
      matricule = computeNextUniqueMatricule(2026);
    }

    const finalPassword = rawPassword || 'Etudiant2026!';

    db.exec('BEGIN');
    try {
      const uid = Number(
        db
          .prepare('INSERT INTO users (email, password_hash, role, nom, prenom, active) VALUES (?, ?, ?, ?, ?, 1)')
          .run(email, hashPassword(finalPassword), 'ETUDIANT', nom, prenom).lastInsertRowid
      );

      const eid = Number(
        db
          .prepare(
            `INSERT INTO eleves (user_id, matricule, nom, prenom, email, telephone, date_naissance, adresse, contact_urgence, classe_id, statut)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF')`
          )
          .run(uid, matricule, nom, prenom, email, telephone, dateNaissance, adresse, contactUrgence, classeId)
          .lastInsertRowid
      );

      if (classeId) {
        db.prepare(
          'INSERT INTO inscriptions (eleve_id, classe_id, annee_academique, type_inscription, statut) VALUES (?, ?, ?, ?, ?)'
        ).run(eid, classeId, anneeAcademique, rawTypeInscription, 'VALIDEE');
      }

      db.prepare(
        `INSERT INTO notifications (titre, message, type, cible_type, cible_id, created_by)
         VALUES (?, ?, 'ANNONCE', 'ELEVE', ?, ?)`
      ).run(
        'Bienvenue sur AcademiaHA',
        `Votre dossier académique (${matricule}) est actif pour l’année ${anneeAcademique}. Consultez votre emploi du temps et votre situation de scolarité.`,
        eid,
        req.user!.sub
      );

      db.exec('COMMIT');
      cache.invalidatePrefix('admin:');
      recordAudit(
        db,
        req.user!.sub,
        req.user!.email,
        'CREATION_ETUDIANT',
        'ELEVE',
        `Création étudiant ${prenom} ${nom} (${matricule})`,
        req.ip
      );

      const created = db
        .prepare(
          `SELECT e.*, c.nom as classeNom, c.annee_academique as anneeAcademique,
                  f.id as filiereId, f.nom as filiereNom, f.code as filiereCode, f.frais_annuels as fraisAnnuels,
                  niv.nom as niveauNom, niv.code as niveauCode
           FROM eleves e
           LEFT JOIN classes c ON e.classe_id = c.id
           LEFT JOIN filieres f ON c.filiere_id = f.id
           LEFT JOIN niveaux niv ON c.niveau_id = niv.id
           WHERE e.id = ?`
        )
        .get(eid) as Record<string, unknown>;

      res.status(201).json({ ...created, initialPassword: finalPassword });
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error if transaction already closed
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur création étudiant' });
    }
  });

  app.put('/api/admin/students/:id', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM eleves WHERE id = ?').get(id) as
      | { id: number; user_id: number | null; matricule: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Étudiant introuvable.' });
      return;
    }

    const nom = sanitizeText(req.body?.nom, 100);
    const prenom = sanitizeText(req.body?.prenom, 100);
    const email = sanitizeText(req.body?.email, 180).toLowerCase();
    const telephone = sanitizeText(req.body?.telephone, 40);
    const dateNaissance = sanitizeText(req.body?.date_naissance, 20);
    const adresse = sanitizeText(req.body?.adresse, 200);
    const contactUrgence = sanitizeText(req.body?.contact_urgence, 150);
    const classeId = req.body?.classe_id ? Number(req.body.classe_id) : null;

    if (!nom || nom.length < 2 || !prenom || prenom.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      res.status(400).json({ error: 'Prénom, nom et adresse email valide sont requis.' });
      return;
    }

    const dupEleve = db.prepare('SELECT id FROM eleves WHERE lower(email) = ? AND id != ?').get(email, id);
    if (dupEleve) {
      res.status(409).json({ error: 'Cette adresse email est déjà utilisée par un autre étudiant.' });
      return;
    }

    db.prepare(
      `UPDATE eleves
       SET nom = ?, prenom = ?, email = ?, telephone = ?, date_naissance = ?, adresse = ?, contact_urgence = ?, classe_id = ?
       WHERE id = ?`
    ).run(nom, prenom, email, telephone, dateNaissance, adresse, contactUrgence, classeId, id);

    if (existing.user_id) {
      db.prepare('UPDATE users SET nom = ?, prenom = ?, email = ? WHERE id = ?').run(
        nom,
        prenom,
        email,
        existing.user_id
      );
    }

    cache.invalidatePrefix('admin:');
    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'MODIFICATION_ETUDIANT',
      'ELEVE',
      `Mise à jour dossier ${existing.matricule}`,
      req.ip
    );
    res.json(db.prepare('SELECT * FROM eleves WHERE id = ?').get(id));
  });

  app.patch('/api/admin/students/:id/status', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const statut = sanitizeText(req.body?.statut, 20);
    if (!['ACTIF', 'INACTIF', 'DIPLOME'].includes(statut)) {
      res.status(400).json({ error: 'Statut invalide.' });
      return;
    }

    const existing = db.prepare('SELECT id, user_id, matricule FROM eleves WHERE id = ?').get(id) as
      | { id: number; user_id: number | null; matricule: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Étudiant introuvable.' });
      return;
    }

    db.prepare('UPDATE eleves SET statut = ? WHERE id = ?').run(statut, id);
    if (existing.user_id) {
      db.prepare('UPDATE users SET active = ? WHERE id = ?').run(statut === 'INACTIF' ? 0 : 1, existing.user_id);
    }

    cache.invalidatePrefix('admin:');
    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'STATUT_ETUDIANT',
      'ELEVE',
      `Statut ${existing.matricule} -> ${statut}`,
      req.ip
    );
    res.json({ id, statut });
  });

  app.delete('/api/admin/students/:id', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id, user_id, matricule FROM eleves WHERE id = ?').get(id) as
      | { id: number; user_id: number | null; matricule: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Étudiant introuvable.' });
      return;
    }

    db.prepare('DELETE FROM eleves WHERE id = ?').run(id);
    if (existing.user_id) {
      db.prepare('DELETE FROM users WHERE id = ?').run(existing.user_id);
    }
    cache.invalidatePrefix('admin:');
    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'SUPPRESSION_ETUDIANT',
      'ELEVE',
      `Suppression définitive ${existing.matricule}`,
      req.ip
    );
    res.json({ deleted: true });
  });

  app.get('/api/admin/students/:id/dossier', ...adminAccess, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const student = db
      .prepare(
        `SELECT e.*, c.nom as classeNom, f.nom as filiereNom, f.code as filiereCode,
                COALESCE(f.frais_annuels, 0) as fraisAnnuels, niv.nom as niveauNom
         FROM eleves e
         LEFT JOIN classes c ON e.classe_id = c.id
         LEFT JOIN filieres f ON c.filiere_id = f.id
         LEFT JOIN niveaux niv ON c.niveau_id = niv.id
         WHERE e.id = ?`
      )
      .get(id);

    if (!student) {
      res.status(404).json({ error: 'Dossier étudiant introuvable.' });
      return;
    }

    const transcript = getStudentFullTranscript(db, id, false);
    const payments = db.prepare('SELECT * FROM paiements WHERE eleve_id = ? ORDER BY date_paiement DESC').all(id);
    const documents = db.prepare('SELECT * FROM documents WHERE eleve_id = ? ORDER BY date_generation DESC').all(id);
    const inscriptions = db
      .prepare(
        `SELECT i.*, c.nom as classeNom FROM inscriptions i LEFT JOIN classes c ON i.classe_id = c.id WHERE i.eleve_id = ? ORDER BY i.id DESC`
      )
      .all(id);

    res.json({ student, transcript, payments, documents, inscriptions });
  });

  app.get('/api/admin/students/export', ...adminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT e.matricule, e.nom, e.prenom, e.email, COALESCE(e.telephone, '') as telephone,
                COALESCE(c.nom, '') as classe, COALESCE(f.nom, '') as filiere, e.statut
         FROM eleves e
         LEFT JOIN classes c ON e.classe_id = c.id
         LEFT JOIN filieres f ON c.filiere_id = f.id
         ORDER BY e.matricule`
      )
      .all() as Record<string, string>[];

    const header = 'matricule;nom;prenom;email;telephone;classe;filiere;statut';
    const lines = rows.map((r) =>
      [r.matricule, r.nom, r.prenom, r.email, r.telephone, r.classe, r.filiere, r.statut]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(';')
    );
    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="etudiants-academia-ha.csv"');
    res.send('\uFEFF' + csv);
  });

  app.post('/api/admin/students/import', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const items = Array.isArray(req.body?.students) ? req.body.students : [];
    if (items.length === 0) {
      res.status(400).json({ error: 'Aucun étudiant fourni pour l’import.' });
      return;
    }

    let imported = 0;
    let skipped = 0;
    const defaultPass = hashPassword('Etudiant2026!');

    db.exec('BEGIN');
    try {
      for (const item of items) {
        const nom = sanitizeText(item.nom, 100);
        const prenom = sanitizeText(item.prenom, 100);
        const email = sanitizeText(item.email, 180).toLowerCase();
        const classeNom = sanitizeText(item.classe, 50);

        if (!nom || !prenom || !email) {
          skipped += 1;
          continue;
        }
        const exists = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email);
        if (exists) {
          skipped += 1;
          continue;
        }

        const classeRow = classeNom
          ? (db.prepare('SELECT id FROM classes WHERE lower(nom) = ?').get(classeNom.toLowerCase()) as
              | { id: number }
              | undefined)
          : undefined;

        const matricule = sanitizeText(item.matricule, 30).toUpperCase() || computeNextUniqueMatricule(2026);

        const uid = Number(
          db
            .prepare('INSERT INTO users (email, password_hash, role, nom, prenom, active) VALUES (?, ?, ?, ?, ?, 1)')
            .run(email, defaultPass, 'ETUDIANT', nom, prenom).lastInsertRowid
        );
        db.prepare(
          `INSERT INTO eleves (user_id, matricule, nom, prenom, email, telephone, classe_id, statut)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIF')`
        ).run(uid, matricule, nom, prenom, email, sanitizeText(item.telephone, 40), classeRow?.id ?? null);
        imported += 1;
      }
      db.exec('COMMIT');
      cache.invalidatePrefix('admin:');
      recordAudit(
        db,
        req.user!.sub,
        req.user!.email,
        'IMPORT_CSV_ETUDIANTS',
        'ELEVE',
        `${imported} importés, ${skipped} ignorés`,
        req.ip
      );
      res.json({ imported, skipped });
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur import' });
    }
  });

  // C. Pedagogy Management
  app.get('/api/admin/pedagogy', ...adminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const filieres = db.prepare('SELECT * FROM filieres ORDER BY nom').all();
    const niveaux = db.prepare('SELECT * FROM niveaux ORDER BY ordre').all();
    const classes = db
      .prepare(
        `SELECT c.*, f.nom as filiereNom, f.code as filiereCode, f.frais_annuels as fraisAnnuels,
                n.nom as niveauNom, n.code as niveauCode,
                (SELECT COUNT(*) FROM eleves e WHERE e.classe_id = c.id AND e.statut = 'ACTIF') as effectif
         FROM classes c
         LEFT JOIN filieres f ON c.filiere_id = f.id
         LEFT JOIN niveaux n ON c.niveau_id = n.id
         ORDER BY c.nom`
      )
      .all();
    const ues = db
      .prepare(
        `SELECT u.*, f.code as filiereCode, n.code as niveauCode
         FROM ues u
         LEFT JOIN filieres f ON u.filiere_id = f.id
         LEFT JOIN niveaux n ON u.niveau_id = n.id
         ORDER BY u.semestre, u.code`
      )
      .all();
    const matieres = db
      .prepare(
        `SELECT m.*, u.code as ueCode, u.nom as ueNom, u.semestre,
                ens.nom || ' ' || ens.prenom as enseignantNom
         FROM matieres m
         LEFT JOIN ues u ON m.ue_id = u.id
         LEFT JOIN enseignants ens ON m.enseignant_id = ens.id
         ORDER BY m.code`
      )
      .all();
    const enseignants = db.prepare('SELECT * FROM enseignants ORDER BY nom').all();
    const timetable = db
      .prepare(
        `SELECT t.*, c.nom as classeNom, m.nom as matiereNom, m.code as matiereCode,
                ens.nom || ' ' || ens.prenom as enseignantNom
         FROM emplois_du_temps t
         JOIN classes c ON t.classe_id = c.id
         JOIN matieres m ON t.matiere_id = m.id
         LEFT JOIN enseignants ens ON t.enseignant_id = ens.id
         ORDER BY CASE t.jour_semaine
           WHEN 'Lundi' THEN 1 WHEN 'Mardi' THEN 2 WHEN 'Mercredi' THEN 3
           WHEN 'Jeudi' THEN 4 WHEN 'Vendredi' THEN 5 ELSE 6 END, t.heure_debut`
      )
      .all();

    res.json({ filieres, niveaux, classes, ues, matieres, enseignants, timetable });
  });

  app.post('/api/admin/filieres', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const code = sanitizeText(req.body?.code, 20).toUpperCase();
    const nom = sanitizeText(req.body?.nom, 120);
    const description = sanitizeText(req.body?.description, 300);
    const frais = Number(req.body?.frais_annuels) || 1200000;
    if (!code || !nom) {
      res.status(400).json({ error: 'Code et nom requis.' });
      return;
    }
    try {
      const info = db
        .prepare('INSERT INTO filieres (code, nom, description, frais_annuels) VALUES (?, ?, ?, ?)')
        .run(code, nom, description, frais);
      cache.invalidatePrefix('admin:');
      res.status(201).json(db.prepare('SELECT * FROM filieres WHERE id = ?').get(info.lastInsertRowid));
    } catch {
      res.status(409).json({ error: 'Une filière avec ce code existe déjà.' });
    }
  });

  app.post('/api/admin/classes', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const nom = sanitizeText(req.body?.nom, 50);
    const filiereId = Number(req.body?.filiere_id) || null;
    const niveauId = Number(req.body?.niveau_id) || null;
    const capacite = Number(req.body?.capacite) || 35;
    const salle = sanitizeText(req.body?.salle_principale, 80) || 'Salle 101';
    if (!nom) {
      res.status(400).json({ error: 'Nom de classe requis.' });
      return;
    }
    try {
      const info = db
        .prepare(
          'INSERT INTO classes (nom, filiere_id, niveau_id, annee_academique, capacite, salle_principale) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(nom, filiereId, niveauId, '2025-2026', capacite, salle);
      cache.invalidatePrefix('admin:');
      res.status(201).json(db.prepare('SELECT * FROM classes WHERE id = ?').get(info.lastInsertRowid));
    } catch {
      res.status(409).json({ error: 'Nom de classe déjà utilisé.' });
    }
  });

  app.post('/api/admin/ues', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const code = sanitizeText(req.body?.code, 30).toUpperCase();
    const nom = sanitizeText(req.body?.nom, 120);
    const filiereId = Number(req.body?.filiere_id);
    const niveauId = Number(req.body?.niveau_id);
    const semestre = req.body?.semestre === 'S2' ? 'S2' : 'S1';
    const credits = Number(req.body?.credits) || 6;
    if (!code || !nom || !filiereId || !niveauId) {
      res.status(400).json({ error: 'Champs UE incomplets.' });
      return;
    }
    try {
      const info = db
        .prepare('INSERT INTO ues (code, nom, filiere_id, niveau_id, semestre, credits) VALUES (?, ?, ?, ?, ?, ?)')
        .run(code, nom, filiereId, niveauId, semestre, credits);
      res.status(201).json(db.prepare('SELECT * FROM ues WHERE id = ?').get(info.lastInsertRowid));
    } catch {
      res.status(409).json({ error: 'Code UE déjà existant.' });
    }
  });

  app.post('/api/admin/matieres', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const code = sanitizeText(req.body?.code, 30).toUpperCase();
    const nom = sanitizeText(req.body?.nom, 120);
    const ueId = Number(req.body?.ue_id);
    const coefficient = Number(req.body?.coefficient) || 2;
    const enseignantId = req.body?.enseignant_id ? Number(req.body.enseignant_id) : null;
    const volumeHoraire = Number(req.body?.volume_horaire) || 36;
    if (!code || !nom || !ueId) {
      res.status(400).json({ error: 'Code, nom et UE requis.' });
      return;
    }
    try {
      const info = db
        .prepare(
          'INSERT INTO matieres (code, nom, ue_id, coefficient, enseignant_id, volume_horaire) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(code, nom, ueId, coefficient, enseignantId, volumeHoraire);
      res.status(201).json(db.prepare('SELECT * FROM matieres WHERE id = ?').get(info.lastInsertRowid));
    } catch {
      res.status(409).json({ error: 'Code matière déjà existant.' });
    }
  });

  app.post('/api/admin/enseignants', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const nom = sanitizeText(req.body?.nom, 100);
    const prenom = sanitizeText(req.body?.prenom, 100);
    const email = sanitizeText(req.body?.email, 180).toLowerCase();
    const telephone = sanitizeText(req.body?.telephone, 40);
    const specialite = sanitizeText(req.body?.specialite, 120) || 'Informatique';
    if (!nom || !prenom || !email) {
      res.status(400).json({ error: 'Nom, prénom et email requis.' });
      return;
    }

    const exists = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email);
    if (exists) {
      res.status(409).json({ error: 'Un compte utilisateur existe déjà avec cet email.' });
      return;
    }

    const seq = (db.prepare('SELECT COALESCE(MAX(id), 0) + 1 as n FROM enseignants').get() as { n: number }).n;
    const matricule = `ENS-2026-${String(seq).padStart(2, '0')}`;
    const uid = Number(
      db
        .prepare('INSERT INTO users (email, password_hash, role, nom, prenom, active) VALUES (?, ?, ?, ?, ?, 1)')
        .run(email, hashPassword('Enseignant2026!'), 'ENSEIGNANT', nom, prenom).lastInsertRowid
    );
    const eid = Number(
      db
        .prepare(
          'INSERT INTO enseignants (user_id, matricule, nom, prenom, email, telephone, specialite) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(uid, matricule, nom, prenom, email, telephone, specialite).lastInsertRowid
    );
    cache.invalidatePrefix('admin:');
    res.status(201).json(db.prepare('SELECT * FROM enseignants WHERE id = ?').get(eid));
  });

  app.post('/api/admin/timetable', ...adminAccess, (req: AuthenticatedRequest, res: Response) => {
    const classeId = Number(req.body?.classe_id);
    const matiereId = Number(req.body?.matiere_id);
    const enseignantId = req.body?.enseignant_id ? Number(req.body.enseignant_id) : null;
    const jour = sanitizeText(req.body?.jour_semaine, 20);
    const heureDebut = sanitizeText(req.body?.heure_debut, 10);
    const heureFin = sanitizeText(req.body?.heure_fin, 10);
    const salle = sanitizeText(req.body?.salle, 60);
    const typeCours = ['CM', 'TD', 'TP'].includes(req.body?.type_cours) ? req.body.type_cours : 'CM';

    if (!classeId || !matiereId || !jour || !heureDebut || !heureFin || !salle) {
      res.status(400).json({ error: 'Tous les champs du créneau sont requis.' });
      return;
    }

    const info = db
      .prepare(
        `INSERT INTO emplois_du_temps (classe_id, matiere_id, enseignant_id, jour_semaine, heure_debut, heure_fin, salle, type_cours)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(classeId, matiereId, enseignantId, jour, heureDebut, heureFin, salle, typeCours);

    const mat = db.prepare('SELECT nom FROM matieres WHERE id = ?').get(matiereId) as { nom: string } | undefined;
    db.prepare(
      'INSERT INTO notifications (titre, message, type, cible_type, cible_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      'Mise à jour de l’emploi du temps',
      `Nouveau créneau programmé : ${mat?.nom || 'Cours'} (${typeCours}) le ${jour} de ${heureDebut} à ${heureFin} en ${salle}.`,
      'EMPLOI_DU_TEMPS',
      'CLASSE',
      classeId,
      req.user!.sub
    );

    res.status(201).json({ id: info.lastInsertRowid });
  });

  app.delete('/api/admin/timetable/:id', ...adminAccess, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM emplois_du_temps WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  // D. Grades & Results Management
  app.get('/api/admin/grades', ...adminAccess, (req: AuthenticatedRequest, res: Response) => {
    const classeId = Number(req.query.classeId) || null;
    const matiereId = Number(req.query.matiereId) || null;
    const semestre = sanitizeText(req.query.semestre, 5);
    const eleveId = Number(req.query.eleveId) || null;

    let sql = `
      SELECT n.*, e.matricule, e.nom as eleveNom, e.prenom as elevePrenom,
             c.id as classeId, c.nom as classeNom,
             m.code as matiereCode, COALESCE(m.nom, n.matiere) as matiereNom, COALESCE(m.coefficient, 2) as coefficient
      FROM notes n
      JOIN eleves e ON n.eleve_id = e.id
      LEFT JOIN classes c ON e.classe_id = c.id
      LEFT JOIN matieres m ON n.matiere_id = m.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    if (classeId) {
      sql += ' AND e.classe_id = ?';
      params.push(classeId);
    }
    if (matiereId) {
      sql += ' AND n.matiere_id = ?';
      params.push(matiereId);
    }
    if (semestre === 'S1' || semestre === 'S2') {
      sql += ' AND n.semestre = ?';
      params.push(semestre);
    }
    if (eleveId) {
      sql += ' AND n.eleve_id = ?';
      params.push(eleveId);
    }
    sql += ' ORDER BY n.updated_at DESC, n.id DESC';
    res.json(db.prepare(sql).all(...params));
  });

  app.post('/api/admin/grades', ...adminAccess, (req: AuthenticatedRequest, res: Response) => {
    const eleveId = Number(req.body?.eleve_id);
    const matiereId = Number(req.body?.matiere_id);
    const semestre = req.body?.semestre === 'S2' ? 'S2' : 'S1';
    const typeEvaluation = ['CC', 'TP', 'Examen'].includes(req.body?.type_evaluation)
      ? req.body.type_evaluation
      : 'Examen';
    const valeur = Number(req.body?.valeur);
    const commentaire = sanitizeText(req.body?.commentaire, 250);
    const publie = req.body?.publie ? 1 : 0;

    if (!eleveId || !matiereId || Number.isNaN(valeur) || valeur < 0 || valeur > 20) {
      res.status(400).json({ error: 'Étudiant, matière et note comprise entre 0 et 20 sont requis.' });
      return;
    }

    const mat = db.prepare('SELECT nom FROM matieres WHERE id = ?').get(matiereId) as { nom: string } | undefined;
    if (!mat) {
      res.status(404).json({ error: 'Matière introuvable.' });
      return;
    }

    const info = db
      .prepare(
        `INSERT INTO notes (eleve_id, matiere_id, matiere, semestre, type_evaluation, valeur, commentaire, publie, saisi_par)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(eleveId, matiereId, mat.nom, semestre, typeEvaluation, valeur, commentaire, publie, req.user!.sub);

    cache.invalidatePrefix('admin:');
    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'SAISIE_NOTE',
      'NOTE',
      `Note ${valeur}/20 (${typeEvaluation} ${semestre}) pour étudiant #${eleveId} en ${mat.nom}`,
      req.ip
    );
    res.status(201).json(db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid));
  });

  app.put('/api/admin/grades/:id', ...adminAccess, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const valeur = Number(req.body?.valeur);
    const commentaire = sanitizeText(req.body?.commentaire, 250);
    if (Number.isNaN(valeur) || valeur < 0 || valeur > 20) {
      res.status(400).json({ error: 'La note doit être comprise entre 0 et 20.' });
      return;
    }

    const info = db
      .prepare("UPDATE notes SET valeur = ?, commentaire = ?, updated_at = datetime('now') WHERE id = ?")
      .run(valeur, commentaire, id);

    if (info.changes === 0) {
      res.status(404).json({ error: 'Note introuvable.' });
      return;
    }
    cache.invalidatePrefix('admin:');
    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'MODIFICATION_NOTE',
      'NOTE',
      `Note #${id} modifiée -> ${valeur}/20`,
      req.ip
    );
    res.json(db.prepare('SELECT * FROM notes WHERE id = ?').get(id));
  });

  app.delete('/api/admin/grades/:id', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    cache.invalidatePrefix('admin:');
    res.json({ deleted: true });
  });

  app.post('/api/admin/grades/publish', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const classeId = Number(req.body?.classe_id);
    const semestre = req.body?.semestre === 'S2' ? 'S2' : 'S1';
    const publie = req.body?.publie === false ? 0 : 1;

    if (!classeId) {
      res.status(400).json({ error: 'Classe requise.' });
      return;
    }

    const info = db
      .prepare(
        `UPDATE notes
         SET publie = ?, updated_at = datetime('now')
         WHERE semestre = ? AND eleve_id IN (SELECT id FROM eleves WHERE classe_id = ?)`
      )
      .run(publie, semestre, classeId);

    const cls = db.prepare('SELECT nom FROM classes WHERE id = ?').get(classeId) as { nom: string } | undefined;

    if (publie === 1) {
      db.prepare(
        'INSERT INTO notifications (titre, message, type, cible_type, cible_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        `Publication des résultats ${semestre} — ${cls?.nom || 'Classe'}`,
        `Vos notes et moyennes officielles du semestre ${semestre} sont maintenant consultables dans votre espace Résultats.`,
        'RESULTATS',
        'CLASSE',
        classeId,
        req.user!.sub
      );
    }

    cache.invalidatePrefix('admin:');
    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      publie ? 'PUBLICATION_RESULTATS' : 'DEPUB_RESULTATS',
      'NOTE',
      `${info.changes} notes ${publie ? 'publiées' : 'masquées'} (${cls?.nom}, ${semestre})`,
      req.ip
    );
    res.json({ updated: info.changes, publie: Boolean(publie) });
  });

  app.get('/api/admin/grades/transcript/:eleveId', ...adminAccess, (req: AuthenticatedRequest, res: Response) => {
    const eleveId = Number(req.params.eleveId);
    const student = db
      .prepare(
        `SELECT e.*, c.nom as classeNom, f.nom as filiereNom, niv.nom as niveauNom
         FROM eleves e
         LEFT JOIN classes c ON e.classe_id = c.id
         LEFT JOIN filieres f ON c.filiere_id = f.id
         LEFT JOIN niveaux niv ON c.niveau_id = niv.id
         WHERE e.id = ?`
      )
      .get(eleveId);
    if (!student) {
      res.status(404).json({ error: 'Étudiant introuvable.' });
      return;
    }
    const transcript = getStudentFullTranscript(db, eleveId, false);
    res.json({ student, transcript });
  });

  // E. Finance, Inscriptions & Documents
  app.get('/api/admin/finance', ...strictAdminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const balances = db
      .prepare(
        `SELECT e.id, e.matricule, e.nom, e.prenom, c.nom as classeNom, f.nom as filiereNom,
                COALESCE(f.frais_annuels, 0) as fraisAnnuels,
                COALESCE((SELECT SUM(p.montant) FROM paiements p WHERE p.eleve_id = e.id), 0) as totalPaye
         FROM eleves e
         LEFT JOIN classes c ON e.classe_id = c.id
         LEFT JOIN filieres f ON c.filiere_id = f.id
         ORDER BY e.nom`
      )
      .all();

    const payments = db
      .prepare(
        `SELECT p.*, e.matricule, e.nom || ' ' || e.prenom as eleveNom
         FROM paiements p
         JOIN eleves e ON p.eleve_id = e.id
         ORDER BY p.date_paiement DESC, p.id DESC`
      )
      .all();

    const inscriptions = db
      .prepare(
        `SELECT i.*, e.matricule, e.nom || ' ' || e.prenom as eleveNom, c.nom as classeNom
         FROM inscriptions i
         JOIN eleves e ON i.eleve_id = e.id
         JOIN classes c ON i.classe_id = c.id
         ORDER BY i.id DESC`
      )
      .all();

    const documents = db
      .prepare(
        `SELECT d.*, e.matricule, e.nom || ' ' || e.prenom as eleveNom
         FROM documents d
         JOIN eleves e ON d.eleve_id = e.id
         ORDER BY d.id DESC`
      )
      .all();

    res.json({ balances, payments, inscriptions, documents });
  });

  app.post('/api/admin/inscriptions', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const eleveId = Number(req.body?.eleve_id);
    const classeId = Number(req.body?.classe_id);
    const annee = sanitizeText(req.body?.annee_academique, 20) || '2026-2027';
    const type = req.body?.type_inscription === 'NOUVELLE' ? 'NOUVELLE' : 'REINSCRIPTION';

    if (!eleveId || !classeId) {
      res.status(400).json({ error: 'Étudiant et classe requis.' });
      return;
    }

    const info = db
      .prepare(
        'INSERT INTO inscriptions (eleve_id, classe_id, annee_academique, type_inscription, statut) VALUES (?, ?, ?, ?, ?)'
      )
      .run(eleveId, classeId, annee, type, 'VALIDEE');

    db.prepare('UPDATE eleves SET classe_id = ? WHERE id = ?').run(classeId, eleveId);
    cache.invalidatePrefix('admin:');
    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'INSCRIPTION',
      'INSCRIPTION',
      `${type} étudiant #${eleveId} (${annee})`,
      req.ip
    );
    res.status(201).json({ id: info.lastInsertRowid });
  });

  app.post('/api/admin/payments', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const eleveId = Number(req.body?.eleve_id);
    const montant = Number(req.body?.montant);
    const mode = ['VIREMENT', 'CARTE', 'ESPECES', 'MOBILE_MONEY'].includes(req.body?.mode_paiement)
      ? req.body.mode_paiement
      : 'VIREMENT';
    const libelle = sanitizeText(req.body?.libelle, 180) || 'Règlement frais de scolarité';

    if (!eleveId || Number.isNaN(montant) || montant <= 0) {
      res.status(400).json({ error: 'Étudiant et montant positif requis.' });
      return;
    }

    const ref = `PAY-2026-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const info = db
      .prepare(
        'INSERT INTO paiements (eleve_id, reference, montant, mode_paiement, libelle, enregistre_par) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(eleveId, ref, montant, mode, libelle, req.user!.sub);

    const docRef = `QUI-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    db.prepare(
      'INSERT INTO documents (eleve_id, type_document, titre, reference, statut) VALUES (?, ?, ?, ?, ?)'
    ).run(eleveId, 'QUITTANCE_PAIEMENT', `Reçu de paiement ${ref} (${montant} FCFA)`, docRef, 'DISPONIBLE');

    db.prepare(
      'INSERT INTO notifications (titre, message, type, cible_type, cible_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      'Paiement enregistré',
      `Votre paiement de ${montant.toLocaleString('fr-FR')} FCFA (${ref}) a bien été validé. Votre reçu est disponible.`,
      'SCOLARITE',
      'ELEVE',
      eleveId,
      req.user!.sub
    );

    cache.invalidatePrefix('admin:');
    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'PAIEMENT_SCOLARITE',
      'PAIEMENT',
      `Paiement ${ref} de ${montant} FCFA pour étudiant #${eleveId}`,
      req.ip
    );
    res.status(201).json(db.prepare('SELECT * FROM paiements WHERE id = ?').get(info.lastInsertRowid));
  });

  app.post('/api/admin/documents/generate', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const eleveId = Number(req.body?.eleve_id);
    const typeDoc = ['ATTESTATION_SCOLARITE', 'CERTIFICAT_INSCRIPTION', 'RELEVE_NOTES'].includes(
      req.body?.type_document
    )
      ? req.body.type_document
      : 'ATTESTATION_SCOLARITE';

    if (!eleveId) {
      res.status(400).json({ error: 'Étudiant requis.' });
      return;
    }

    const titles: Record<string, string> = {
      ATTESTATION_SCOLARITE: 'Attestation de Scolarité 2025-2026',
      CERTIFICAT_INSCRIPTION: 'Certificat Officiel d’Inscription 2025-2026',
      RELEVE_NOTES: 'Relevé de Notes Officiel 2025-2026',
    };

    const ref = `DOC-2026-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const info = db
      .prepare(
        'INSERT INTO documents (eleve_id, type_document, titre, reference, statut) VALUES (?, ?, ?, ?, ?)'
      )
      .run(eleveId, typeDoc, titles[typeDoc], ref, 'DISPONIBLE');

    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'GENERATION_DOCUMENT',
      'DOCUMENT',
      `${typeDoc} (${ref}) généré pour étudiant #${eleveId}`,
      req.ip
    );
    res.status(201).json(db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid));
  });

  // F. Communication
  app.get('/api/admin/notifications', ...adminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT n.*, u.nom || ' ' || u.prenom as auteur
         FROM notifications n
         LEFT JOIN users u ON n.created_by = u.id
         ORDER BY n.id DESC LIMIT 50`
      )
      .all();
    res.json(rows);
  });

  app.post('/api/admin/notifications', ...adminAccess, (req: AuthenticatedRequest, res: Response) => {
    const titre = sanitizeText(req.body?.titre, 160);
    const message = sanitizeText(req.body?.message, 1000);
    const type = ['ANNONCE', 'RESULTATS', 'EMPLOI_DU_TEMPS', 'SCOLARITE'].includes(req.body?.type)
      ? req.body.type
      : 'ANNONCE';
    const cibleType = ['TOUS', 'FILIERE', 'CLASSE', 'ELEVE'].includes(req.body?.cible_type)
      ? req.body.cible_type
      : 'TOUS';
    const cibleId = req.body?.cible_id ? Number(req.body.cible_id) : null;

    if (!titre || !message) {
      res.status(400).json({ error: 'Titre et message sont requis.' });
      return;
    }

    const info = db
      .prepare(
        'INSERT INTO notifications (titre, message, type, cible_type, cible_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(titre, message, type, cibleType, cibleId, req.user!.sub);

    cache.invalidatePrefix('admin:');
    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'ENVOI_NOTIFICATION',
      'COMMUNICATION',
      `Notification "${titre}" (${cibleType})`,
      req.ip
    );
    res.status(201).json(db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid));
  });

  // G. Users, Sessions, Audit & HA Status
  app.get('/api/admin/users', ...strictAdminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db
      .prepare('SELECT id, email, role, nom, prenom, active, last_login, created_at FROM users ORDER BY id DESC')
      .all();
    res.json(rows);
  });

  app.post(
    '/api/admin/users',
    requireAuth,
    requireRoles('SUPER_ADMIN'),
    (req: AuthenticatedRequest, res: Response) => {
      const email = sanitizeText(req.body?.email, 180).toLowerCase();
      const nom = sanitizeText(req.body?.nom, 100);
      const prenom = sanitizeText(req.body?.prenom, 100);
      const role = ['SUPER_ADMIN', 'ADMIN_SCOLARITE', 'ENSEIGNANT'].includes(req.body?.role)
        ? req.body.role
        : 'ADMIN_SCOLARITE';
      const password = typeof req.body?.password === 'string' && req.body.password.length >= 8
        ? req.body.password
        : 'AdminHA2026!';

      if (!email || !nom || !prenom) {
        res.status(400).json({ error: 'Email, nom et prénom requis.' });
        return;
      }

      try {
        const info = db
          .prepare('INSERT INTO users (email, password_hash, role, nom, prenom, active) VALUES (?, ?, ?, ?, ?, 1)')
          .run(email, hashPassword(password), role, nom, prenom);

        recordAudit(
          db,
          req.user!.sub,
          req.user!.email,
          'CREATION_UTILISATEUR',
          'USER',
          `Création compte ${role} : ${email}`,
          req.ip
        );
        res.status(201).json(
          db
            .prepare('SELECT id, email, role, nom, prenom, active, created_at FROM users WHERE id = ?')
            .get(info.lastInsertRowid)
        );
      } catch {
        res.status(409).json({ error: 'Cet email est déjà enregistré.' });
      }
    }
  );

  app.patch(
    '/api/admin/users/:id',
    requireAuth,
    requireRoles('SUPER_ADMIN'),
    (req: AuthenticatedRequest, res: Response) => {
      const id = Number(req.params.id);
      if (id === req.user!.sub && req.body?.active === false) {
        res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' });
        return;
      }
      const active = req.body?.active ? 1 : 0;
      const role = req.body?.role;
      if (role && ['SUPER_ADMIN', 'ADMIN_SCOLARITE', 'ENSEIGNANT', 'ETUDIANT'].includes(role)) {
        db.prepare('UPDATE users SET active = ?, role = ? WHERE id = ?').run(active, role, id);
      } else {
        db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active, id);
      }
      if (!active) {
        db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(id);
      }
      recordAudit(
        db,
        req.user!.sub,
        req.user!.email,
        'MODIFICATION_UTILISATEUR',
        'USER',
        `Utilisateur #${id} active=${active}`,
        req.ip
      );
      res.json({ id, active: Boolean(active) });
    }
  );

  app.get('/api/admin/sessions', ...strictAdminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT s.id, s.user_id, s.user_agent, s.ip_address, s.revoked, s.expires_at, s.created_at,
                u.email, u.role, u.nom || ' ' || u.prenom as utilisateur
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         ORDER BY s.id DESC LIMIT 40`
      )
      .all();
    res.json(rows);
  });

  app.post('/api/admin/sessions/:id/revoke', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(id);
    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'REVOCATION_SESSION',
      'SESSION',
      `Session #${id} révoquée par l’administrateur`,
      req.ip
    );
    res.json({ revoked: true });
  });

  app.get('/api/admin/audit-logs', ...strictAdminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 80').all();
    res.json(rows);
  });

  app.get('/api/admin/ha-status', ...adminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'scolarite.db');
    let dbSizeBytes = 0;
    try {
      dbSizeBytes = fs.statSync(dbPath).size;
    } catch {
      dbSizeBytes = 0;
    }

    res.json({
      instance: {
        server: process.env.INSTANCE_NAME || os.hostname(),
        pid: process.pid,
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        statelessMode: true,
      },
      database: {
        engine: 'SQLite WAL (local) + Schéma PostgreSQL 16 HA prêt',
        fileSizeKb: Math.round(dbSizeBytes / 1024),
        circuitBreaker: dbCircuitBreaker.status(),
      },
      cache: cache.stats(),
      logs: logger.recent(25),
      artifacts: INFRA_ARTIFACTS,
    });
  });

  app.post('/api/admin/ha-cache/clear', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    cache.clear();
    recordAudit(db, req.user!.sub, req.user!.email, 'PURGE_CACHE', 'CACHE', 'Cache mémoire purgé manuellement', req.ip);
    res.json({ cleared: true, stats: cache.stats() });
  });

  app.get('/api/admin/backup', ...strictAdminAccess, (req: AuthenticatedRequest, res: Response) => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      filieres: db.prepare('SELECT * FROM filieres').all(),
      niveaux: db.prepare('SELECT * FROM niveaux').all(),
      classes: db.prepare('SELECT * FROM classes').all(),
      eleves: db.prepare('SELECT id, matricule, nom, prenom, email, classe_id, statut FROM eleves').all(),
      ues: db.prepare('SELECT * FROM ues').all(),
      matieres: db.prepare('SELECT * FROM matieres').all(),
      notes: db.prepare('SELECT * FROM notes').all(),
      inscriptions: db.prepare('SELECT * FROM inscriptions').all(),
      paiements: db.prepare('SELECT * FROM paiements').all(),
    };
    recordAudit(db, req.user!.sub, req.user!.email, 'SAUVEGARDE_LOGIQUE', 'DATABASE', 'Export JSON complet', req.ip);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="backup-scolarite-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(snapshot, null, 2));
  });

  // ============================================================================
  // 4. STUDENT SPACE (/api/student/*) - STRICT PERSONAL DATA ISOLATION
  // ============================================================================
  const studentAccess = [requireAuth, requireRoles('ETUDIANT')];

  function resolveEleve(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.eleveId) {
      res.status(403).json({ error: 'Aucun dossier étudiant associé à ce compte.' });
      return null;
    }
    const student = db
      .prepare(
        `SELECT e.*, c.nom as classeNom, c.salle_principale as sallePrincipale, c.annee_academique as anneeAcademique,
                f.id as filiereId, f.nom as filiereNom, f.code as filiereCode, COALESCE(f.frais_annuels, 0) as fraisAnnuels,
                niv.id as niveauId, niv.nom as niveauNom, niv.code as niveauCode
         FROM eleves e
         LEFT JOIN classes c ON e.classe_id = c.id
         LEFT JOIN filieres f ON c.filiere_id = f.id
         LEFT JOIN niveaux niv ON c.niveau_id = niv.id
         WHERE e.id = ?`
      )
      .get(req.user.eleveId) as
      | {
          id: number;
          matricule: string;
          nom: string;
          prenom: string;
          email: string;
          telephone: string | null;
          date_naissance: string | null;
          adresse: string | null;
          contact_urgence: string | null;
          classe_id: number | null;
          classeNom: string | null;
          filiereId: number | null;
          filiereNom: string | null;
          filiereCode: string | null;
          fraisAnnuels: number;
          niveauNom: string | null;
          niveauCode: string | null;
          statut: string;
        }
      | undefined;

    if (!student) {
      res.status(404).json({ error: 'Dossier étudiant introuvable.' });
      return null;
    }
    return student;
  }

  function getStudentNotifications(eleve: { id: number; classe_id: number | null; filiereId: number | null }, userId: number) {
    return db
      .prepare(
        `SELECT n.*,
                CASE WHEN nl.lu_at IS NOT NULL THEN 1 ELSE 0 END as lu
         FROM notifications n
         LEFT JOIN notifications_lues nl ON nl.notification_id = n.id AND nl.user_id = ?
         WHERE n.cible_type = 'TOUS'
            OR (n.cible_type = 'FILIERE' AND n.cible_id = ?)
            OR (n.cible_type = 'CLASSE' AND n.cible_id = ?)
            OR (n.cible_type = 'ELEVE' AND n.cible_id = ?)
         ORDER BY n.id DESC`
      )
      .all(userId, eleve.filiereId ?? -1, eleve.classe_id ?? -1, eleve.id);
  }

  app.get('/api/student/dashboard', ...studentAccess, (req: AuthenticatedRequest, res: Response) => {
    const student = resolveEleve(req, res);
    if (!student) return;

    const transcript = getStudentFullTranscript(db, student.id, true);
    const totalPaye = (
      db.prepare('SELECT COALESCE(SUM(montant), 0) as s FROM paiements WHERE eleve_id = ?').get(student.id) as {
        s: number;
      }
    ).s;

    const timetable = student.classe_id
      ? db
          .prepare(
            `SELECT t.*, m.nom as matiereNom, m.code as matiereCode,
                    ens.nom || ' ' || ens.prenom as enseignantNom
             FROM emplois_du_temps t
             JOIN matieres m ON t.matiere_id = m.id
             LEFT JOIN enseignants ens ON t.enseignant_id = ens.id
             WHERE t.classe_id = ?
             ORDER BY CASE t.jour_semaine
               WHEN 'Lundi' THEN 1 WHEN 'Mardi' THEN 2 WHEN 'Mercredi' THEN 3
               WHEN 'Jeudi' THEN 4 WHEN 'Vendredi' THEN 5 ELSE 6 END, t.heure_debut`
          )
          .all(student.classe_id)
      : [];

    const notifications = getStudentNotifications(student, req.user!.sub);

    res.json({
      student,
      academicSummary: {
        annualAverage: transcript.annualAverage,
        s1Average: transcript.s1.moyenne,
        s2Average: transcript.s2.moyenne,
        creditsObtenus: transcript.totalCreditsObtenus,
        creditsTotaux: transcript.totalCredits,
      },
      tuitionSummary: {
        fraisAnnuels: student.fraisAnnuels,
        totalPaye,
        soldeRestant: Math.max(0, student.fraisAnnuels - totalPaye),
      },
      upcomingClasses: timetable.slice(0, 4),
      recentNotifications: notifications.slice(0, 4),
      unreadCount: (notifications as { lu: number }[]).filter((n) => !n.lu).length,
    });
  });

  app.get('/api/student/profile', ...studentAccess, (req: AuthenticatedRequest, res: Response) => {
    const student = resolveEleve(req, res);
    if (!student) return;
    res.json(student);
  });

  app.put('/api/student/profile', ...studentAccess, (req: AuthenticatedRequest, res: Response) => {
    const student = resolveEleve(req, res);
    if (!student) return;

    const telephone = sanitizeText(req.body?.telephone, 40);
    const adresse = sanitizeText(req.body?.adresse, 200);
    const contactUrgence = sanitizeText(req.body?.contact_urgence, 150);

    db.prepare('UPDATE eleves SET telephone = ?, adresse = ?, contact_urgence = ? WHERE id = ?').run(
      telephone,
      adresse,
      contactUrgence,
      student.id
    );

    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'MISE_A_JOUR_PROFIL',
      'ELEVE',
      `Mise à jour coordonnées par l’étudiant ${student.matricule}`,
      req.ip
    );
    res.json(resolveEleve(req, res));
  });

  app.get('/api/student/results', ...studentAccess, (req: AuthenticatedRequest, res: Response) => {
    const student = resolveEleve(req, res);
    if (!student) return;
    const transcript = getStudentFullTranscript(db, student.id, true);
    res.json({ student, transcript });
  });

  app.get('/api/student/timetable', ...studentAccess, (req: AuthenticatedRequest, res: Response) => {
    const student = resolveEleve(req, res);
    if (!student) return;
    const slots = student.classe_id
      ? db
          .prepare(
            `SELECT t.*, m.nom as matiereNom, m.code as matiereCode,
                    ens.nom || ' ' || ens.prenom as enseignantNom
             FROM emplois_du_temps t
             JOIN matieres m ON t.matiere_id = m.id
             LEFT JOIN enseignants ens ON t.enseignant_id = ens.id
             WHERE t.classe_id = ?
             ORDER BY CASE t.jour_semaine
               WHEN 'Lundi' THEN 1 WHEN 'Mardi' THEN 2 WHEN 'Mercredi' THEN 3
               WHEN 'Jeudi' THEN 4 WHEN 'Vendredi' THEN 5 ELSE 6 END, t.heure_debut`
          )
          .all(student.classe_id)
      : [];
    res.json({ classeNom: student.classeNom, slots });
  });

  app.get('/api/student/documents', ...studentAccess, (req: AuthenticatedRequest, res: Response) => {
    const student = resolveEleve(req, res);
    if (!student) return;
    const documents = db
      .prepare('SELECT * FROM documents WHERE eleve_id = ? ORDER BY date_generation DESC')
      .all(student.id);
    res.json({ student, documents });
  });

  app.post('/api/student/documents/request', ...studentAccess, (req: AuthenticatedRequest, res: Response) => {
    const student = resolveEleve(req, res);
    if (!student) return;
    const typeDoc = ['ATTESTATION_SCOLARITE', 'CERTIFICAT_INSCRIPTION'].includes(req.body?.type_document)
      ? req.body.type_document
      : 'ATTESTATION_SCOLARITE';

    const titre =
      typeDoc === 'ATTESTATION_SCOLARITE'
        ? 'Attestation de Scolarité 2025-2026'
        : 'Certificat d’Inscription 2025-2026';
    const ref = `DOC-2026-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const info = db
      .prepare('INSERT INTO documents (eleve_id, type_document, titre, reference, statut) VALUES (?, ?, ?, ?, ?)')
      .run(student.id, typeDoc, titre, ref, 'DISPONIBLE');

    res.status(201).json(db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid));
  });

  app.get('/api/student/tuition', ...studentAccess, (req: AuthenticatedRequest, res: Response) => {
    const student = resolveEleve(req, res);
    if (!student) return;
    const payments = db
      .prepare('SELECT * FROM paiements WHERE eleve_id = ? ORDER BY date_paiement DESC, id DESC')
      .all(student.id) as { montant: number }[];
    const totalPaye = payments.reduce((acc, p) => acc + Number(p.montant), 0);

    res.json({
      student,
      fraisAnnuels: student.fraisAnnuels,
      totalPaye,
      soldeRestant: Math.max(0, student.fraisAnnuels - totalPaye),
      payments,
    });
  });

  app.get('/api/student/notifications', ...studentAccess, (req: AuthenticatedRequest, res: Response) => {
    const student = resolveEleve(req, res);
    if (!student) return;
    res.json(getStudentNotifications(student, req.user!.sub));
  });

  app.post('/api/student/notifications/:id/read', ...studentAccess, (req: AuthenticatedRequest, res: Response) => {
    const notifId = Number(req.params.id);
    db.prepare('INSERT OR IGNORE INTO notifications_lues (notification_id, user_id) VALUES (?, ?)').run(
      notifId,
      req.user!.sub
    );
    res.json({ read: true });
  });

  // ============================================================================
  // 5. PAYMENT GATEWAY API (/api/payments/*, Student & Admin Tuition Checkout)
  // ============================================================================
  function settlePaymentTransaction(
    txId: string,
    outcome: 'REUSSI' | 'ECHOUE' | 'ANNULE',
    actorUserId: number | null,
    actorEmail: string | null,
    ip?: string
  ) {
    const tx = db
      .prepare('SELECT * FROM payment_transactions WHERE transaction_id = ?')
      .get(txId) as
      | {
          id: number;
          transaction_id: string;
          eleve_id: number;
          montant: number;
          devise: string;
          canal: PaymentChannel;
          provider: string;
          provider_ref: string | null;
          libelle: string;
          statut: 'EN_ATTENTE' | 'REUSSI' | 'ECHOUE' | 'ANNULE';
        }
      | undefined;

    if (!tx) {
      return { status: 404 as const, error: 'Transaction introuvable.' };
    }

    if (tx.statut === 'REUSSI') {
      const existingPay = db
        .prepare('SELECT * FROM paiements WHERE eleve_id = ? AND libelle LIKE ? ORDER BY id DESC LIMIT 1')
        .get(tx.eleve_id, `%${tx.transaction_id}%`);
      return { status: 200 as const, transaction: tx, payment: existingPay || null, idempotent: true };
    }

    if (outcome !== 'REUSSI') {
      db.prepare('UPDATE payment_transactions SET statut = ? WHERE id = ?').run(outcome, tx.id);
      recordAudit(
        db,
        actorUserId,
        actorEmail,
        'TRANSACTION_PAIEMENT_ECHEC',
        'PAIEMENT',
        `Transaction ${tx.transaction_id} (${tx.canal}) marquée ${outcome}`,
        ip
      );
      const updated = db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(tx.id);
      return { status: 200 as const, transaction: updated, payment: null };
    }

    db.exec('BEGIN');
    try {
      db.prepare("UPDATE payment_transactions SET statut = 'REUSSI', paid_at = datetime('now') WHERE id = ?").run(tx.id);

      const ref = `PAY-2026-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const mode = mapChannelToPaymentMode(tx.canal);
      const enrichedLibelle = `${tx.libelle} [${formatChannelLabel(tx.canal)} · ${tx.transaction_id}]`;

      const payInfo = db
        .prepare(
          'INSERT INTO paiements (eleve_id, reference, montant, mode_paiement, libelle, enregistre_par) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(tx.eleve_id, ref, tx.montant, mode, enrichedLibelle, actorUserId);

      const docRef = `QUI-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      db.prepare(
        'INSERT INTO documents (eleve_id, type_document, titre, reference, statut) VALUES (?, ?, ?, ?, ?)'
      ).run(
        tx.eleve_id,
        'QUITTANCE_PAIEMENT',
        `Quittance ${ref} — ${Math.round(tx.montant).toLocaleString('fr-FR')} FCFA (${formatChannelLabel(tx.canal)})`,
        docRef,
        'DISPONIBLE'
      );

      db.prepare(
        'INSERT INTO notifications (titre, message, type, cible_type, cible_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        'Paiement en ligne confirmé',
        `Votre règlement de ${Math.round(tx.montant).toLocaleString('fr-FR')} FCFA via ${formatChannelLabel(tx.canal)} (${tx.transaction_id}) a été validé. Votre quittance ${docRef} est disponible.`,
        'SCOLARITE',
        'ELEVE',
        tx.eleve_id,
        actorUserId
      );

      db.exec('COMMIT');
      cache.invalidatePrefix('admin:');
      recordAudit(
        db,
        actorUserId,
        actorEmail,
        'PAIEMENT_API_VALIDE',
        'PAIEMENT',
        `Transaction ${tx.transaction_id} (${tx.canal}) -> Quittance ${ref} (${tx.montant} FCFA)`,
        ip
      );

      const updatedTx = db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(tx.id);
      const payment = db.prepare('SELECT * FROM paiements WHERE id = ?').get(payInfo.lastInsertRowid);
      return { status: 200 as const, transaction: updatedTx, payment };
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback
      }
      return {
        status: 500 as const,
        error: err instanceof Error ? err.message : 'Erreur lors de la validation du paiement.',
      };
    }
  }

  app.post('/api/payments/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const isStudent = req.user!.role === 'ETUDIANT';
    const isAdmin = req.user!.role === 'SUPER_ADMIN' || req.user!.role === 'ADMIN_SCOLARITE';

    if (!isStudent && !isAdmin) {
      res.status(403).json({ error: 'Rôle non autorisé pour initier un paiement.' });
      return;
    }

    const targetEleveId = isStudent ? req.user!.eleveId : Number(req.body?.eleve_id);
    if (!targetEleveId) {
      res.status(400).json({ error: 'Identifiant étudiant requis.' });
      return;
    }

    const student = db
      .prepare('SELECT id, nom, prenom, email, telephone, matricule FROM eleves WHERE id = ?')
      .get(targetEleveId) as
      | { id: number; nom: string; prenom: string; email: string; telephone: string | null; matricule: string }
      | undefined;

    if (!student) {
      res.status(404).json({ error: 'Dossier étudiant introuvable.' });
      return;
    }

    const montant = Number(req.body?.montant);
    const canalRaw = sanitizeText(req.body?.canal, 30).toUpperCase();
    const validCanals: PaymentChannel[] = ['WAVE', 'ORANGE_MONEY', 'MTN_MOMO', 'CARTE_BANCAIRE'];
    const canal: PaymentChannel = validCanals.includes(canalRaw as PaymentChannel)
      ? (canalRaw as PaymentChannel)
      : 'WAVE';
    const telephone = sanitizeText(req.body?.telephone || student.telephone || '', 40);
    const libelle = sanitizeText(req.body?.libelle, 180) || 'Règlement frais de scolarité 2025-2026';

    if (Number.isNaN(montant) || montant < 500) {
      res.status(400).json({ error: 'Le montant minimum pour un paiement en ligne est de 500 FCFA.' });
      return;
    }

    const transactionId = `TX-2026-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const appOrigin = process.env.APP_URL || `${req.protocol}://${req.get('host') || 'localhost:3000'}`;

    const gateway = await initiateGatewayCheckout(
      {
        transactionId,
        montant,
        devise: 'XOF',
        canal,
        libelle,
        studentName: `${student.prenom} ${student.nom}`,
        studentEmail: student.email,
        telephone,
        returnUrl: `${appOrigin}/#/espace-etudiant`,
        notifyUrl: `${appOrigin}/api/payments/webhook`,
      },
      student.id
    );

    const info = db
      .prepare(
        `INSERT INTO payment_transactions
          (transaction_id, eleve_id, montant, devise, canal, provider, provider_ref, telephone_payeur, libelle, statut, webhook_signature, created_by)
         VALUES (?, ?, ?, 'XOF', ?, ?, ?, ?, ?, 'EN_ATTENTE', ?, ?)`
      )
      .run(
        transactionId,
        student.id,
        montant,
        canal,
        gateway.provider,
        gateway.providerRef,
        telephone,
        libelle,
        gateway.signature,
        req.user!.sub
      );

    recordAudit(
      db,
      req.user!.sub,
      req.user!.email,
      'INITIATION_PAIEMENT_API',
      'PAIEMENT',
      `Session ${transactionId} (${canal}, ${montant} FCFA) initiée pour ${student.matricule}`,
      req.ip
    );

    cache.invalidatePrefix('admin:');
    const tx = db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({
      transaction: tx,
      checkoutSession: {
        provider: gateway.provider,
        providerRef: gateway.providerRef,
        checkoutUrl: gateway.checkoutUrl,
        instructions: gateway.instructions,
        signature: gateway.signature,
      },
    });
  });

  app.post('/api/payments/confirm', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const transactionId = sanitizeText(req.body?.transaction_id, 60);
    const signature = sanitizeText(req.body?.signature, 160);
    const outcome = req.body?.outcome === 'ECHOUE' ? 'ECHOUE' : req.body?.outcome === 'ANNULE' ? 'ANNULE' : 'REUSSI';

    if (!transactionId) {
      res.status(400).json({ error: 'Identifiant de transaction requis.' });
      return;
    }

    const tx = db
      .prepare('SELECT eleve_id, montant, canal, webhook_signature FROM payment_transactions WHERE transaction_id = ?')
      .get(transactionId) as
      | { eleve_id: number; montant: number; canal: string; webhook_signature: string | null }
      | undefined;

    if (!tx) {
      res.status(404).json({ error: 'Transaction introuvable.' });
      return;
    }

    const isStudent = req.user!.role === 'ETUDIANT';
    const isAdmin = req.user!.role === 'SUPER_ADMIN' || req.user!.role === 'ADMIN_SCOLARITE';
    if (!isAdmin && (!isStudent || req.user!.eleveId !== tx.eleve_id)) {
      res.status(403).json({ error: 'Accès interdit à cette transaction.' });
      return;
    }

    if (signature && !verifyPaymentSignature(transactionId, tx.eleve_id, tx.montant, tx.canal, signature)) {
      res.status(403).json({ error: 'Signature HMAC de transaction invalide.' });
      return;
    }

    const settled = settlePaymentTransaction(transactionId, outcome, req.user!.sub, req.user!.email, req.ip);
    if ('error' in settled) {
      res.status(settled.status).json({ error: settled.error });
      return;
    }
    res.status(settled.status).json(settled);
  });

  app.post('/api/payments/webhook', (req: Request, res: Response) => {
    const transactionId = sanitizeText(req.body?.transaction_id || req.body?.cpm_trans_id, 60);
    const signature = sanitizeText(
      (req.headers['x-payment-signature'] as string) || req.body?.signature || '',
      160
    );
    const statusRaw = String(req.body?.status || 'REUSSI').toUpperCase();
    const outcome: 'REUSSI' | 'ECHOUE' = ['SUCCEEDED', 'ACCEPTED', 'REUSSI', 'PAID'].includes(statusRaw)
      ? 'REUSSI'
      : 'ECHOUE';

    if (!transactionId || !signature) {
      res.status(400).json({ error: 'transaction_id et signature HMAC requis.' });
      return;
    }

    const tx = db
      .prepare('SELECT eleve_id, montant, canal FROM payment_transactions WHERE transaction_id = ?')
      .get(transactionId) as { eleve_id: number; montant: number; canal: string } | undefined;

    if (!tx) {
      res.status(404).json({ error: 'Transaction inconnue.' });
      return;
    }

    if (!verifyPaymentSignature(transactionId, tx.eleve_id, tx.montant, tx.canal, signature)) {
      res.status(401).json({ error: 'Signature webhook HMAC invalide.' });
      return;
    }

    const settled = settlePaymentTransaction(transactionId, outcome, null, 'webhook@gateway.academie-ha.edu', req.ip);
    if ('error' in settled) {
      res.status(settled.status).json({ error: settled.error });
      return;
    }
    res.json({ received: true, ...settled });
  });

  app.get('/api/student/payments/transactions', ...studentAccess, (req: AuthenticatedRequest, res: Response) => {
    const student = resolveEleve(req, res);
    if (!student) return;
    const rows = db
      .prepare('SELECT * FROM payment_transactions WHERE eleve_id = ? ORDER BY id DESC')
      .all(student.id);
    res.json(rows);
  });

  app.get('/api/admin/payments/transactions', ...strictAdminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT pt.*, e.matricule, e.nom || ' ' || e.prenom as eleveNom
         FROM payment_transactions pt
         JOIN eleves e ON pt.eleve_id = e.id
         ORDER BY pt.id DESC`
      )
      .all();
    res.json(rows);
  });

  // ============================================================================
  // 6. COMPATIBILITY ENDPOINTS FROM PROJET 6 PDF (Admin Protected)
  // ============================================================================
  app.get('/api/eleves', ...adminAccess, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT id, matricule, nom, prenom, classe_id FROM eleves ORDER BY id').all();
    res.json(rows);
  });
}
