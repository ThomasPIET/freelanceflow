# FreelanceFlow - Docker Compose

Ce repo permet de lancer l'ensemble de l'application FreelanceFlow (frontend, backend, base de donnees) via Docker Compose.

## Prerequis

- [Docker](https://docs.docker.com/get-docker/) et [Docker Compose](https://docs.docker.com/compose/install/) installes sur votre machine
- Un acces aux repos GitHub du projet

## Installation

### 1. Cloner ce repo

```bash
git clone git@github.com:freelanceFlow/docker-compose.git freelanceFlow
cd freelanceFlow
```

### 2. Cloner les repos front et back a l'interieur

```bash
git clone git@github.com:freelanceFlow/back.git
git clone git@github.com:freelanceFlow/front.git
```

Vous devez obtenir la structure suivante :

```
freelanceFlow/
├── back/
├── front/
├── docker-compose.yml
└── README.md
```

### 3. Configurer les variables d'environnement

#### Backend

Creer le fichier `back/.env` :

```bash
cp back/.env.example back/.env
```

Ou le creer manuellement avec le contenu suivant :

```env
PORT=3000
NODE_ENV=development

DATABASE_URL=postgresql://freelanceFlow:freelanceFlow@db:5432/freelanceFlow

JWT_SECRET=votre-secret-jwt-ici
JWT_EXPIRES_IN=24h
```

> **Important** : remplacez `votre-secret-jwt-ici` par une vraie cle secrete. Vous pouvez en generer une avec :
> ```bash
> openssl rand -hex 32
> ```

#### Frontend

Aucune configuration necessaire. La variable `NEXT_PUBLIC_API_URL` est configuree automatiquement par le `docker-compose.yml`.

## Lancement

```bash
docker compose up --build
```

Au demarrage, le backend applique automatiquement les migrations de la base de donnees, puis lance le serveur.

### Acces

| Service  | URL                     |
|----------|-------------------------|
| Frontend | http://localhost:3001    |
| Backend  | http://localhost:3000    |
| PostgreSQL | localhost:5432        |

### Arreter les services

```bash
docker compose down
```

Pour supprimer egalement les donnees de la base :

```bash
docker compose down -v
```
