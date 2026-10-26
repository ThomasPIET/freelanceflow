# FreelanceFlow

Application de facturation pour freelances, découpée en micro-services et lancée avec Docker Compose.

## Architecture

| Service | Langage | Rôle | Port interne | Publié |
|---|---|---|---|---|
| `frontend` | Next.js (TypeScript) | Interface web ; relaie `/api/*` vers les services internes | 3000 | `localhost:3001` |
| `backend` | Node.js / Express | Authentification (JWT, rôles), clients, prestations, factures, envoi des e-mails | 3000 | non |
| `users-service` | Python / FastAPI | Suppression de son compte, administration des comptes | 8000 | non |
| `pdf-service` | Node.js / Express | Génération des factures PDF (sans état) | 3000 | non |
| `db` | PostgreSQL 16 | Données persistantes | 5432 | non |
| `mailpit` | — | Boîte mail de test (capte les e-mails envoyés) | 1025 / 8025 | `127.0.0.1:8025` |

Seul le frontend est joignable par les clients. Les backends et la base sont sur des réseaux Docker internes
(`app` et `db`, ce dernier sans accès Internet).

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) et Docker Compose

## Installation

```bash
git clone <url-du-depot> freelanceFlow
cd freelanceFlow
cp .env.example .env
```

Dans `.env`, remplacer les valeurs `change-me` :

- `JWT_SECRET` : générer une clé avec `openssl rand -hex 32` ;
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` : identifiants du compte administrateur créé au démarrage ;
- `POSTGRES_PASSWORD` : mot de passe de la base.

`docker compose` refuse de démarrer si une de ces variables manque.

## Lancement

```bash
docker compose up --build
```

Au démarrage, le backend applique les migrations, crée le compte administrateur (s'il n'existe pas) puis lance le serveur.

| Accès | URL |
|---|---|
| Application | http://localhost:3001 |
| Mailpit (e-mails envoyés) | http://localhost:8025 |

- Un compte créé via « Inscription » est **standard**.
- Le compte **admin** est celui de `ADMIN_EMAIL` / `ADMIN_PASSWORD` ; il accède à la page « Administration » pour supprimer des comptes standard.
- Tout compte peut se supprimer depuis « Mon Profil ».

## Arrêt

```bash
docker compose down        # arrête les conteneurs
docker compose down -v     # arrête et supprime aussi les données de la base
```

## Environnements (DEV / TEST / UAT / PROD)

Un seul `docker-compose.yml`, paramétré par un fichier d'environnement. Chaque fichier fixe son propre
`COMPOSE_PROJECT_NAME` : conteneurs, réseaux et volumes sont séparés, plusieurs environnements peuvent tourner en même temps.

| Env | Fichier | `NODE_ENV` | Front | E-mails |
|---|---|---|---|---|
| DEV | `.env` (depuis `.env.example`) | development | `:3001` | Mailpit `:8025` |
| TEST | `env/test.env` | test | `:3101` | Mailpit `:8125` |
| UAT | `env/uat.env` | production | `:3201` | Mailpit `:8225` |
| PROD | `env/prod.env` | production | `:80` | vrai SMTP (Resend), pas de Mailpit |

```bash
cp env/uat.env.example env/uat.env      # puis remplacer les « change-me »
docker compose --env-file env/uat.env up -d --build
docker compose --env-file env/uat.env down
```

Les fichiers `env/*.env` (avec les secrets) sont ignorés par Git ; seuls les `*.env.example` sont versionnés.
Mailpit n'est démarré que si `COMPOSE_PROFILES=mail`.

### Bonnes pratiques appliquées dans le compose

- **Limites de ressources** sur chaque service (`deploy.resources.limits` CPU / mémoire, plus une réservation mémoire).
- **Healthchecks** sur tous les services ; le démarrage suit les dépendances (`depends_on: condition: service_healthy`).
- **Rotation des logs** (`json-file`, 3 fichiers de 10 Mo max).
- **Isolation réseau** : réseau `db` interne (sans accès Internet), seuls le front et Mailpit (sur `127.0.0.1`) publient un port.
- **Conteneurs non-root** pour tous les services applicatifs ; le code du backend est en lecture seule pour l'utilisateur qui l'exécute.
- **Secrets obligatoires** : `${VAR:?…}` refuse de démarrer si une variable manque.

## Tests unitaires

```bash
cd back && npm ci && npm test
cd pdf-service && npm ci && npm test
cd users-service && python3.13 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/pytest
```

## CI/CD (GitHub Actions)

Un workflow par service dans `.github/workflows/` (`back.yml`, `front.yml`, `users-service.yml`, `pdf-service.yml`).
Il se déclenche à chaque push sur n'importe quelle branche, ne concernant que les fichiers du service, et à chaque tag poussé (tous les services).

| Étape | Contenu |
|---|---|
| Lint & format | ESLint + Prettier (Node), ruff (Python), `tsc` pour le front |
| Unit tests | jest, vitest ou pytest selon le service |
| Dependency audit | `npm audit --audit-level=high` / `pip-audit` |
| Docker image | build, scan Trivy (vulnérabilités critiques), push sur GHCR (`docker-image.yml`, workflow réutilisable) |

Les images sont publiées sur `ghcr.io/<owner>/freelanceflow-<service>` avec le SHA du commit comme tag, le nom du tag Git
pour un tag, et `latest` sur `main`. Chaque étape dépend de la précédente : une erreur arrête le pipeline.
`back-load-test.yml` lance en plus un test de charge k6 sur `main`.

## Structure du dépôt

```
freelanceFlow/
├── front/            # frontend Next.js
├── back/             # backend Node.js (API REST principale)
├── users-service/    # backend Python (comptes)
├── pdf-service/      # backend Node.js (PDF)
├── docker-compose.yml
└── .env.example
```
