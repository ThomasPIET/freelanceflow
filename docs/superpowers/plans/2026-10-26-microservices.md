# Découpage en micro-services — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passer de 1 à 3 backends (Node + Python), ajouter rôles standard/admin et suppression de comptes, isoler backends et base derrière le frontend, et envoyer les factures via Mailpit.

**Architecture:** Le backend Node garde auth + métier et ajoute le rôle dans le JWT. `users-service` (FastAPI) gère les suppressions de comptes en vérifiant le même JWT et en écrivant dans la même base. `pdf-service` (Node) rend les PDF à partir d'un JSON. Le frontend Next.js relaie `/api/*` vers les services internes via `rewrites` ; seuls le front et l'UI Mailpit sont publiés.

**Tech Stack:** Node 20 (back) / Node 22 (pdf-service), Express, Sequelize, jest + supertest, nodemailer ; Python 3.13, FastAPI, psycopg 3, PyJWT, pytest, ruff ; Next.js 16 ; Postgres 16 ; Mailpit v1.32.0 ; Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-26-microservices-design.md`

## Global Constraints

- Toutes les erreurs HTTP des backends ont la forme `{ "message": "..." }`.
- Rôles autorisés : `'standard'` et `'admin'` ; défaut `'standard'`.
- JWT HS256, payload `{ id, email, role }` ; token sans `role` = `standard`.
- Ports publiés par le compose : uniquement `3001:3000` (frontend) et `127.0.0.1:8025:8025` (Mailpit).
- `pdf-service` : `POST /pdf/invoice`, limite JSON 5 Mo ; `users-service` écoute sur 8000 ; `pdf-service` sur 3000.
- Mailpit : image `axllent/mailpit:v1.32.0`.
- Les nouveaux conteneurs tournent en non-root et ont un `HEALTHCHECK`.
- Aucun secret versionné : `.env` (racine et `back/`) ignorés par Git ; seuls les `.env.example` sont commités.
- Messages de commit en anglais, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Suppression d'un utilisateur qui a des factures (FK `invoice_lines.service_id` en `RESTRICT`) → doit réussir et tout supprimer — vérifié en Task 10 étape 4 sur une vraie base.
2. Token JWT émis avant la mise à jour (sans `role`) → accepté comme `standard`, refusé (403) sur les routes admin — test en Task 6.
3. Logo absent ou corrompu dans le profil → le PDF est quand même généré — tests en Task 3.
4. Facture sans lignes et champs optionnels `null` (`company`, `address_line2`, `issued_at`) → PDF généré, pas de 500 — tests en Task 3.
5. Identifiant non entier (`DELETE /users/abc`) ou en-tête `Authorization: Basic …` → 4xx avec `{ message }`, jamais 500 — tests en Task 6.

---

## File Structure

```
.env.example                       (créé)  variables partagées du compose
docker-compose.yml                 (modifié) 6 services, 2 réseaux
README.md                          (réécrit) monorepo
back/
  migrations/20261026000000-add-role-to-users.js   (créé)
  scripts/create-admin.js          (créé)  admin initial idempotent
  src/models/user.model.js         (modifié) champ role
  src/services/auth.service.js     (modifié) role à l'inscription / dans le JWT / dans /me
  src/services/pdf.service.js      (réécrit) client HTTP vers pdf-service
  src/services/email.service.js    (réécrit) nodemailer SMTP
  src/controllers/invoice.controller.js (modifié) buffer PDF
  src/__tests__/auth.test.js       (modifié)
  src/__tests__/create-admin.test.js (créé)
  src/__tests__/pdf.test.js        (réécrit)
  src/__tests__/email.test.js      (créé)
  src/__tests__/send.test.js       (créé)
  .env.example                     (créé)
  package.json                     (modifié) -pdfkit -resend +nodemailer
pdf-service/                       (créé)
  package.json, server.js, eslint.config.js, .prettierrc, .dockerignore, Dockerfile
  src/app.js        routes + validation
  src/render.js     mise en page pdfkit → Buffer
  src/__tests__/app.test.js
users-service/                     (créé)
  app/__init__.py, app/config.py, app/auth.py, app/repository.py, app/main.py
  tests/__init__.py, tests/test_users.py
  pyproject.toml, requirements.txt, requirements-dev.txt, Dockerfile, .dockerignore, .gitignore
front/
  next.config.ts                   (modifié) rewrites
  Dockerfile                       (modifié) ARG BACKEND_URL / USERS_SERVICE_URL
  src/lib/api.ts                   (modifié) baseURL '/api'
  src/types/index.ts               (modifié) User.role
  src/services/user.service.ts     (créé)
  src/app/profile/page.tsx         (modifié) suppression du compte
  src/app/admin/users/page.tsx     (créé)
  src/components/shared/sidebar.tsx (modifié) lien Administration
```

---

### Task 1: Rôle utilisateur dans le backend

**Files:**
- Create: `back/migrations/20261026000000-add-role-to-users.js`
- Modify: `back/src/models/user.model.js`, `back/src/services/auth.service.js`
- Test: `back/src/__tests__/auth.test.js`

**Interfaces:**
- Produces: colonne `users.role` ; JWT `{ id, email, role }` ; `GET /api/auth/me` renvoie `role` ; `register` renvoie `{ id, email, first_name, last_name, role }`.

- [ ] **Step 1: Installer les dépendances du back** — `cd back && npm ci`

- [ ] **Step 2: Écrire les tests qui échouent** (dans `auth.test.js`)

Modifier l'attente du test « should register a new user » : `User.create` doit être appelé avec `role: 'standard'` en plus des champs existants. Ajouter :

```js
    it('should always create a standard account, even if role is sent', async () => {
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed_password');
      User.create.mockResolvedValue({ id: 2, email: 'new@test.com', role: 'standard' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...registerData, role: 'admin' });

      expect(res.status).toBe(201);
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'standard' }));
      expect(res.body.role).toBe('standard');
    });
```

Dans `POST /api/auth/login` :

```js
    it('should put the role in the token', async () => {
      User.findOne.mockResolvedValue({
        id: 1,
        email: 'admin@test.com',
        password_hash: 'hashed_password',
        role: 'admin',
      });
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app).post('/api/auth/login').send(loginData);

      expect(jwt.verify(res.body.token, JWT_SECRET).role).toBe('admin');
    });
```

Dans `GET /api/auth/me` :

```js
    it('should request the role attribute', async () => {
      User.findByPk.mockResolvedValue({ id: 1, email: 'test@test.com', role: 'standard' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${generateToken()}`);

      expect(res.body.role).toBe('standard');
      expect(User.findByPk.mock.calls[0][1].attributes).toContain('role');
    });
```

- [ ] **Step 3: Vérifier l'échec** — `npx jest src/__tests__/auth.test.js` → les 4 tests ci-dessus échouent.

- [ ] **Step 4: Implémenter**

Migration :

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'standard',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'role');
  },
};
```

Modèle (après `logo_data`) :

```js
    role: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'standard',
      validate: { isIn: [['standard', 'admin']] },
    },
