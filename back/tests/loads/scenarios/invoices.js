/**
 * Invoices load scenario — tests the two heaviest invoice routes:
 *   GET /api/invoices         (list query filtered by user)
 *   GET /api/invoices/:id/pdf (pdfkit + complex JOIN: Invoice + Client + InvoiceLines + Services + User)
 *
 * Flow per VU iteration:
 *   1. Login to get a JWT (also exercises bcrypt on each VU startup)
 *   2. GET /api/invoices — list
 *   3. GET /api/invoices/:id/pdf — generate PDF for a random invoice
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';
import { loadOptions } from '../config/options.js';
import { getToken, BASE_URL } from '../helpers/auth.js';

export const options = loadOptions;

const users = new SharedArray('users', function () {
  return JSON.parse(open('../config/users.json'));
});

const invoiceListSuccess = new Counter('invoice_list_success');
const pdfSuccess = new Counter('invoice_pdf_success');

export default function () {
  const user = users[__VU % users.length];

  // Each VU logs in once per iteration — intentional: exercises the auth path
  // and ensures the token is always fresh for long stress runs
  const token = getToken(user.email, user.password);

  if (!token) {
    // Login failed — skip this iteration, the check in getToken already counted the failure
    return;
  }

  const authHeaders = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };

  // --- LIST INVOICES ---
  group('invoices', function () {
    const listRes = http.get(`${BASE_URL}/api/invoices`, authHeaders);

    const listOk = check(listRes, {
      'invoices list: status 200': (r) => r.status === 200,
      'invoices list: is array': (r) => {
        try {
          return Array.isArray(r.json());
        } catch {
          return false;
        }
      },
    });

    if (listOk) invoiceListSuccess.add(1);

    sleep(Math.random() + 0.5);
  });

  // --- PDF GENERATION ---
  group('pdf', function () {
    // Pick a random invoice from the seeded data for this user
    const invoiceIds = user.invoice_ids;
    const invoiceId = invoiceIds[Math.floor(Math.random() * invoiceIds.length)];

    const pdfRes = http.get(`${BASE_URL}/api/invoices/${invoiceId}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      // Tell k6 to treat the response as binary (PDF bytes)
      responseType: 'binary',
    });

    const pdfOk = check(pdfRes, {
      'pdf: status 200': (r) => r.status === 200,
      'pdf: content-type is pdf': (r) =>
        r.headers['Content-Type'] !== undefined &&
        r.headers['Content-Type'].includes('application/pdf'),
      'pdf: body not empty': (r) => r.body !== null && r.body.byteLength > 0,
    });

    if (pdfOk) pdfSuccess.add(1);

    // PDF is slow — give more breathing room between requests
    sleep(Math.random() * 2 + 1);
  });
}
