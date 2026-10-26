/**
 * Auth load scenario — tests the two bcrypt-heavy routes:
 *   POST /api/auth/login     (bcrypt.compare)
 *   POST /api/auth/register  (bcrypt.hash)
 *
 * Each VU picks a user from users.json and exercises both routes.
 * Register uses a unique email per iteration to avoid 409 conflicts.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';
import { loadOptions } from '../config/options.js';
import { BASE_URL } from '../helpers/auth.js';

export const options = loadOptions;

// SharedArray is loaded once and shared across all VUs (memory-efficient)
const users = new SharedArray('users', function () {
  return JSON.parse(open('../config/users.json'));
});

// Custom counter to track successful logins independently
const loginSuccess = new Counter('auth_login_success');
const registerSuccess = new Counter('auth_register_success');

export default function () {
  // Each VU picks a user deterministically (round-robin across the pool)
  const user = users[__VU % users.length];

  group('auth', function () {
    // --- LOGIN ---
    group('login', function () {
      const res = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        { headers: { 'Content-Type': 'application/json' } }
      );

      const ok = check(res, {
        'login: status 200': (r) => r.status === 200,
        'login: token present': (r) => {
          try {
            return r.json('token') !== undefined;
          } catch {
            return false;
          }
        },
      });

      if (ok) loginSuccess.add(1);

      // Realistic pause between actions (1-3s)
      sleep(Math.random() * 2 + 1);
    });

    // --- REGISTER ---
    // Use a unique email per iteration: VU id + iteration counter
    group('register', function () {
      const uniqueEmail = `reg_${__VU}_${__ITER}@loadtest.internal`;
      const res = http.post(
        `${BASE_URL}/api/auth/register`,
        JSON.stringify({
          email: uniqueEmail,
          password: 'LoadTest123!',
          first_name: 'Load',
          last_name: 'Reg',
          address_line1: '1 rue du Test',
          zip_code: '75000',
          city: 'Paris',
          country: 'France',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );

      const ok = check(res, {
        'register: status 201': (r) => r.status === 201,
        'register: id present': (r) => {
          try {
            return r.json('id') !== undefined;
          } catch {
            return false;
          }
        },
      });

      if (ok) registerSuccess.add(1);

      sleep(Math.random() * 2 + 1);
    });
  });
}
