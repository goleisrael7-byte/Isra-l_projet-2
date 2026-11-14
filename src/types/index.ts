export type UserRole = 'SUPER_ADMIN' | 'ADMIN_SCOLARITE' | 'ENSEIGNANT' | 'ETUDIANT';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  nom: string;
  prenom: string;
  eleveId: number | null;
  enseignantId: number | null;
}

export interface SubjectAverage {
  matiereId: number;
  matiereNom: string;
  matiereCode: string;
  ueNom: string;
  ueCode: string;
  credits: number;
  coefficient: number;
  semestre: string;
  notes: { typeEvaluation: string; valeur: number }[];
  moyenne: number | null;
  valide: boolean;
}

export interface SemesterSummary {
  semestre: string;
  moyenne: number | null;
  totalCoefficients: number;
  creditsObtenus: number;
  creditsTotaux: number;
  mention: string;
  matieres: SubjectAverage[];
}

export interface TranscriptData {
  rawNotes: {
    id: number;
    matiereId: number;
    matiereNom: string;
    matiereCode: string;
    semestre: string;
    typeEvaluation: string;
    valeur: number;
    commentaire: string | null;
    publie: number;
    updatedAt: string;
  }[];
  s1: SemesterSummary;
  s2: SemesterSummary;
  annualAverage: number | null;
  totalCreditsObtenus: number;
  totalCredits: number;
}

export interface StudentRecord {
  id: number;
  user_id: number | null;
  matricule: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  date_naissance: string | null;
  adresse: string | null;
  contact_urgence: string | null;
  classe_id: number | null;
  statut: 'ACTIF' | 'INACTIF' | 'DIPLOME';
  classeNom?: string | null;
  filiereId?: number | null;
  filiereNom?: string | null;
  filiereCode?: string | null;
  niveauCode?: string | null;
  niveauNom?: string | null;
  moyenneGenerale?: number | null;
  totalPaye?: number;
  fraisAnnuels?: number;
  sallePrincipale?: string | null;
  anneeAcademique?: string | null;
}

export interface TimetableSlot {
  id: number;
  classe_id: number;
  matiere_id: number;
  enseignant_id: number | null;
  jour_semaine: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi';
  heure_debut: string;
  heure_fin: string;
  salle: string;
  type_cours: 'CM' | 'TD' | 'TP';
  classeNom?: string;
  matiereNom: string;
  matiereCode: string;
  enseignantNom: string | null;
}

export interface NotificationRecord {
  id: number;
  titre: string;
  message: string;
  type: 'ANNONCE' | 'RESULTATS' | 'EMPLOI_DU_TEMPS' | 'SCOLARITE';
  cible_type: 'TOUS' | 'FILIERE' | 'CLASSE' | 'ELEVE';
  cible_id: number | null;
  auteur?: string;
  created_at: string;
  lu?: number;
}

export interface PaymentRecord {
  id: number;
  eleve_id: number;
  reference: string;
  montant: number;
  mode_paiement: 'VIREMENT' | 'CARTE' | 'ESPECES' | 'MOBILE_MONEY';
  libelle: string;
  date_paiement: string;
  eleveNom?: string;
  matricule?: string;
}

export interface DocumentRecord {
  id: number;
  eleve_id: number;
  type_document: 'ATTESTATION_SCOLARITE' | 'CERTIFICAT_INSCRIPTION' | 'RELEVE_NOTES' | 'QUITTANCE_PAIEMENT';
  titre: string;
  reference: string;
  statut: string;
  date_generation: string;
  eleveNom?: string;
  matricule?: string;
}

export type PaymentChannel = 'WAVE' | 'ORANGE_MONEY' | 'MTN_MOMO' | 'CARTE_BANCAIRE';

export interface PaymentTransactionRecord {
  id: number;
  transaction_id: string;
  eleve_id: number;
  montant: number;
  devise: string;
  canal: PaymentChannel;
  provider: string;
  provider_ref: string | null;
  telephone_payeur: string | null;
  libelle: string;
  statut: 'EN_ATTENTE' | 'REUSSI' | 'ECHOUE' | 'ANNULE';
  webhook_signature: string | null;
  paid_at: string | null;
  created_at: string;
  eleveNom?: string;
  matricule?: string;
}