```

`auth.service.js` : dans `register`, ajouter `role: 'standard'` à `User.create(...)` et `role: user.role` à l'objet retourné ; dans `login`, signer `{ id: user.id, email: user.email, role: user.role }` ; dans `getMe`, ajouter `'role'` à `attributes`.

- [ ] **Step 5: Vérifier** — `npx jest` → tout passe. `npm run lint && npm run format:check` → OK.

- [ ] **Step 6: Commit** — `feat(back): add standard/admin role to users and JWT`

---

### Task 2: Admin initial (`create-admin`)

**Files:**
- Create: `back/scripts/create-admin.js`, `back/src/__tests__/create-admin.test.js`

**Interfaces:**
- Consumes: `User` (Task 1, champ `role`).
- Produces: `ensureAdmin({ email, password }) → Promise<'skipped'|'created'|'promoted'|'unchanged'>` ; exécution CLI `node scripts/create-admin.js` (lit `ADMIN_EMAIL`, `ADMIN_PASSWORD`).

- [ ] **Step 1: Test qui échoue**

```js
jest.mock('../config/database', () => ({ define: jest.fn(() => ({})), close: jest.fn() }));
jest.mock('../models/user.model', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('bcrypt', () => ({ hash: jest.fn() }));

const bcrypt = require('bcrypt');
const User = require('../models/user.model');
const { ensureAdmin } = require('../../scripts/create-admin');

describe('ensureAdmin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('skips when email or password is missing', async () => {
    expect(await ensureAdmin({ email: '', password: 'x' })).toBe('skipped');
    expect(await ensureAdmin({ email: 'a@b.c', password: undefined })).toBe('skipped');
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('creates the admin when the email is unknown', async () => {
    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed');

    expect(await ensureAdmin({ email: 'admin@test.com', password: 'secret' })).toBe('created');
    expect(User.create).toHaveBeenCalledWith({
      email: 'admin@test.com',
      password_hash: 'hashed',
      first_name: 'Admin',
      last_name: 'FreelanceFlow',
      role: 'admin',
    });
  });

  it('promotes an existing standard account', async () => {
    const existing = { role: 'standard', update: jest.fn() };
    User.findOne.mockResolvedValue(existing);

    expect(await ensureAdmin({ email: 'admin@test.com', password: 'secret' })).toBe('promoted');
    expect(existing.update).toHaveBeenCalledWith({ role: 'admin' });
  });

  it('does nothing when the account is already admin', async () => {
    const existing = { role: 'admin', update: jest.fn() };
    User.findOne.mockResolvedValue(existing);

    expect(await ensureAdmin({ email: 'admin@test.com', password: 'secret' })).toBe('unchanged');
    expect(existing.update).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — `npx jest src/__tests__/create-admin.test.js` → « Cannot find module '../../scripts/create-admin' ».

- [ ] **Step 3: Implémenter `back/scripts/create-admin.js`**

```js
require('dotenv').config();
const bcrypt = require('bcrypt');
const sequelize = require('../src/config/database');
const User = require('../src/models/user.model');

const SALT_ROUNDS = 10;

async function ensureAdmin({ email, password }) {
  if (!email || !password) return 'skipped';

  const existing = await User.findOne({ where: { email } });
  if (!existing) {
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    await User.create({
      email,
      password_hash,
      first_name: 'Admin',
      last_name: 'FreelanceFlow',
      role: 'admin',
    });
    return 'created';
  }

  if (existing.role !== 'admin') {
    await existing.update({ role: 'admin' });
    return 'promoted';
  }

  return 'unchanged';
}

if (require.main === module) {
  ensureAdmin({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    .then((result) => {
      console.log(`create-admin: ${result}`);
      return sequelize.close();
    })
    .catch((error) => {
      console.error('create-admin failed:', error);
      process.exit(1);
    });
}

module.exports = { ensureAdmin };
```

- [ ] **Step 4: Vérifier** — `npx jest` → tout passe.

- [ ] **Step 5: Commit** — `feat(back): create initial admin account at startup`

---

### Task 3: pdf-service

**Files:**
- Create: `pdf-service/package.json`, `server.js`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `.dockerignore`, `Dockerfile`, `src/app.js`, `src/render.js`, `src/__tests__/app.test.js`

**Interfaces:**
- Produces: `POST /pdf/invoice` (corps du §5 de la spec) → `200 application/pdf` | `400 { message }` | `413 { message }` ; `GET /health` → `{ status: 'ok' }` ; `renderInvoicePdf(data) → Promise<Buffer>`.

- [ ] **Step 1: Scaffolding**

`package.json` :

```json
{
  "name": "freelanceflow-pdf-service",
  "version": "1.0.0",
  "description": "FreelanceFlow — invoice PDF rendering service",
  "main": "server.js",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "lint": "eslint \"src/**/*.js\" server.js",
    "format": "prettier --write \"src/**/*.js\" server.js",
    "format:check": "prettier --check \"src/**/*.js\" server.js",
    "test": "jest --coverage"
  },
  "engines": { "node": ">=22" }
}
```

Puis `npm install express pdfkit` et `npm install -D jest supertest eslint @eslint/js eslint-config-prettier prettier`. Copier `eslint.config.js`, `.prettierrc` et `.prettierignore` depuis `back/`. `.gitignore` : `node_modules/` et `coverage/`. `.dockerignore` : `node_modules`, `coverage`, `src/__tests__`, `.git`, `*.log`.

`server.js` :

```js
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`pdf-service listening on port ${PORT}`);
});
```

- [ ] **Step 2: Tests qui échouent** — `src/__tests__/app.test.js`

```js
const request = require('supertest');
const app = require('../app');

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const validBody = () => ({
  invoice_number: 'INV-00001',
  invoice: {
    issued_at: '2026-10-20T00:00:00.000Z',
    status: 'sent',
    total_ht: '150.00',
    total_ttc: '180.00',
    tva_rate: '20',
  },
  issuer: {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@test.com',
    address_line1: '1 rue Test',
    address_line2: null,
    zip_code: '75000',
    city: 'Paris',
    country: 'France',
    logo_data: PNG_1X1,
  },
  client: {
    name: 'Acme',
    company: 'Acme Inc',
    email: 'acme@test.com',
    address_line1: '2 avenue Client',
    address_line2: null,
    zip_code: '69000',
    city: 'Lyon',
    country: 'France',
  },
  lines: [{ label: 'Dev Web', quantity: '2', unit_price: '75.00', total: '150.00' }],
});

const binaryParser = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const postPdf = (body) =>
  request(app).post('/pdf/invoice').send(body).buffer(true).parse(binaryParser);

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /pdf/invoice', () => {
  it('renders a PDF', async () => {
    const res = await postPdf(validBody());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('renders without logo, lines, company or issue date', async () => {
    const body = validBody();
    body.issuer.logo_data = null;
    body.client.company = null;
    body.invoice.issued_at = null;
    body.lines = [];

    const res = await postPdf(body);

    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('renders even when the logo is corrupted', async () => {
    const body = validBody();
    body.issuer.logo_data = 'data:image/png;base64,not-an-image';

    const res = await postPdf(body);

    expect(res.status).toBe(200);
  });

  it.each(['invoice_number', 'invoice', 'issuer', 'client', 'lines'])(
    'returns 400 when %s is missing',
    async (field) => {
      const body = validBody();
      delete body[field];

      const res = await request(app).post('/pdf/invoice').send(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
    }
  );

  it('returns 400 when lines is not an array', async () => {
    const res = await request(app)
      .post('/pdf/invoice')
      .send({ ...validBody(), lines: 'nope' });

    expect(res.status).toBe(400);
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await request(app)
      .post('/pdf/invoice')
      .set('Content-Type', 'application/json')
      .send('{"invoice_number":');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
});
```

- [ ] **Step 3: Vérifier l'échec** — `npx jest` → « Cannot find module '../app' ».

- [ ] **Step 4: Implémenter `src/render.js`** — reprise de la mise en page de `back/src/services/pdf.service.js` (lignes « En-tête » à « Total TTC ») en remplaçant `invoice.User` → `data.issuer`, `invoice.Client` → `data.client`, `invoice.InvoiceLines` → `data.lines`, le libellé de ligne → `line.label`, et `invoiceNumber` → `data.invoice_number` ; le document est collecté en Buffer :

```js
const PDFDocument = require('pdfkit');

function renderInvoicePdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawInvoice(doc, data);
    doc.end();
  });
}

function drawInvoice(doc, data) {
  const { invoice, issuer: user, client, lines } = data;
  // … corps identique à l'ancien pdf.service.js (logo, titre, émetteur, destinataire,
  //   tableau des lignes avec line.label, totaux) …
}

module.exports = { renderInvoicePdf };
```

(Le corps de `drawInvoice` est copié verbatim depuis l'ancien fichier, seules les variables ci-dessus changent ; les champs `null` sont déjà gérés par les `if` existants, `client.email` est écrit tel quel.)

`src/app.js` :

```js
const express = require('express');
const { renderInvoicePdf } = require('./render');

const REQUIRED_OBJECTS = ['invoice', 'issuer', 'client'];

function validationError(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!body.invoice_number) return 'Missing field: invoice_number';
  for (const field of REQUIRED_OBJECTS) {
    if (!body[field] || typeof body[field] !== 'object') return `Missing field: ${field}`;
  }
  if (!Array.isArray(body.lines)) return 'Missing field: lines (array expected)';
  return null;
}

const app = express();

app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/pdf/invoice', async (req, res, next) => {
  const error = validationError(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const pdf = await renderInvoicePdf(req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err.stack);
  res.status(status).json({ message: status >= 500 ? 'Internal Server Error' : err.message });
});

module.exports = app;
```

- [ ] **Step 5: Vérifier** — `npx jest` → tout passe ; `npm run lint && npm run format:check` → OK.

- [ ] **Step 6: Dockerfile**

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node src ./src
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "server.js"]
```

Vérifier : `docker build -t freelanceflow-pdf-service:dev pdf-service` → succès.

- [ ] **Step 7: Commit** — `feat(pdf-service): add stateless invoice PDF rendering service`

---

### Task 4: Le backend délègue le PDF à pdf-service

**Files:**
- Modify: `back/src/services/pdf.service.js` (réécrit), `back/src/controllers/invoice.controller.js`, `back/package.json`
- Test: `back/src/__tests__/pdf.test.js` (réécrit), `back/src/__tests__/send.test.js` (créé)

**Interfaces:**
- Consumes: `POST ${PDF_SERVICE_URL}/pdf/invoice` (Task 3).
- Produces: `generateInvoicePdf(invoiceId, userId, transaction) → Promise<{ buffer: Buffer, invoiceNumber: string }>` ; erreur `{ status: 502, message: 'PDF service unavailable' }`.

- [ ] **Step 1: Réécrire `pdf.test.js`** — mêmes mocks `database` et `models` que l'actuel, sans le mock `pdfkit`, avec `global.fetch = jest.fn()` et `process.env.PDF_SERVICE_URL = 'http://pdf-service:3000'` avant `require('../app')`. Garder `mockFullInvoice`. Tests :

```js
const pdfResponse = () => ({
  ok: true,
  arrayBuffer: async () => Buffer.from('%PDF-1.3 fake'),
});

it('should return 401 without token', …)                       // inchangé
it('should return 404 when invoice not found', …)              // inchangé + expect(fetch).not.toHaveBeenCalled()

it('should return the PDF from pdf-service with correct headers', async () => {
  Invoice.findOne.mockResolvedValue(mockFullInvoice);
  fetch.mockResolvedValue(pdfResponse());

  const res = await request(app).get('/api/invoices/1/pdf').set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toBe('application/pdf');
  expect(res.headers['content-disposition']).toBe('attachment; filename="INV-00001.pdf"');
});

it('should send the invoice data to pdf-service', async () => {
  Invoice.findOne.mockResolvedValue(mockFullInvoice);
  fetch.mockResolvedValue(pdfResponse());

  await request(app).get('/api/invoices/1/pdf').set('Authorization', `Bearer ${token}`);

  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe('http://pdf-service:3000/pdf/invoice');
  expect(options.method).toBe('POST');
  const body = JSON.parse(options.body);
  expect(body.invoice_number).toBe('INV-00001');
  expect(body.issuer).toMatchObject({ first_name: 'John', last_name: 'Doe', email: 'john@test.com' });
  expect(body.client).toMatchObject({ name: 'Acme Corp', company: 'Acme Inc' });
  expect(body.invoice).toMatchObject({ total_ht: 150, total_ttc: 180, tva_rate: 20 });
  expect(body.lines).toEqual([{ label: 'Dev Web', quantity: 2, unit_price: 75, total: 150 }]);
});

it('should label a line without service by its id', async () => {
  Invoice.findOne.mockResolvedValue({
    ...mockFullInvoice,
    InvoiceLines: [{ service_id: 7, quantity: 1, unit_price: 10, total: 10, Service: null }],
  });
  fetch.mockResolvedValue(pdfResponse());

  await request(app).get('/api/invoices/1/pdf').set('Authorization', `Bearer ${token}`);

  expect(JSON.parse(fetch.mock.calls[0][1].body).lines[0].label).toBe('Service #7');
});

it('should return 502 when pdf-service is unreachable', async () => {
  Invoice.findOne.mockResolvedValue(mockFullInvoice);
  fetch.mockRejectedValue(new Error('ECONNREFUSED'));

  const res = await request(app).get('/api/invoices/1/pdf').set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(502);
  expect(res.body.message).toBe('PDF service unavailable');
});

it('should return 502 when pdf-service answers an error', async () => {
  Invoice.findOne.mockResolvedValue(mockFullInvoice);
  fetch.mockResolvedValue({ ok: false, status: 500 });

  const res = await request(app).get('/api/invoices/1/pdf').set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(502);
});
```

- [ ] **Step 2: Créer `send.test.js`** (orchestration de `POST /api/invoices/:id/send`, services mockés)

```js
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/database', () => ({ define: jest.fn(() => ({})), authenticate: jest.fn() }));

const transaction = { commit: jest.fn(), rollback: jest.fn() };
jest.mock('../models', () => ({
  sequelize: { transaction: jest.fn(async () => transaction) },
  Invoice: {},
  InvoiceLine: {},
  Client: {},
  Service: {},
  User: {},
}));
jest.mock('../services/invoice.service', () => ({ update: jest.fn(), findById: jest.fn() }));
jest.mock('../services/pdf.service', () => ({ generateInvoicePdf: jest.fn() }));
jest.mock('../services/email.service', () => ({ sendInvoiceEmail: jest.fn() }));

const app = require('../app');
const invoiceService = require('../services/invoice.service');
const pdfService = require('../services/pdf.service');
const emailService = require('../services/email.service');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const token = jwt.sign({ id: 1, email: 'test@test.com' }, process.env.JWT_SECRET);

describe('POST /api/invoices/:id/send', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invoiceService.update.mockResolvedValue({});
    invoiceService.findById.mockResolvedValue({ Client: { email: 'acme@test.com', name: 'Acme' } });
    pdfService.generateInvoicePdf.mockResolvedValue({
      buffer: Buffer.from('%PDF'),
      invoiceNumber: 'INV-00001',
    });
  });

  it('sends the PDF by email and commits', async () => {
    emailService.sendInvoiceEmail.mockResolvedValue({ id: '<abc@mailpit>' });

    const res = await request(app).post('/api/invoices/1/send').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.emailId).toBe('<abc@mailpit>');
    expect(emailService.sendInvoiceEmail).toHaveBeenCalledWith({
      to: 'acme@test.com',
      clientName: 'Acme',
      invoiceNumber: 'INV-00001',
      pdfBuffer: Buffer.from('%PDF'),
    });
    expect(transaction.commit).toHaveBeenCalled();
    expect(transaction.rollback).not.toHaveBeenCalled();
  });

  it('rolls back the status change when the email fails', async () => {
    emailService.sendInvoiceEmail.mockRejectedValue(
      Object.assign(new Error('Failed to send email: refused'), { status: 502 })
    );

    const res = await request(app).post('/api/invoices/1/send').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(502);
    expect(transaction.rollback).toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
  });

  it('rolls back when pdf-service is unavailable', async () => {
    pdfService.generateInvoicePdf.mockRejectedValue(
      Object.assign(new Error('PDF service unavailable'), { status: 502 })
    );

    const res = await request(app).post('/api/invoices/1/send').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(502);
    expect(emailService.sendInvoiceEmail).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Vérifier l'échec** — `npx jest src/__tests__/pdf.test.js src/__tests__/send.test.js` → échecs (fetch jamais appelé, `buffer` absent).

- [ ] **Step 4: Réécrire `back/src/services/pdf.service.js`**

```js
const { Invoice, InvoiceLine, Client, Service, User } = require('../models');

const ISSUER_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'address_line1',
  'address_line2',
  'zip_code',
  'city',
  'country',
  'logo_data',
];
const CLIENT_FIELDS = [
  'name',
  'company',
  'email',
  'address_line1',
  'address_line2',
  'zip_code',
  'city',
  'country',
];
const INVOICE_FIELDS = ['issued_at', 'status', 'total_ht', 'total_ttc', 'tva_rate'];

const pick = (source, fields) =>
  Object.fromEntries(fields.map((field) => [field, source?.[field] ?? null]));

function serviceUnavailable() {
  const error = new Error('PDF service unavailable');
  error.status = 502;
  return error;
}

function buildPayload(invoice, invoiceNumber) {
  return {
    invoice_number: invoiceNumber,
    invoice: pick(invoice, INVOICE_FIELDS),
    issuer: pick(invoice.User, ISSUER_FIELDS),
    client: pick(invoice.Client, CLIENT_FIELDS),
    lines: (invoice.InvoiceLines || []).map((line) => ({
      label: line.Service ? line.Service.label : `Service #${line.service_id}`,
      quantity: line.quantity,
      unit_price: line.unit_price,
      total: line.total,
    })),
  };
}

