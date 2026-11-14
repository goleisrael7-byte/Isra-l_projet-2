# AcademiaHA — Plateforme Intelligente de Gestion Scolaire (Haute Disponibilité)

Application web full-stack centralisant la gestion administrative, pédagogique et académique d'un établissement d'enseignement supérieur, conçue pour une architecture **stateless haute disponibilité** (HAProxy, Keepalived VIP, PostgreSQL répliqué / Patroni).

## Espaces fonctionnels

1. **Espace Administration** (`SUPER_ADMIN`, `ADMIN_SCOLARITE`, `ENSEIGNANT`)
   - **Tableau de bord** : effectifs, enseignants, classes, filières, taux de réussite, graphiques par filière et niveau, journal d'audit.
   - **Gestion des étudiants** : création avec matricule unique (`MAT-YYYY-NNN`), modification, activation/désactivation, dossier académique complet, import/export CSV, recherche multicritères.
   - **Gestion pédagogique** : filières, niveaux, classes, Unités d'Enseignement (UE), matières & coefficients, affectation des enseignants, emplois du temps avec notifications automatiques.
   - **Notes & Résultats** : saisie/modification sécurisée, calcul automatique des moyennes pondérées, publication officielle par classe/semestre, génération de relevés PDF.
   - **Scolarité & Finance** : inscriptions/réinscriptions, paiements, calcul automatique des soldes, quittances, génération d'attestations et certificats PDF.
   - **Communication** : annonces générales ou ciblées (filière, classe, étudiant).
   - **Sécurité & Haute Disponibilité** : gestion des utilisateurs/RBAC, révocation des sessions Refresh Token en direct, audit logs, monitoring `/health` & `/whoami`, cache TTL, sauvegarde logique et fichiers d'infrastructure HA (Projet 6).

2. **Espace Étudiant** (`ETUDIANT` — isolation stricte des données personnelles)
   - **Tableau de bord personnel** : matricule, filière, moyenne, crédits ECTS, solde, prochains cours, notifications.
   - **Mon profil** : coordonnées modifiables et changement de mot de passe sécurisé.
   - **Mes résultats** : notes publiées uniquement, moyennes par matière/semestre/annuelle, téléchargement de relevé officiel en PDF.
   - **Mon emploi du temps** : vue semaine et vue par jour.
   - **Mes documents** : attestations de scolarité et certificats d'inscription téléchargeables en PDF.
   - **Ma scolarité** : frais annuels, historique des paiements, solde restant et reçus PDF.
   - **Notifications** : annonces, publications de résultats, modifications d'emploi du temps.

## Comptes de démonstration

| Rôle | Email | Mot de passe |
| :--- | :--- | :--- |
| Super Administrateur | `admin@academie-ha.edu` | `AdminHA2026!` |
| Scolarité | `scolarite@academie-ha.edu` | `Scolarite2026!` |
| Étudiant (L3 GL) | `amina.diallo@etudiant.academie-ha.edu` | `Etudiant2026!` |
| Étudiant (M1 CYB) | `lucas.morel@etudiant.academie-ha.edu` | `Etudiant2026!` |

## Commandes

- `npm run dev` : démarre le serveur Express + Vite sur le port `3000`
- `npm test` : exécute les tests unitaires et d'intégration (`node:test`)
- `npm run lint` : vérification TypeScript (`tsc --noEmit`)
- `npm run build` : compilation production Vite
