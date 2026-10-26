/**
 * Main k6 entry point.
 *
 * Runs auth and invoices scenarios concurrently using named executors.
 * Each scenario has its own VU pool and ramp-up curve.
 *
 * Run modes (via --env PROFILE=<mode>):
 *   smoke  — 2 VUs, 1 min (default, used in CI on every PR)
 *   load   — ramp to 30 VUs, 8 min total
 *   stress — ramp to 80 VUs, 7 min total
 *
 * Examples:
 *   k6 run tests/loads/main.js
 *   k6 run --env PROFILE=load tests/loads/main.js
 *   k6 run --env PROFILE=stress --env BASE_URL=https://api.example.com tests/loads/main.js
 */

import { thresholds } from './config/options.js';

// ---------------------------------------------------------------------------
// Stage definitions per profile
// ---------------------------------------------------------------------------
const PROFILES = {
  smoke: {
    auth:     [{ duration: '1m', target: 2 }],
    invoices: [{ duration: '1m', target: 2 }],
  },
  load: {
    auth:     [{ duration: '2m', target: 15 }, { duration: '5m', target: 15 }, { duration: '1m', target: 0 }],
    invoices: [{ duration: '2m', target: 15 }, { duration: '5m', target: 15 }, { duration: '1m', target: 0 }],
  },
  stress: {
    auth:     [{ duration: '2m', target: 20 }, { duration: '2m', target: 40 }, { duration: '2m', target: 60 }, { duration: '1m', target: 0 }],
    invoices: [{ duration: '2m', target: 20 }, { duration: '2m', target: 40 }, { duration: '2m', target: 60 }, { duration: '1m', target: 0 }],
  },
};

const profile = (__ENV.PROFILE && PROFILES[__ENV.PROFILE]) ? __ENV.PROFILE : 'smoke';
const stages = PROFILES[profile];

export const options = {
  thresholds,
  scenarios: {
    auth_scenario: {
      executor: 'ramping-vus',
      exec: 'authTest',
      stages: stages.auth,
      gracefulRampDown: '30s',
    },
    invoices_scenario: {
      executor: 'ramping-vus',
      exec: 'invoicesTest',
      stages: stages.invoices,
      gracefulRampDown: '30s',
      // Start invoices 10s after auth — gives auth a head start
      // so the DB pool isn't fully saturated on the first iteration
      startTime: '10s',
    },
  },
};

// ---------------------------------------------------------------------------
// Scenario handlers — k6 routes each executor to its named export
// ---------------------------------------------------------------------------
export { default as authTest } from './scenarios/auth.js';
export { default as invoicesTest } from './scenarios/invoices.js';
export { default as rateLimitTest } from './scenarios/rate-limit.js';
