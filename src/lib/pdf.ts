import { jsPDF } from 'jspdf';
import type { DocumentRecord, PaymentRecord, StudentRecord, TranscriptData } from '../types';

function drawOfficialHeader(doc: jsPDF, title: string, reference: string) {
  doc.setFillColor(15, 41, 74); // #0F294A Navy
  doc.rect(0, 0, 210, 34, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ACADEMIA HA — INSTITUT SUPÉRIEUR', 16, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Direction des Études et de la Scolarité · Année Académique 2025-2026', 16, 22);
  doc.text(`Réf. : ${reference}`, 152, 22);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 16, 46);
  doc.setDrawColor(203, 213, 225);
  doc.line(16, 50, 194, 50);
}

export function downloadTranscriptPdf(student: StudentRecord, transcript: TranscriptData) {
  const doc = new jsPDF();
  drawOfficialHeader(doc, 'RELEVÉ DE NOTES ET RÉSULTATS OFFICIEL', `REL-${student.matricule}`);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Étudiant(e) :', 16, 60);
  doc.setFont('helvetica', 'normal');
  doc.text(`${student.prenom} ${student.nom}`, 46, 60);

  doc.setFont('helvetica', 'bold');
  doc.text('Matricule :', 130, 60);
  doc.setFont('helvetica', 'normal');
  doc.text(student.matricule, 155, 60);

  doc.setFont('helvetica', 'bold');
  doc.text('Filière :', 16, 67);
  doc.setFont('helvetica', 'normal');
  doc.text(student.filiereNom || 'Non assignée', 46, 67);

  doc.setFont('helvetica', 'bold');
  doc.text('Classe :', 130, 67);
  doc.setFont('helvetica', 'normal');
  doc.text(student.classeNom || 'Non assignée', 155, 67);

  let y = 78;
  const semesters = [transcript.s1, transcript.s2].filter((s) => s.matieres.length > 0);

  for (const sem of semesters) {
    doc.setFillColor(241, 245, 249);
    doc.rect(16, y, 178, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(
      `Semestre ${sem.semestre} — Moyenne : ${sem.moyenne !== null ? `${sem.moyenne}/20` : 'N/A'} (${sem.mention}) · ECTS : ${sem.creditsObtenus}/${sem.creditsTotaux}`,
      19,
      y + 5.5
    );
    y += 12;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Code', 18, y);
    doc.text('Matière', 40, y);
    doc.text('Coeff.', 128, y);
    doc.text('Moyenne', 148, y);
    doc.text('Décision', 172, y);
    y += 3;
    doc.line(16, y, 194, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    for (const m of sem.matieres) {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.text(m.matiereCode, 18, y);
      doc.text(m.matiereNom.slice(0, 42), 40, y);
      doc.text(String(m.coefficient), 132, y);
      doc.text(m.moyenne !== null ? `${m.moyenne.toFixed(2)}/20` : '-', 148, y);
      doc.text(m.valide ? 'Validé' : 'Ajourné', 172, y);
      y += 6.5;
    }
    y += 6;
  }

  doc.setDrawColor(15, 41, 74);
  doc.rect(16, y, 178, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(
    `Bilan Annuel : ${transcript.annualAverage !== null ? `${transcript.annualAverage}/20` : 'En cours'}   |   Crédits ECTS validés : ${transcript.totalCreditsObtenus} / ${transcript.totalCredits}`,
    22,
    y + 10
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Document généré numériquement le ${new Date().toLocaleDateString('fr-FR')} via AcademiaHA.`,
    16,
    284
  );

  doc.save(`releve-notes-${student.matricule}.pdf`);
}

export function downloadOfficialDocumentPdf(student: StudentRecord, document: DocumentRecord) {
  const doc = new jsPDF();
  drawOfficialHeader(doc, document.titre.toUpperCase(), document.reference);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);

  const lines = [
    'La Direction de la Scolarité de l’Institut Supérieur AcademiaHA certifie par la présente que :',
    '',
    `Nom et Prénom : ${student.prenom} ${student.nom}`,
    `Numéro Matricule : ${student.matricule}`,
    `Date de naissance : ${student.date_naissance || 'Non renseignée'}`,
    `Filière d’études : ${student.filiereNom || 'N/A'}`,
    `Niveau / Classe : ${student.niveauNom || ''} (${student.classeNom || 'N/A'})`,
    `Statut administratif : ${student.statut}`,
    '',
    'Est régulièrement inscrit(e) au titre de l’année académique 2025-2026 et suit assidûment',
    'les enseignements et travaux pratiques prévus au programme officiel.',
    '',
    'La présente pièce est délivrée à l’intéressé(e) pour servir et valoir ce que de droit.',
  ];

  let y = 66;
  for (const line of lines) {
    doc.text(line, 16, y);
    y += 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.text(`Fait à Lyon, le ${new Date().toLocaleDateString('fr-FR')}`, 128, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text('Le Directeur des Études', 138, y + 24);

  doc.save(`${document.reference}.pdf`);
}

export function downloadPaymentReceiptPdf(student: StudentRecord, payment: PaymentRecord) {
  const doc = new jsPDF();
  drawOfficialHeader(doc, 'QUITTANCE OFFICIELLE DE PAIEMENT', payment.reference);

  doc.setFontSize(10.5);
  const rows = [
    ['Étudiant(e)', `${student.prenom} ${student.nom} (${student.matricule})`],
    ['Classe / Filière', `${student.classeNom || 'N/A'} — ${student.filiereNom || 'N/A'}`],
    ['Référence paiement', payment.reference],
    ['Date de règlement', new Date(payment.date_paiement).toLocaleDateString('fr-FR')],
    ['Libellé', payment.libelle],
    ['Mode de règlement', payment.mode_paiement],
    ['Montant réglé', `${Number(payment.montant).toLocaleString('fr-FR')} FCFA`],
  ];

  let y = 65;
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label} :`, 18, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), 72, y);
    doc.setDrawColor(226, 232, 240);
    doc.line(18, y + 3, 192, y + 3);
    y += 12;
  }

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Quittance générée électroniquement — Service Financier AcademiaHA.', 18, 280);
  doc.save(`recu-${payment.reference}.pdf`);
}
