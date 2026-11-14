export interface GradeEntry {
  matiereId: number;
  matiereNom: string;
  matiereCode: string;
  ueNom: string;
  ueCode: string;
  credits: number;
  coefficient: number;
  semestre: string;
  typeEvaluation: string;
  valeur: number;
  publie: boolean;
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

export function getMention(moyenne: number | null): string {
  if (moyenne === null) return 'En attente';
  if (moyenne >= 16) return 'Très Bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez Bien';
  if (moyenne >= 10) return 'Passable';
  return 'Ajourné';
}

export function calculateSubjectAverages(grades: GradeEntry[]): SubjectAverage[] {
  const byKey = new Map<string, GradeEntry[]>();
  for (const g of grades) {
    const key = `${g.semestre}:${g.matiereId}`;
    const list = byKey.get(key) || [];
    list.push(g);
    byKey.set(key, list);
  }

  const result: SubjectAverage[] = [];
  for (const list of byKey.values()) {
    const first = list[0];
    // Weight Exam (60%) + CC/TP (40%) when both exist, else arithmetic average
    const exams = list.filter((x) => x.typeEvaluation === 'Examen');
    const continuous = list.filter((x) => x.typeEvaluation !== 'Examen');

    let moyenne: number | null = null;
    if (exams.length > 0 && continuous.length > 0) {
      const examAvg = exams.reduce((s, x) => s + Number(x.valeur), 0) / exams.length;
      const ccAvg = continuous.reduce((s, x) => s + Number(x.valeur), 0) / continuous.length;
      moyenne = Number((examAvg * 0.6 + ccAvg * 0.4).toFixed(2));
    } else if (list.length > 0) {
      const avg = list.reduce((s, x) => s + Number(x.valeur), 0) / list.length;
      moyenne = Number(avg.toFixed(2));
    }

    result.push({
      matiereId: first.matiereId,
      matiereNom: first.matiereNom,
      matiereCode: first.matiereCode,
      ueNom: first.ueNom,
      ueCode: first.ueCode,
      credits: first.credits,
      coefficient: first.coefficient,
      semestre: first.semestre,
      notes: list.map((x) => ({ typeEvaluation: x.typeEvaluation, valeur: Number(x.valeur) })),
      moyenne,
      valide: moyenne !== null && moyenne >= 10,
    });
  }

  return result;
}

export function calculateSemesterSummary(semestre: string, subjects: SubjectAverage[]): SemesterSummary {
  const filtered = subjects.filter((s) => s.semestre === semestre);
  let weightedSum = 0;
  let totalCoeff = 0;
  let creditsObtenus = 0;
  let creditsTotaux = 0;

  for (const subj of filtered) {
    creditsTotaux += subj.credits;
    if (subj.moyenne !== null) {
      weightedSum += subj.moyenne * subj.coefficient;
      totalCoeff += subj.coefficient;
      if (subj.moyenne >= 10) {
        creditsObtenus += subj.credits;
      }
    }
  }

  const moyenne = totalCoeff > 0 ? Number((weightedSum / totalCoeff).toFixed(2)) : null;

  return {
    semestre,
    moyenne,
    totalCoefficients: totalCoeff,
    creditsObtenus,
    creditsTotaux,
    mention: getMention(moyenne),
    matieres: filtered,
  };
}

export function calculateAnnualAverage(s1: SemesterSummary, s2: SemesterSummary): number | null {
  if (s1.moyenne !== null && s2.moyenne !== null) {
    return Number(((s1.moyenne + s2.moyenne) / 2).toFixed(2));
  }
  return s1.moyenne ?? s2.moyenne;
}

export function formatMatricule(year: number, sequence: number): string {
  return `MAT-${year}-${String(sequence).padStart(3, '0')}`;
}