async function generateInvoicePdf(invoiceId, userId, transaction) {
  const invoice = await Invoice.findOne({
    where: { id: invoiceId, user_id: userId },
    include: [
      { model: Client },
      { model: InvoiceLine, include: [{ model: Service }] },
      { model: User, attributes: ['id', ...ISSUER_FIELDS] },
    ],
    transaction,
  });

  if (!invoice) {
    const error = new Error('Invoice not found');
    error.status = 404;
    throw error;
  }

  const invoiceNumber = `INV-${String(invoice.id).padStart(5, '0')}`;

  let response;
  try {
    response = await fetch(`${process.env.PDF_SERVICE_URL}/pdf/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(invoice, invoiceNumber)),
    });
  } catch {
    throw serviceUnavailable();
  }

  if (!response.ok) throw serviceUnavailable();

  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, invoiceNumber };
}

module.exports = { generateInvoicePdf };
```

Dans `invoice.controller.js` :
- `getPdf` : `const { buffer, invoiceNumber } = await pdfService.generateInvoicePdf(...)` puis `res.send(buffer)` à la place de `doc.pipe(res)`.
- `sendEmail` : `const { buffer: pdfBuffer, invoiceNumber } = await pdfService.generateInvoicePdf(...)` ; supprimer `chunks`, les `doc.on(...)`, la `Promise` et `Buffer.concat`.

- [ ] **Step 5: Retirer pdfkit** — `npm uninstall pdfkit`.

- [ ] **Step 6: Vérifier** — `npx jest` → tout passe ; lint + format OK.

- [ ] **Step 7: Commit** — `refactor(back): delegate invoice PDF rendering to pdf-service`

---

### Task 5: E-mails en SMTP (nodemailer)

**Files:**
- Modify: `back/src/services/email.service.js` (réécrit), `back/package.json`
- Create: `back/src/__tests__/email.test.js`, `back/.env.example`

**Interfaces:**
- Produces: `sendInvoiceEmail({ to, clientName, invoiceNumber, pdfBuffer }) → Promise<{ id: string }>` ; erreur `status 502`.

- [ ] **Step 1: Test qui échoue**

```js
const sendMail = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail })) }));

const nodemailer = require('nodemailer');

describe('email.service', () => {
  let emailService;

  beforeEach(() => {
    jest.resetModules();
    sendMail.mockReset();
    nodemailer.createTransport.mockClear();
    process.env.SMTP_HOST = 'mailpit';
    process.env.SMTP_PORT = '1025';
    process.env.SMTP_SECURE = 'false';
    delete process.env.SMTP_USER;
    process.env.MAIL_FROM = 'factures@freelanceflow.local';
    emailService = require('../services/email.service');
  });

  const message = {
    to: 'acme@test.com',
    clientName: 'Acme',
    invoiceNumber: 'INV-00001',
    pdfBuffer: Buffer.from('%PDF'),
  };

  it('sends the invoice with the PDF attached', async () => {
    sendMail.mockResolvedValue({ messageId: '<abc@mailpit>' });

    const result = await emailService.sendInvoiceEmail(message);

    expect(result).toEqual({ id: '<abc@mailpit>' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'mailpit',
      port: 1025,
      secure: false,
      auth: undefined,
    });
    const mail = sendMail.mock.calls[0][0];
    expect(mail.from).toBe('factures@freelanceflow.local');
    expect(mail.to).toBe('acme@test.com');
    expect(mail.subject).toBe('Facture INV-00001');
    expect(mail.attachments).toEqual([
      { filename: 'INV-00001.pdf', content: message.pdfBuffer, contentType: 'application/pdf' },
    ]);
  });

  it('uses SMTP credentials when SMTP_USER is set', async () => {
    process.env.SMTP_USER = 'resend';
    process.env.SMTP_PASS = 'key';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_PORT = '465';
    jest.resetModules();
    emailService = require('../services/email.service');
    sendMail.mockResolvedValue({ messageId: 'id' });

    await emailService.sendInvoiceEmail(message);

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true, auth: { user: 'resend', pass: 'key' } })
    );
  });

  it('throws a 502 error when SMTP fails', async () => {
    sendMail.mockRejectedValue(new Error('connection refused'));

    await expect(emailService.sendInvoiceEmail(message)).rejects.toMatchObject({
      status: 502,
      message: 'Failed to send email: connection refused',
    });
  });
});
```

(Note : `jest.resetModules()` recharge aussi le mock `nodemailer` ; on récupère donc `nodemailer` et `sendMail` via la factory partagée — `sendMail` est une variable du module de test, le mock la référence, ce qui reste stable. Si `nodemailer.createTransport` est rechargé, relire `require('nodemailer')` dans `beforeEach` après `resetModules`.)

- [ ] **Step 2: Vérifier l'échec** — `npm install nodemailer && npx jest src/__tests__/email.test.js` → échec (le service utilise encore Resend).

- [ ] **Step 3: Réécrire `email.service.js`**

```js
const nodemailer = require('nodemailer');

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

async function sendInvoiceEmail({ to, clientName, invoiceNumber, pdfBuffer }) {
  const from = process.env.MAIL_FROM || 'factures@freelanceflow.local';

  try {
    const info = await getTransporter().sendMail({
      from,
      to,
      subject: `Facture ${invoiceNumber}`,
      html: `
      <h2>Bonjour ${clientName},</h2>
      <p>Veuillez trouver ci-joint votre facture <strong>${invoiceNumber}</strong>.</p>
      <p>N'hésitez pas à nous contacter pour toute question.</p>
      <p>Cordialement</p>
    `,
      attachments: [
        { filename: `${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
      ],
    });
    return { id: info.messageId };
  } catch (error) {
    const err = new Error(`Failed to send email: ${error.message}`);
    err.status = 502;
    throw err;
  }
}

