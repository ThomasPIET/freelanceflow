# FreelanceFlow — Backend API

DOC POSTMAN : https://documenter.getpostman.com/view/24740089/2sBXitDo3R

API REST pour la gestion d'activité freelance : clients, prestations, factures et génération de PDF.

## Stack technique

- **Runtime** : Node.js >= 18
- **Framework** : Express
- **ORM** : Sequelize (PostgreSQL)
- **Auth** : JWT (bcrypt + jsonwebtoken)
- **PDF** : PDFKit
- **Upload** : Multer (stockage base64 en BDD)
- **Email** : Resend
- **Tests** : Jest + Supertest
- **Qualité** : ESLint, Prettier, Husky, lint-staged
- **CI/CD** : GitHub Actions (lint, tests, build Docker, déploiement)

## Installation

```bash
# Cloner le dépôt
git clone <url-du-repo>
cd back

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (DATABASE_URL, JWT_SECRET, etc.)
```

## Scripts disponibles

| Commande               | Description                         |
|------------------------|-------------------------------------|
| `npm start`            | Lancer le serveur en production     |
| `npm run dev`          | Lancer avec nodemon (hot reload)    |
| `npm test`             | Lancer les tests avec couverture    |
| `npm run test:watch`   | Tests en mode watch                 |
| `npm run lint`         | Vérifier le code avec ESLint        |
| `npm run lint:fix`     | Corriger automatiquement le linting |
| `npm run format`       | Formater le code avec Prettier      |
| `npm run format:check` | Vérifier le formatage               |

## Variables d'environnement

