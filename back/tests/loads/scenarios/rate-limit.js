/**
 * Rate limit scenario — vérifie que le rate limiter bloque bien à 100 requêtes / 15 min.
 *
 * Stratégie :
 *   1. setup() récupère un token JWT (hors comptage VU)
 *   2. 1 seul VU envoie 110 requêtes GET /api/clients sans pause
 *   3. On vérifie qu'au moins une réponse 429 apparaît
 *
 * À lancer isolément :
 *   k6 run --env BASE_URL=http://localhost:3000 tests/loads/scenarios/rate-limit.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, getToken } from '../helpers/auth.js';

export const options = {
  scenarios: {
    rate_limit_check: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 110,
    },
  },
  thresholds: {
    // Le test est un succès si au moins une requête a reçu un 429
    'rate_limit_hit': ['count>0'],
  },
};

const rateLimitHit = new Counter('rate_limit_hit');

// setup() s'exécute une seule fois avant les VUs — le token ne consomme pas d'itération
export function setup() {
  const token = getToken('load_user_1@loadtest.internal', 'LoadTest123!');
  return { token };
}

export default function (data) {
  const res = http.get(`${BASE_URL}/api/clients`, {
    headers: {
      Authorization: `Bearer ${data.token}`,
    },
  });

  if (res.status === 429) {
    rateLimitHit.add(1);
  }

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'RateLimit headers present': (r) => r.headers['Ratelimit'] !== undefined,
  });

  // Pas de sleep — on veut saturer le rate limiter le plus vite possible
}