module.exports = { sendInvoiceEmail };
```

- [ ] **Step 4: Retirer Resend** — `npm uninstall resend`.

- [ ] **Step 5: `back/.env.example`** (usage hors Docker)

```env
PORT=3000
NODE_ENV=development

DATABASE_URL=postgresql://freelanceFlow:freelanceFlow@localhost:5432/freelanceFlow
JWT_SECRET=change-me
JWT_EXPIRES_IN=24h

PDF_SERVICE_URL=http://localhost:3002

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=factures@freelanceflow.local

ADMIN_EMAIL=admin@freelanceflow.local
ADMIN_PASSWORD=change-me
```

- [ ] **Step 6: Vérifier** — `npx jest` ; lint ; format → OK.

- [ ] **Step 7: Commit** — `feat(back): send invoice emails over SMTP with nodemailer`

---

### Task 6: users-service (Python / FastAPI)

**Files:**
- Create: `users-service/app/__init__.py` (vide), `app/config.py`, `app/auth.py`, `app/repository.py`, `app/main.py`, `tests/__init__.py` (vide), `tests/test_users.py`, `pyproject.toml`, `requirements.txt`, `requirements-dev.txt`, `Dockerfile`, `.dockerignore`, `.gitignore`

**Interfaces:**
- Consumes: JWT `{ id, email, role }` signé HS256 par le backend (Task 1) ; table `users` (colonne `role`).
- Produces: `GET /health`, `DELETE /users/me`, `GET /users`, `DELETE /users/{id}` (spec §4) ; `get_repository()` (dépendance FastAPI surchargeable).

- [ ] **Step 1: Environnement**

`requirements.txt` :
```
fastapi>=0.115
uvicorn>=0.32
psycopg[binary]>=3.2
PyJWT>=2.9
```
`requirements-dev.txt` :
```
-r requirements.txt
pytest>=8
httpx>=0.27
ruff>=0.7
```
`pyproject.toml` :
```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]