| Variable            | Description                            | Défaut        |
|---------------------|----------------------------------------|---------------|
| `PORT`              | Port du serveur                        | `3000`        |
| `NODE_ENV`          | Environnement (development/production) | `development` |
| `DATABASE_URL`      | URL de connexion PostgreSQL            | —             |
| `JWT_SECRET`        | Clé secrète pour les tokens JWT        | —             |
| `JWT_EXPIRES_IN`    | Durée de validité des tokens           | `24h`         |
| `RESEND_API_KEY`    | Clé API Resend (envoi d'emails)        | —             |
| `RESEND_FROM_EMAIL` | Adresse email d'expédition             | —             |

## Docker

```bash
# Build
docker build -t freelanceflow-back .

# Run
docker run -p 3000:3000 --env-file .env freelanceflow-back
```

## Structure du projet

```
├── src/
│   ├── __tests__/        # Tests unitaires et d'intégration
│   ├── config/           # Configuration (BDD, cache, upload)
│   ├── controllers/      # Logique des contrôleurs
│   ├── middlewares/      # Middlewares (auth JWT, etc.)
│   ├── models/           # Modèles Sequelize
│   ├── routes/           # Définition des routes
│   ├── services/         # Logique métier
│   └── app.js            # Configuration Express
├── migrations/           # Migrations Sequelize
├── tests/loads/          # Tests de charge k6
├── .github/workflows/    # Pipelines CI/CD
├── server.js             # Point d'entrée
├── Dockerfile            # Image Docker
└── package.json
```

## Export CSV

Les clients et les factures peuvent être exportés en CSV (délimiteur `;`, encodage UTF-8).

- `GET /api/clients/export` — une ligne par client, avec toutes les informations d'adresse
- `GET /api/invoices/export` — une ligne par ligne de facture, avec les informations de la facture répétées

Le fichier est retourné avec le header `Content-Disposition: attachment` pour déclencher le téléchargement.

## Envoi d'email

Une facture peut être envoyée par email au client via :

```
POST /api/invoices/:id/send
Authorization: Bearer <token>
```

L'envoi utilise le service **Resend** (configuré via `RESEND_API_KEY` et `RESEND_FROM_EMAIL`).

## CI/CD

Le pipeline GitHub Actions exécute sur chaque pull request :

1. **Lint & Format** — ESLint + Prettier
2. **Tests** — Jest avec couverture de code
3. **Docker Build** — Vérification du build de l'image

## Tests de charge (k6)

### Prérequis

- [k6](https://k6.io/docs/get-started/installation/) installé (`brew install k6` sur Mac)
- API démarrée localement (`node server.js`)
- Données de test présentes en base (voir ci-dessous)

### Initialiser les données de test

Ce script crée 10 utilisateurs de test avec clients, services et factures en base.
À exécuter une seule fois avant de lancer les tests :

```bash
node tests/loads/seed.js
```

Pour nettoyer les données de test :

```bash
node tests/loads/seed.js --clean
```

### Lancer les tests

```bash
# Smoke test — 2 VUs, 1 minute (vérification rapide)
k6 run --env PROFILE=smoke --env BASE_URL=http://localhost:3000 tests/loads/main.js

# Load test — montée à 30 VUs sur 8 minutes (charge normale)
k6 run --env PROFILE=load --env BASE_URL=http://localhost:3000 tests/loads/main.js

# Stress test — montée à 80 VUs (recherche du point de rupture)
k6 run --env PROFILE=stress --env BASE_URL=http://localhost:3000 tests/loads/main.js

# Tester un scénario isolément
k6 run --env BASE_URL=http://localhost:3000 tests/loads/scenarios/auth.js
k6 run --env BASE_URL=http://localhost:3000 tests/loads/scenarios/invoices.js
```

### Scénarios couverts

| Scénario | Routes testées |
|---|---|
| `auth` | `POST /api/auth/login`, `POST /api/auth/register` |
| `invoices` | `GET /api/invoices`, `GET /api/invoices/:id/pdf` |

### Thresholds (seuils d'acceptation)

| Métrique | Seuil |
|---|---|
| `p(95)` global | < 500ms |
| `p(95)` routes auth | < 2000ms (bcrypt) |
| `p(95)` génération PDF | < 5000ms |
| Taux d'erreur | < 1% |

Si un seuil est dépassé, k6 termine avec un code d'erreur non nul (la pipeline CI échoue).

### Intégration CI/CD

Le smoke test s'exécute automatiquement à chaque Pull Request vers `develop` ou `main` via le workflow `.github/workflows/load-test.yml`.

## Cache

L'API utilise un cache en mémoire via `node-cache` pour réduire la charge sur la base de données.

### Routes mises en cache

| Route | Clé de cache | TTL |
|---|---|---|
| `GET /api/clients` | `clients_{userId}` | 60s |
| `GET /api/services` | `services_{userId}` | 60s |
| `GET /api/invoices` | `invoices_{userId}` | 60s |

### Fonctionnement

- Le cache est isolé **par utilisateur** via la clé `{ressource}_{userId}` — un utilisateur ne peut jamais accéder aux données d'un autre.
- Au premier appel (cache miss), la donnée est récupérée depuis la BDD puis stockée en cache.
- Aux appels suivants (cache hit), la donnée est retournée directement depuis la mémoire, sans requête BDD.
- Le cache est **invalidé automatiquement** à chaque mutation (`POST`, `PUT`, `DELETE`) pour garantir la cohérence des données.
- Le TTL de 60 secondes sert de filet de sécurité en cas d'invalidation manquée.

### Configuration

Le cache est instancié une seule fois dans `src/config/cache.js` et partagé par tous les services. Modifier le TTL par défaut à cet endroit suffit à l'appliquer globalement.

## Rate Limiting

L'API applique un rate limit global sur toutes les routes via `express-rate-limit`.

### Configuration

| Paramètre | Valeur |
|---|---|
| Fenêtre de temps | 15 minutes |
| Requêtes max par IP | 100 |
| Code de réponse en cas de dépassement | `429 Too Many Requests` |

### Comportement

- Le compteur est **par adresse IP** et s'applique à toutes les routes sans exception.
- Chaque réponse inclut les headers suivants :
  - `RateLimit` — limite et nombre de requêtes restantes
  - `RateLimit-Policy` — détail de la politique appliquée
- En cas de dépassement, l'API retourne :

```json
HTTP 429
{ "message": "Too many requests, please try again later." }
```

### Test du rate limit

Un scénario k6 dédié permet de vérifier que le blocage intervient bien après 100 requêtes :

```bash
k6 run --env BASE_URL=http://localhost:3000 tests/loads/scenarios/rate-limit.js
```

Ce scénario envoie 110 requêtes depuis un seul VU sans pause et vérifie qu'au moins une réponse 429 est reçue.

## Logo utilisateur

Les utilisateurs peuvent uploader un logo qui sera intégré automatiquement dans leurs factures PDF.

### Upload

```
POST /api/auth/logo
Authorization: Bearer <token>
Content-Type: multipart/form-data

Champ : logo (fichier image)
```

Formats acceptés : `.jpg`, `.jpeg`, `.png`
Taille max : **2 MB**

### Stockage

Le logo est converti en **base64** et stocké directement dans la colonne `logo_data` (type `TEXT`) de la table `users`. Aucun fichier n'est écrit sur le disque, ce qui rend la solution compatible Docker sans configuration de volume.

### Récupération

```
GET /api/auth/me
Authorization: Bearer <token>
```

La réponse inclut le champ `logo_data` au format data URI (`data:image/png;base64,...`), utilisable directement comme attribut `src` d'une balise `<img>`.

### Intégration PDF

Lors de la génération d'une facture (`GET /api/invoices/:id/pdf`), le logo est automatiquement affiché en haut à gauche du document si l'utilisateur en a uploadé un.
