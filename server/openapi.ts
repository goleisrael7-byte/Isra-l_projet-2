export function buildOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'AcademiaHA — API Gestion Scolaire Haute Disponibilité',
      version: '1.0.0',
      description:
        'API REST centralisée et stateless pour les espaces Administration et Étudiant, avec authentification JWT + Refresh Tokens, RBAC, cache résilient et endpoints HA (/health, /whoami).',
    },
    servers: [{ url: '/', description: 'Instance applicative courante' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Health check HAProxy (vérification DB)',
          tags: ['Haute Disponibilité'],
          responses: {
            '200': { description: 'Instance saine et base de données connectée' },
            '503': { description: 'Base de données indisponible' },
          },
        },
      },
      '/whoami': {
        get: {
          summary: 'Identifiant du nœud applicatif (test Round-Robin)',
          tags: ['Haute Disponibilité'],
          responses: { '200': { description: 'Nom d’hôte et PID du serveur' } },
        },
      },
      '/api/auth/login': {
        post: {
          summary: 'Connexion utilisateur (JWT + Refresh Token)',
          tags: ['Authentification'],
          responses: {
            '200': { description: 'Tokens générés' },
            '401': { description: 'Identifiants invalides' },
          },
        },
      },
      '/api/auth/refresh': {
        post: {
          summary: 'Renouvellement du jeton JWT par rotation de refresh token',
          tags: ['Authentification'],
          responses: { '200': { description: 'Nouveau accessToken' } },
        },
      },
      '/api/auth/logout': {
        post: {
          summary: 'Déconnexion et révocation de la session',
          tags: ['Authentification'],
          responses: { '200': { description: 'Session révoquée' } },
        },
      },
      '/api/admin/dashboard': {
        get: {
          summary: 'Statistiques globales établissement (Administration)',
          tags: ['Administration'],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'KPIs et séries graphiques' } },
        },
      },
      '/api/admin/students': {
        get: {
          summary: 'Lister et filtrer les étudiants',
          tags: ['Étudiants'],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Liste des étudiants' } },
        },
        post: {
          summary: 'Créer un étudiant avec matricule unique',
          tags: ['Étudiants'],
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Étudiant créé' } },
        },
      },
      '/api/admin/grades': {
        get: {
          summary: 'Consulter les notes (Administration)',
          tags: ['Notes & Résultats'],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Liste des notes' } },
        },
        post: {
          summary: 'Saisir une note (0 à 20)',
          tags: ['Notes & Résultats'],
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Note enregistrée' } },
        },
      },
      '/api/admin/grades/publish': {
        post: {
          summary: 'Publier les résultats d’une classe et notifier les étudiants',
          tags: ['Notes & Résultats'],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Résultats publiés' } },
        },
      },
      '/api/admin/payments': {
        post: {
          summary: 'Enregistrer un paiement de scolarité et générer une quittance',
          tags: ['Scolarité & Finance'],
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Paiement enregistré' } },
        },
      },
      '/api/student/dashboard': {
        get: {
          summary: 'Tableau de bord personnel de l’étudiant connecté',
          tags: ['Espace Étudiant'],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Données personnelles isolées' } },
        },
      },
      '/api/student/results': {
        get: {
          summary: 'Consulter mes notes publiées et moyennes calculées',
          tags: ['Espace Étudiant'],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Relevé semestriel et annuel' } },
        },
      },
      '/api/student/timetable': {
        get: {
          summary: 'Consulter mon emploi du temps',
          tags: ['Espace Étudiant'],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Créneaux horaires de la classe' } },
        },
      },
      '/api/student/tuition': {
        get: {
          summary: 'Consulter mes frais de scolarité, paiements et solde',
          tags: ['Espace Étudiant'],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Situation financière' } },
        },
      },
      '/api/payments/checkout': {
        post: {
          summary: 'Initier une session de paiement scolarité (Wave, Orange Money, MTN MoMo, Carte)',
          tags: ['Passerelle Paiement'],
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Transaction créée avec signature HMAC' } },
        },
      },
      '/api/payments/confirm': {
        post: {
          summary: 'Confirmer une transaction de paiement et émettre la quittance PDF',
          tags: ['Passerelle Paiement'],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Paiement validé' } },
        },
      },
      '/api/payments/webhook': {
        post: {
          summary: 'Callback webhook signé HMAC-SHA256 pour notification fournisseur paiement',
          tags: ['Passerelle Paiement'],
          responses: { '200': { description: 'Webhook traité de façon idempotente' } },
        },
      },
      '/api/student/payments/transactions': {
        get: {
          summary: 'Historique des transactions passerelle de l’étudiant connecté',
          tags: ['Passerelle Paiement'],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Liste des transactions' } },
        },
      },
      '/api/admin/payments/transactions': {
        get: {
          summary: 'Supervision globale des transactions passerelle (Administration)',
          tags: ['Passerelle Paiement'],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Journal complet des transactions' } },
        },
      },
    },
  };
}