[tool.ruff]
target-version = "py313"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP"]
```
`.gitignore` : `.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`. `.dockerignore` : idem + `tests/`, `requirements-dev.txt`.

Commandes : `python3.13 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt`, puis figer les versions installées des 4 dépendances de `requirements.txt` avec `==` (lues via `.venv/bin/pip freeze`).

- [ ] **Step 2: Tests qui échouent** — `tests/test_users.py`

```python
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from app.main import app, get_repository

SECRET = "test-secret"

USERS = [
    {"id": 1, "email": "admin@test.com", "first_name": "Ada", "last_name": "Min",
     "role": "admin", "created_at": "2026-10-01T00:00:00"},
    {"id": 2, "email": "bob@test.com", "first_name": "Bob", "last_name": "Std",
     "role": "standard", "created_at": "2026-10-02T00:00:00"},
    {"id": 3, "email": "root@test.com", "first_name": "Root", "last_name": "Admin",
     "role": "admin", "created_at": "2026-10-03T00:00:00"},
]


class FakeRepository:
    def __init__(self, users):
        self.users = {user["id"]: dict(user) for user in users}

    def list_users(self):
        return [self.users[user_id] for user_id in sorted(self.users)]

    def get_user(self, user_id):
        return self.users.get(user_id)

    def delete_user(self, user_id):
        return self.users.pop(user_id, None) is not None


