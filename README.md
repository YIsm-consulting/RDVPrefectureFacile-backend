# RDVPrefectureFacile — Backend API

API Node.js + robot de scraping pour rdvprefecturefacile.fr

## Stack

- **Runtime** : Node.js 20+
- **Framework** : Express
- **Base de données** : Supabase (PostgreSQL)
- **Paiements** : Stripe
- **SMS** : Twilio
- **Email** : SendGrid
- **Scraping** : Playwright (Chromium headless)
- **Hébergement** : Railway

## Installation locale

```bash
npm install
npx playwright install chromium
cp .env.example .env
# Remplir le .env avec vos clés
node server.js
```

## Déploiement Railway

1. Créer un projet sur railway.app
2. Connecter ce dépôt GitHub
3. Ajouter les variables d'environnement (copier depuis .env.example)
4. Railway détecte automatiquement Node.js et lance `node server.js`

## Variables d'environnement requises

Voir `.env.example` pour la liste complète.

## Endpoints API

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /api/auth/register | Créer un compte |
| POST | /api/auth/login | Connexion |
| GET | /api/auth/me | Profil utilisateur |
| GET | /api/alerts | Lister mes alertes |
| POST | /api/alerts | Créer une alerte |
| DELETE | /api/alerts/:id | Supprimer une alerte |
| POST | /api/alerts/checkout | Créer session Stripe |
| POST | /api/alerts/portal | Portail abonnement Stripe |
| POST | /api/webhooks/stripe | Webhook Stripe |
| GET | /api/admin/stats | Stats admin |
| GET | /health | Health check |

## Base de données

Exécuter le SQL commenté dans `src/database.js` dans l'éditeur SQL de Supabase pour créer les tables.
