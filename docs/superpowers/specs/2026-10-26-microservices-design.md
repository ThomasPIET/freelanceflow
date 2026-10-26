# FreelanceFlow — découpage en micro-services et gestion des comptes

Date : 2026-10-26 — Échéance projet : 30/10/2026 (démo live 9:00, rendu 23:23)

## 1. Objectif

Mettre le projet en conformité avec la consigne « Dév avec Docker » sur les points suivants :

- au moins **3 backends**, chacun dans son conteneur, en au moins **2 langages** ;
- comptes **standard** / **admin** ; chacun peut **supprimer son compte** ; un admin peut **supprimer un compte standard** ;
- **backends et base de données non joignables** par les clients (seul le frontend l'est) ;
- chaque backend a des **tests unitaires** ;
- démo : envoi de facture par e-mail visible immédiatement (Mailpit).

### Décisions prises

| Sujet | Décision |
|---|---|
| 2ᵉ langage | Python 3.13 / FastAPI |
| Découpage | auth + métier restent dans le backend Node ; nouveau `users-service` (Python) pour la suppression des comptes ; nouveau `pdf-service` (Node) extrait du backend |
| Création d'admin | admin initial créé au démarrage depuis `ADMIN_EMAIL` / `ADMIN_PASSWORD` ; l'inscription crée toujours un compte standard |
| E-mails | SMTP via `nodemailer` ; Mailpit en dev/démo, `smtp.resend.com` en prod (même code) |
| Dépôt Git | dépôt unique (monorepo) : `front/`, `back/`, `users-service/`, `pdf-service/`, `docker-compose.yml` |
| Base partagée | `backend` et `users-service` partagent la base Postgres ; le schéma reste géré par les migrations du backend, `users-service` ne fait que lire / supprimer dans `users` (compromis assumé, à justifier dans le rapport) |

### Hors périmètre (sous-projets suivants)

CI/CD des 4 services ; limites CPU/mémoire et environnements TEST/UAT/PROD ; `back/Dockerfile` non-root + Node 22 ; page d'accueil publique ; rapport.

## 2. Architecture

```
                Navigateur
                    │  http://localhost:3001   (+ 127.0.0.1:8025 interface Mailpit)
                    ▼
            ┌───────────────┐
            │   frontend    │  Next.js — rewrites :
            │   (Next.js)   │   /api/users, /api/users/*  → users-service:8000/users…
            └──────┬────────┘   /api/*                    → backend:3000/api/*
       réseau app  │
        ┌──────────┴───────────┐
        ▼                      ▼
┌───────────────┐      ┌────────────────┐
│   backend     │      │ users-service  │
│  Node/Express │      │ Python/FastAPI │
└──┬─────┬───┬──┘      └───────┬────────┘
   │     │   │ SMTP            │
   │     │   ▼                 │
   │     │ ┌─────────┐         │
   │     │ │ mailpit │         │
   │     │ └─────────┘         │
   │     ▼ HTTP                │
   │  ┌──────────────┐         │
   │  │ pdf-service  │         │
   │  └──────────────┘         │
   ▼           réseau db       ▼
        ┌──────────────────┐
        │  db (Postgres)   │
        └──────────────────┘
```

- Réseau `app` : frontend, backend, users-service, pdf-service, mailpit.
- Réseau `db` : backend, users-service, db.
- Ports publiés : `3001` (frontend) et `127.0.0.1:8025` (UI Mailpit) uniquement.

### Authentification entre services

- Le backend signe le JWT (HS256) avec `{ id, email, role }`.
- `users-service` vérifie la signature avec le même `JWT_SECRET` et lit `role` dans le token. Un token sans `role` est traité comme `standard`.
- `pdf-service` n'a pas d'authentification : il n'est joignable que sur le réseau interne `app`, et seul le backend l'appelle.

### Flux

1. **Télécharger un PDF** : navigateur → front `/api/invoices/:id/pdf` → backend charge la facture → `POST pdf-service/pdf/invoice` (JSON) → PDF renvoyé au navigateur.
2. **Envoyer une facture** : idem, puis le backend envoie le mail en SMTP (Mailpit) avec le PDF en pièce jointe. La transaction existante est conservée : si le PDF ou le mail échoue, le statut de la facture n'est pas modifié.
3. **Supprimer un compte** : navigateur → front `/api/users/me` (ou `/api/users/:id` pour un admin) → `users-service` → `DELETE FROM users` → les FK `ON DELETE CASCADE` suppriment clients, prestations, factures et lignes.

## 3. backend (Node, existant) — modifications

### Rôles

- Migration : colonne `users.role` `STRING`, `NOT NULL`, défaut `'standard'`, valeurs autorisées `'standard'` | `'admin'` (validation au niveau du modèle Sequelize).
- `POST /api/auth/register` : crée toujours `role = 'standard'` ; un champ `role` envoyé par le client est ignoré.
- `POST /api/auth/login` : payload JWT `{ id, email, role }`.
- `GET /api/auth/me` : renvoie aussi `role`.

### Admin initial — `back/scripts/create-admin.js`

Exécuté au démarrage, après les migrations et avant le serveur. Idempotent :

- `ADMIN_EMAIL` ou `ADMIN_PASSWORD` absent → ne fait rien, l'indique dans les logs, code de sortie 0 ;
- e-mail inconnu → crée l'utilisateur (`role = 'admin'`, mot de passe hashé bcrypt, prénom « Admin », nom « FreelanceFlow ») ;
- e-mail existant avec `role = 'standard'` → passe en `admin` ;
- e-mail existant déjà admin → ne fait rien.

### PDF

- `src/services/pdf.service.js` garde la requête Sequelize actuelle (facture + client + lignes + prestations + utilisateur), construit le JSON décrit en §5, appelle `POST ${PDF_SERVICE_URL}/pdf/invoice` via `fetch` et renvoie `{ buffer, invoiceNumber }`.
- Facture introuvable → `404` (inchangé). `pdf-service` injoignable ou réponse non-2xx → erreur `502 { message: "PDF service unavailable" }`.
- `invoice.controller.js` : `getPdf` envoie le buffer ; `sendEmail` utilise directement le buffer (suppression de la reconstitution du flux).

### E-mail

- `src/services/email.service.js` : `nodemailer` avec transport SMTP configuré par `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (auth seulement si `SMTP_USER` est défini), `SMTP_SECURE` (`true` pour le port 465), `MAIL_FROM`.
- Signature inchangée : `sendInvoiceEmail({ to, clientName, invoiceNumber, pdfBuffer })`, renvoie `{ id }` (le `messageId`). Échec SMTP → erreur `502`.

### Dépendances

Retirer `resend` et `pdfkit` ; ajouter `nodemailer`.

### Variables d'environnement

`DATABASE_URL`, `JWT_SECRET`, `PDF_SERVICE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Un `back/.env.example` documente l'usage hors Docker (`npm run dev`).

## 4. users-service (Python 3.13 / FastAPI, nouveau)

### API

| Méthode | Route | Accès | Réponses |
|---|---|---|---|
| `GET` | `/health` | interne | `200 { "status": "ok" }` |
| `DELETE` | `/users/me` | connecté | `204` ; `404` si le compte n'existe plus |
| `GET` | `/users` | admin | `200 [{ id, email, first_name, last_name, role, created_at }]` triés par `id` |
| `DELETE` | `/users/{id}` | admin | `204` ; `404` si inconnu ; `403` si la cible est un admin |

- Erreurs communes : `401` sans token / token invalide ou expiré ; `403` si non admin sur une route admin.
- Toutes les erreurs ont la forme `{ "message": "..." }` (le front lit `response.data.message`).
- Un admin qui veut supprimer son propre compte passe par `DELETE /users/me`.

### Structure

```
users-service/
├── app/
│   ├── __init__.py
│   ├── main.py        # app FastAPI, routes, handlers d'erreurs → { message }
│   ├── auth.py        # décodage JWT, dépendances current_user / require_admin
│   ├── repository.py  # UserRepository (psycopg 3, SQL brut) : list_users, get_user, delete_user
│   └── config.py      # DATABASE_URL, JWT_SECRET
├── tests/
│   └── test_users.py
├── requirements.txt       # fastapi, uvicorn, psycopg[binary], pyjwt
├── requirements-dev.txt   # pytest, httpx, ruff
├── Dockerfile
└── .dockerignore
```

Le repository est injecté par dépendance FastAPI ; les tests le remplacent par une implémentation en mémoire (pas de base nécessaire).

## 5. pdf-service (Node 22 / Express, extrait du backend)

### API

`POST /pdf/invoice` — corps JSON, limite 5 Mo (logo base64 jusqu'à ~2,7 Mo) :

```json
{
  "invoice_number": "INV-00012",
  "invoice": { "issued_at": "2026-10-20T00:00:00.000Z", "status": "sent", "total_ht": "100.00", "total_ttc": "120.00", "tva_rate": "20" },
  "issuer":  { "first_name": "", "last_name": "", "email": "", "address_line1": "", "address_line2": "", "zip_code": "", "city": "", "country": "", "logo_data": "data:image/png;base64,..." },
  "client":  { "name": "", "company": "", "email": "", "address_line1": "", "address_line2": "", "zip_code": "", "city": "", "country": "" },
  "lines":   [ { "label": "Dev web", "quantity": "2", "unit_price": "50.00", "total": "100.00" } ]
}
```

- `200` `Content-Type: application/pdf` (corps binaire).
- `400 { message }` si `invoice_number`, `invoice`, `issuer`, `client` ou `lines` (tableau) est absent.
- `GET /health` → `200 { status: "ok" }`.

### Implémentation

- Le code de mise en page est repris presque tel quel de l'actuel `back/src/services/pdf.service.js`, en lisant l'objet JSON au lieu des modèles Sequelize. Le libellé de ligne (`label`) est calculé par le backend (`Service.label` ou `Service #<id>`).
- Express, pdfkit ; jest + supertest ; eslint + prettier (même configuration que le backend).

## 6. Frontend — modifications

- `next.config.ts` : `rewrites()` dans cet ordre :
  1. `/api/users` → `${USERS_SERVICE_URL}/users`
  2. `/api/users/:path*` → `${USERS_SERVICE_URL}/users/:path*`
  3. `/api/:path*` → `${BACKEND_URL}/api/:path*`

  Les rewrites sont figés au build : `BACKEND_URL` (défaut `http://backend:3000`) et `USERS_SERVICE_URL` (défaut `http://users-service:8000`) sont des `ARG` du `front/Dockerfile`, qui remplacent `NEXT_PUBLIC_API_URL`.
- `src/lib/api.ts` : `baseURL: '/api'`.
- `src/types/index.ts` : `User.role: 'standard' | 'admin'`.
- `src/services/user.service.ts` (nouveau) : `deleteMe()`, `getAll()`, `delete(id)`.
- `/profile` : bloc « Supprimer mon compte » + dialog de confirmation → `deleteMe()` → `storageService.clear()` → redirection `/login`.
- `/admin/users` (nouveau) : tableau des comptes (email, nom, badge rôle, date de création), bouton « Supprimer » sur les comptes standard uniquement, confirmation, toast `sonner`, rechargement de la liste. Si l'utilisateur connecté n'est pas admin : message « Accès réservé aux administrateurs » (la protection réelle est le `403` de users-service).
- Sidebar (desktop et mobile) : lien « Administration » → `/admin/users`, affiché seulement si `user.role === 'admin'`. Un utilisateur connecté avant la mise à jour doit se reconnecter pour récupérer son rôle.

## 7. docker-compose et configuration

- `.env` racine (ignoré par Git) + `.env.example` versionné : `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`. Le compose les interpole avec `${VAR:?message}` (démarrage refusé si une variable manque).
- Le compose n'utilise plus `back/.env` (réservé au lancement hors Docker).

| Service | Build / image | Réseaux | Ports | Notes |
|---|---|---|---|---|
| `db` | `postgres:16-alpine` | db | — | healthcheck `pg_isready` (existant), volume `pgdata` |
| `backend` | `./back` | app, db | — | commande : migrations → `create-admin` → serveur ; `depends_on` db (healthy), pdf-service, mailpit |
| `users-service` | `./users-service` | app, db | — | `depends_on` db (healthy) |
| `pdf-service` | `./pdf-service` | app | — | |
| `mailpit` | `axllent/mailpit:v1.32.0` | app | `127.0.0.1:8025:8025` | SMTP 1025 interne |
| `frontend` | `./front` (args `BACKEND_URL`, `USERS_SERVICE_URL`) | app | `3001:3000` | `depends_on` backend, users-service |

Variables injectées :

- `db` : `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (depuis `.env`).
- `backend` : `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (depuis `.env`) ; `NODE_ENV=development`, `PDF_SERVICE_URL=http://pdf-service:3000`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_SECURE=false`, `MAIL_FROM=factures@freelanceflow.local` (valeurs fixes dans le compose).
- `users-service` : `DATABASE_URL` (même valeur), `JWT_SECRET`.

## 8. Dockerfiles des nouveaux services

- **users-service** : `python:3.13-slim`, deux étapes (étape 1 : création d'un venv `/opt/venv` + `pip install --no-cache-dir -r requirements.txt` ; étape 2 : copie du venv et de `app/`), `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUNBUFFERED=1`, utilisateur non-root, `EXPOSE 8000`, `HEALTHCHECK` sur `/health` (via `python -c` + `urllib`), `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`.
- **pdf-service** : `node:22-alpine`, deux étapes (`npm ci --omit=dev` puis copie de `node_modules` + sources), `NODE_ENV=production`, `USER node`, `EXPOSE 3000`, `HEALTHCHECK` via `wget -qO- http://localhost:3000/health`, `CMD ["node", "server.js"]`.
- **front** : remplacement de l'`ARG NEXT_PUBLIC_API_URL` par `ARG BACKEND_URL` / `ARG USERS_SERVICE_URL`.

## 9. Gestion des erreurs (récapitulatif)

| Situation | Réponse |
|---|---|
| Token absent / invalide (users-service) | `401 { message }` → le front vide la session et redirige vers `/login` (intercepteur existant) |
| Non-admin sur route admin | `403 { message }` |
| Suppression d'un admin via `/users/{id}` | `403 { message }` |
| Compte introuvable | `404 { message }` |
| pdf-service indisponible | `502 { message: "PDF service unavailable" }` |
| Échec SMTP | `502 { message }`, statut de facture inchangé (rollback) |
| Corps invalide sur pdf-service | `400 { message }` |
| Variable obligatoire manquante dans `.env` | `docker compose` refuse de démarrer avec le message de `${VAR:?…}` |

## 10. Tests

### Unitaires

- **back (jest)** : tests PDF et e-mail adaptés (`fetch` et `nodemailer` mockés) ; rôle présent dans le JWT au login ; l'inscription ignore `role` et crée un compte standard ; `/auth/me` renvoie `role` ; `create-admin` (variables absentes, création, promotion, déjà admin).
- **users-service (pytest)** : chaque route en cas nominal ; sans token (401) ; token invalide (401) ; standard sur route admin (403) ; suppression d'un admin (403) ; compte inconnu (404) ; format `{ message }` des erreurs.
- **pdf-service (jest + supertest)** : corps valide → `200`, `application/pdf`, corps commençant par `%PDF` ; champ obligatoire manquant → `400` ; `/health` → `200`.

### Vérification de bout en bout (`docker compose up --build`)

1. `docker compose ps` ne publie que `3001` et `127.0.0.1:8025` ; `curl http://localhost:3000` échoue.
2. Inscription d'un compte standard → création client, prestation, facture → téléchargement du PDF → envoi : le mail et le PDF apparaissent dans Mailpit (`http://localhost:8025`).
3. Connexion avec l'admin initial → `/admin/users` → suppression du compte standard qui a des factures → succès et données supprimées. **Point de vigilance** : la FK `invoice_lines.service_id` est en `ON DELETE RESTRICT` ; la cascade via `clients → invoices → invoice_lines` devrait passer avant celle sur `services`, ce test le confirme. En cas d'échec : migration passant cette FK en `CASCADE`.
4. Un compte standard supprime son propre compte depuis `/profile` → redirection vers `/login`, reconnexion impossible.
5. Un compte standard ouvre `/admin/users` → message d'erreur ; `GET /api/users` renvoie `403`.