@pytest.fixture
def repo(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    fake = FakeRepository(USERS)
    app.dependency_overrides[get_repository] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


@pytest.fixture
def client(repo):
    return TestClient(app)


def bearer(user_id, role=None, secret=SECRET, expires_in=timedelta(hours=1)):
    payload = {"id": user_id, "email": "x@test.com", "exp": datetime.now(UTC) + expires_in}
    if role is not None:
        payload["role"] = role
    return {"Authorization": f"Bearer {jwt.encode(payload, secret, algorithm='HS256')}"}


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ── DELETE /users/me ─────────────────────────────────
def test_delete_me_removes_own_account(client, repo):
    response = client.delete("/users/me", headers=bearer(2, "standard"))
    assert response.status_code == 204
    assert 2 not in repo.users


def test_admin_can_delete_own_account(client, repo):
    response = client.delete("/users/me", headers=bearer(3, "admin"))
    assert response.status_code == 204
    assert 3 not in repo.users


def test_delete_me_unknown_account_returns_404(client):
    response = client.delete("/users/me", headers=bearer(42, "standard"))
    assert response.status_code == 404
    assert response.json() == {"message": "User not found"}


def test_missing_token_returns_401(client):
    response = client.delete("/users/me")
    assert response.status_code == 401
    assert "message" in response.json()


def test_basic_auth_header_returns_401(client):
    response = client.delete("/users/me", headers={"Authorization": "Basic Zm9vOmJhcg=="})
    assert response.status_code == 401


def test_wrong_signature_returns_401(client, repo):
    response = client.delete("/users/me", headers=bearer(2, "standard", secret="other"))
    assert response.status_code == 401
    assert 2 in repo.users


def test_expired_token_returns_401(client):
    response = client.delete("/users/me", headers=bearer(2, "standard", expires_in=timedelta(hours=-1)))
    assert response.status_code == 401


# ── GET /users ───────────────────────────────────────
def test_admin_lists_users_sorted(client):
    response = client.get("/users", headers=bearer(1, "admin"))
    assert response.status_code == 200
    assert [user["id"] for user in response.json()] == [1, 2, 3]
    assert response.json()[1]["role"] == "standard"


def test_standard_cannot_list_users(client):
    response = client.get("/users", headers=bearer(2, "standard"))
    assert response.status_code == 403
    assert "message" in response.json()


def test_token_without_role_is_standard(client):
    response = client.get("/users", headers=bearer(1))
    assert response.status_code == 403


# ── DELETE /users/{id} ───────────────────────────────
def test_admin_deletes_standard_account(client, repo):
    response = client.delete("/users/2", headers=bearer(1, "admin"))
    assert response.status_code == 204
    assert 2 not in repo.users


def test_admin_cannot_delete_admin_account(client, repo):
    response = client.delete("/users/3", headers=bearer(1, "admin"))
    assert response.status_code == 403
    assert 3 in repo.users


def test_admin_delete_unknown_account_returns_404(client):
    response = client.delete("/users/99", headers=bearer(1, "admin"))
    assert response.status_code == 404


def test_standard_cannot_delete_other_account(client, repo):
    response = client.delete("/users/1", headers=bearer(2, "standard"))
    assert response.status_code == 403
    assert 1 in repo.users


def test_non_integer_id_returns_422_with_message(client):
    response = client.delete("/users/abc", headers=bearer(1, "admin"))
    assert response.status_code == 422
    assert "message" in response.json()
```

- [ ] **Step 3: Vérifier l'échec** — `.venv/bin/pytest` → `ModuleNotFoundError: app.main`.

- [ ] **Step 4: Implémenter**

`app/config.py` :
```python
import os


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def database_url() -> str:
    return os.environ["DATABASE_URL"]
```

`app/auth.py` :
```python
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import config

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: int
    role: str


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized: No token provided")
    try:
        payload = jwt.decode(credentials.credentials, config.jwt_secret(), algorithms=["HS256"])
    except jwt.InvalidTokenError as error:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Unauthorized: Invalid or expired token"
        ) from error

    user_id = payload.get("id")
    if not isinstance(user_id, int):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized: Invalid or expired token")
    return CurrentUser(id=user_id, role=payload.get("role", "standard"))


