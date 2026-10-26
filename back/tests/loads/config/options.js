/**
 * Reusable k6 load profiles.
 *
 * Usage in a scenario file:
 *   import { smokeOptions } from '../config/options.js';
 *   export const options = smokeOptions;
 *
 * Or in main.js to combine with executor config:
 *   import { thresholds } from '../config/options.js';
 *   export const options = { scenarios: { ... }, thresholds };
 */

/**
 * Shared thresholds applied to all profiles.
 * The PDF route gets its own looser threshold (defined per-group in the scenario).
 */
export const thresholds = {
  // 95% of all requests must complete under 500ms
  http_req_duration: ['p(95)<500'],
  // Less than 1% of requests may fail
  http_req_failed: ['rate<0.01'],
  // Auth-specific: bcrypt is slow, keep p95 under 2s
  'http_req_duration{group:::auth}': ['p(95)<2000'],
  // PDF generation is CPU-bound: p95 under 5s
  'http_req_duration{group:::pdf}': ['p(95)<5000'],
};

/**
 * Smoke: 2 VUs for 1 minute.
 * Purpose: verify that everything works before any real load.
 */
export const smokeOptions = {
  thresholds,
  vus: 2,
  duration: '1m',
};

/**
 * Load: ramp up to 30 VUs over 2 min, hold for 5 min, ramp down.
 * Purpose: simulate normal sustained traffic.
 * 30 VUs is meaningful here because bcrypt (10 rounds) saturates
 * a single Node.js thread fast — no need for 200 VUs to find the limit.
 */
export const loadOptions = {
  thresholds,
  stages: [
    { duration: '2m', target: 30 },
    { duration: '5m', target: 30 },
    { duration: '1m', target: 0 },
  ],
};

/**
 * Stress: ramp to 80 VUs to find the breaking point.
 * Purpose: identify where response times degrade or errors appear.
 */
export const stressOptions = {
  thresholds,
  stages: [
    { duration: '2m', target: 30 },
    { duration: '2m', target: 60 },
    { duration: '2m', target: 80 },
    { duration: '1m', target: 0 },
  ],
};
