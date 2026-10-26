import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/**
 * Appel cette fonction une fois par VU pour qu'elles possède leurs propres token pour l'utiliser dans le protocole bcrypt
 *
 * @param {string} email
 * @param {string} password
 * @returns {string} JWT token
 */
export function getToken(email, password) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'auth: login status 200': (r) => r.status === 200,
    'auth: token present': (r) => r.json('token') !== undefined,
  });

  return res.json('token');
}

export { BASE_URL };