def require_admin(user: CurrentUser = Depends(current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden: admin only")
    return user
```

`app/repository.py` :
```python
from typing import Any, Protocol

import psycopg
from psycopg.rows import dict_row

USER_COLUMNS = "id, email, first_name, last_name, role, created_at"


class UserRepository(Protocol):
    def list_users(self) -> list[dict[str, Any]]: ...
    def get_user(self, user_id: int) -> dict[str, Any] | None: ...
    def delete_user(self, user_id: int) -> bool: ...


class PostgresUserRepository:
    def __init__(self, dsn: str):
        self._dsn = dsn

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(self._dsn, row_factory=dict_row)

    def list_users(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            return conn.execute(f"SELECT {USER_COLUMNS} FROM users ORDER BY id").fetchall()

    def get_user(self, user_id: int) -> dict[str, Any] | None:
        with self._connect() as conn:
            return conn.execute(
                f"SELECT {USER_COLUMNS} FROM users WHERE id = %s", (user_id,)
            ).fetchone()

    def delete_user(self, user_id: int) -> bool:
        with self._connect() as conn:
            return conn.execute("DELETE FROM users WHERE id = %s", (user_id,)).rowcount == 1
```

`app/main.py` :
```python
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import config
from app.auth import CurrentUser, current_user, require_admin
from app.repository import PostgresUserRepository, UserRepository

app = FastAPI(title="FreelanceFlow users-service")


def get_repository() -> UserRepository:
    return PostgresUserRepository(config.database_url())


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"message": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, _exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"message": "Invalid request"})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    user: CurrentUser = Depends(current_user),
    repo: UserRepository = Depends(get_repository),
) -> Response:
    if not repo.delete_user(user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/users")
def list_users(
    _admin: CurrentUser = Depends(require_admin),
    repo: UserRepository = Depends(get_repository),
) -> list[dict]:
    return repo.list_users()


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    _admin: CurrentUser = Depends(require_admin),
    repo: UserRepository = Depends(get_repository),
) -> Response:
    target = repo.get_user(user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target["role"] == "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin accounts cannot be deleted")
    repo.delete_user(user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 5: Vérifier** — `.venv/bin/pytest -v` → tout passe ; `.venv/bin/ruff check . && .venv/bin/ruff format --check .` → OK.

- [ ] **Step 6: Dockerfile**

```dockerfile
FROM python:3.13-slim AS builder
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"
WORKDIR /app
RUN useradd --system --uid 1001 --no-create-home app
COPY --from=builder /opt/venv /opt/venv
COPY app ./app
USER app
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Vérifier : `docker build -t freelanceflow-users-service:dev users-service` → succès.

- [ ] **Step 7: Commit** — `feat(users-service): add FastAPI service for account deletion and admin`

---

### Task 7: Front — routage via le front et services API

**Files:**
- Modify: `front/next.config.ts`, `front/Dockerfile`, `front/src/lib/api.ts`, `front/src/types/index.ts`
- Create: `front/src/services/user.service.ts`

**Interfaces:**
- Produces: `userService.deleteMe()`, `userService.getAll(): Promise<AxiosResponse<AdminUser[]>>`, `userService.delete(id: number)` ; type `AdminUser` ; `User.role: 'standard' | 'admin'`.

- [ ] **Step 1: `next.config.ts`**

```ts
import type { NextConfig } from 'next';

// Les rewrites sont figés au build : ces URL sont des ARG du Dockerfile.
const backendUrl = process.env.BACKEND_URL ?? 'http://backend:3000';
const usersServiceUrl = process.env.USERS_SERVICE_URL ?? 'http://users-service:8000';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/api/users', destination: `${usersServiceUrl}/users` },
      { source: '/api/users/:path*', destination: `${usersServiceUrl}/users/:path*` },
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: `front/Dockerfile`** — remplacer les deux lignes `ARG NEXT_PUBLIC_API_URL` / `ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL` par :

```dockerfile
ARG BACKEND_URL=http://backend:3000
ARG USERS_SERVICE_URL=http://users-service:8000
ENV BACKEND_URL=$BACKEND_URL \
    USERS_SERVICE_URL=$USERS_SERVICE_URL
```

- [ ] **Step 3: `src/lib/api.ts`** — remplacer le bloc commenté « PROD » et l'instance « DEV » par :

```ts
// Toutes les requêtes passent par le front, qui les relaie aux services internes (next.config.ts)
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});
```

- [ ] **Step 4: Types et service**

`src/types/index.ts`, dans `User` après `logo_data?: string;` : `role: 'standard' | 'admin';`

`src/services/user.service.ts` :
```ts
import api from '@/lib/api';
import { User } from '@/types';

export type AdminUser = Pick<
  User,
  'id' | 'email' | 'first_name' | 'last_name' | 'role' | 'created_at'
>;

export const userService = {
  deleteMe: () => api.delete('/users/me'),
  getAll: () => api.get<AdminUser[]>('/users'),
  delete: (id: number) => api.delete(`/users/${id}`),
};
```

- [ ] **Step 5: Vérifier** — `cd front && npm ci && npx tsc --noEmit && npm run lint` → OK (corriger toute erreur de type due au nouveau champ obligatoire `role`).

- [ ] **Step 6: Commit** — `feat(front): proxy API calls through Next.js rewrites and add user service`

---

### Task 8: Front — suppression du compte, page admin, lien Administration

**Files:**
- Modify: `front/src/app/profile/page.tsx`, `front/src/components/shared/sidebar.tsx`
- Create: `front/src/app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `userService` et `AdminUser` (Task 7) ; `useAuth()` (`user`, `isLoading`) ; composants `Dialog*`, `Table*`, `Badge`, `Button`, `Card*`, `Skeleton` ; `toast` de `sonner`.

- [ ] **Step 1: Profil — suppression du compte**

Imports ajoutés : `userService` depuis `@/services/user.service`, `Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle` depuis `@/components/ui/dialog`, `Trash2` depuis `lucide-react`.

État et handler (après `logoLoading`) :
```tsx
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
```
```tsx
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await userService.deleteMe();
      storageService.clear();
      window.location.href = '/login';
    } catch {
      toast.error('Erreur lors de la suppression du compte.');
      setIsDeleting(false);
    }
  };
```

JSX, après la `div` de grille et avant la fermeture du conteneur principal :
```tsx
      <Card className="border-destructive/30 shadow-sm">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-destructive text-sm font-semibold tracking-wider uppercase">
            Supprimer mon compte
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Cette action supprime définitivement votre compte ainsi que vos
            clients, prestations et factures.
          </p>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => setIsDeleteOpen(true)}
          >
            <Trash2 size={18} />
            Supprimer mon compte
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Supprimer mon compte
            </DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Toutes vos données seront
              supprimées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? 'Suppression...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 2: Page `/admin/users`** — `src/app/admin/users/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlert, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { userService, AdminUser } from '@/services/user.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdminUsersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    userService
      .getAll()
      .then(({ data }) => setUsers(data))
      .catch(() => toast.error('Impossible de charger les comptes.'))
      .finally(() => setIsLoading(false));
  }, [isAdmin]);

  const handleDelete = async () => {
    if (!selected) return;
    setIsDeleting(true);
    try {
      await userService.delete(selected.id);
      setUsers((current) => current.filter((u) => u.id !== selected.id));
      toast.success(`Compte ${selected.email} supprimé.`);
      setSelected(null);
    } catch {
      toast.error('Erreur lors de la suppression du compte.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!isAdmin) {
    return (
      <Card className="mx-auto mt-10 max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <ShieldAlert className="text-destructive h-10 w-10" />
          <p className="font-semibold">Accès réservé aux administrateurs</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-foreground text-3xl font-bold">
          Administration
        </h1>
        <p className="text-muted-foreground">
          Gérez les comptes de la plateforme.
        </p>
      </header>

      <Card>
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm font-semibold tracking-wider uppercase">
            Comptes ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.email}</TableCell>
                    <TableCell>
                      {account.first_name} {account.last_name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={account.role === 'admin' ? 'default' : 'secondary'}
                      >
                        {account.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(account.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {account.role === 'standard' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Supprimer ${account.email}`}
                          onClick={() => setSelected(account)}
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Supprimer le compte
            </DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment supprimer <strong>{selected?.email}</strong>{' '}
              et toutes ses données ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Suppression...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Sidebar — lien Administration**

Dans `sidebar.tsx` : importer `Shield` depuis `lucide-react` et `useAuth` depuis `@/hooks/useAuth` ; typer `navigation` et ajouter :
```tsx
type NavItem = (typeof navigation)[number];
const adminItem: NavItem = { name: 'Administration', href: '/admin/users', icon: Shield };
```
`SidebarContent` et `MobileMenu` reçoivent une prop `items: NavItem[]` et itèrent sur `items` au lieu de `navigation`. Dans `Sidebar()` :
```tsx
  const { user } = useAuth();
  const items = user?.role === 'admin' ? [...navigation, adminItem] : navigation;
```
et passer `items={items}` aux deux composants.

- [ ] **Step 4: Vérifier** — `npx tsc --noEmit && npm run lint && npm run format:check && npm run build` (avec `BACKEND_URL=http://localhost:3000`) → OK.

- [ ] **Step 5: Commit** — `feat(front): account deletion, admin users page and admin navigation`

---

### Task 9: docker-compose, configuration et README

**Files:**
- Modify: `docker-compose.yml`, `README.md`
- Create: `.env.example`, `.env` (local, non versionné)

- [ ] **Step 1: `.env.example`**

```env
# Copier en .env puis remplacer les valeurs « change-me »
POSTGRES_USER=freelanceFlow
POSTGRES_PASSWORD=change-me
POSTGRES_DB=freelanceFlow

# openssl rand -hex 32
JWT_SECRET=change-me

# Compte administrateur créé au démarrage du backend
ADMIN_EMAIL=admin@freelanceflow.local
ADMIN_PASSWORD=change-me
```

Créer le `.env` local : mêmes clés, `POSTGRES_PASSWORD=freelanceFlow` (mot de passe du volume `pgdata` existant), `JWT_SECRET` généré par `openssl rand -hex 32`, `ADMIN_PASSWORD` généré par `openssl rand -base64 12`. Vérifier qu'il n'apparaît pas dans `git status`.

- [ ] **Step 2: `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER manquant dans .env}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD manquant dans .env}
      POSTGRES_DB: ${POSTGRES_DB:?POSTGRES_DB manquant dans .env}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - db

  backend:
    build: ./back
    restart: unless-stopped
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET manquant dans .env}
      ADMIN_EMAIL: ${ADMIN_EMAIL:?ADMIN_EMAIL manquant dans .env}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:?ADMIN_PASSWORD manquant dans .env}
      PDF_SERVICE_URL: http://pdf-service:3000
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
      SMTP_SECURE: "false"
      MAIL_FROM: factures@freelanceflow.local
    command: sh -c "npx sequelize-cli db:migrate && node scripts/create-admin.js && node server.js"
    depends_on:
      db:
        condition: service_healthy
      pdf-service:
        condition: service_started
      mailpit:
        condition: service_started
    networks:
      - app
      - db

  users-service:
    build: ./users-service
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET manquant dans .env}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app
      - db

  pdf-service:
    build: ./pdf-service
    restart: unless-stopped
    networks:
      - app

  mailpit:
    image: axllent/mailpit:v1.32.0
    restart: unless-stopped
    ports:
      - "127.0.0.1:8025:8025"
    networks:
      - app

  frontend:
    build:
      context: ./front
      args:
        BACKEND_URL: http://backend:3000
        USERS_SERVICE_URL: http://users-service:8000
    restart: unless-stopped
    ports:
      - "3001:3000"
    depends_on:
      - backend
      - users-service
    networks:
      - app

networks:
  app:
  db:
    internal: true

volumes:
  pgdata:
```

Vérifier : `docker compose config --quiet` → OK ; `mv .env .env.bak && docker compose config --quiet` → erreur « POSTGRES_USER manquant dans .env » ; `mv .env.bak .env`.

- [ ] **Step 3: README** — réécrire pour le monorepo : présentation des 4 services et de Mailpit (tableau service / langage / rôle / port interne), installation (`cp .env.example .env`, générer `JWT_SECRET`), lancement `docker compose up --build`, accès (`http://localhost:3001`, Mailpit `http://localhost:8025`, compte admin = `ADMIN_EMAIL`/`ADMIN_PASSWORD` du `.env`), tests par service (`cd back && npm test`, `cd pdf-service && npm test`, `cd users-service && .venv/bin/pytest`), arrêt (`docker compose down`, `-v`).

- [ ] **Step 4: Commit** — `feat: wire users-service, pdf-service and mailpit into docker compose`

---

### Task 10: Vérification de bout en bout

Aucun fichier (sauf corrections révélées). Chaque étape échouée → corriger dans la tâche concernée, recommiter.

- [ ] **Step 1:** `docker compose up --build -d` puis `docker compose ps` → 6 services `running` (users-service et pdf-service `healthy`) ; logs backend contiennent `create-admin: created` (ou `unchanged`).
- [ ] **Step 2:** Exposition — `docker compose ps --format '{{.Service}} {{.Ports}}'` : seuls frontend (`0.0.0.0:3001->3000`) et mailpit (`127.0.0.1:8025->8025`) ont des ports publiés ; `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health` échoue (connexion refusée) ; `curl http://localhost:3001/api/users` → 401 `{ message }` (relayé par le front).
- [ ] **Step 3:** Parcours standard via le navigateur sur `http://localhost:3001` : inscription → connexion → client → prestation → facture → téléchargement PDF (fichier `%PDF`) → envoi → mail avec pièce jointe visible dans Mailpit (`http://localhost:8025`).
- [ ] **Step 4:** Admin : connexion avec `ADMIN_EMAIL` → lien « Administration » visible → `/admin/users` liste les comptes → suppression du compte standard de l'étape 3 (qui a facture + lignes) → succès ; vérifier en base : `docker compose exec db psql -U freelanceFlow -d freelanceFlow -c "select count(*) from invoices"` ne contient plus ses factures. Si erreur FK `RESTRICT` : ajouter une migration qui passe `invoice_lines_service_id_fkey` en `ON DELETE CASCADE`.
- [ ] **Step 5:** Nouveau compte standard → `/profile` → « Supprimer mon compte » → redirection `/login` → reconnexion refusée (401).
- [ ] **Step 6:** Compte standard sur `/admin/users` → « Accès réservé aux administrateurs » ; pas de lien Administration dans le menu.
- [ ] **Step 7:** Relancer toutes les suites : `back` (`npm test`, lint, format), `pdf-service` (idem), `users-service` (`pytest`, `ruff check`, `ruff format --check`), `front` (`tsc`, lint, build). Commit éventuel des corrections.
