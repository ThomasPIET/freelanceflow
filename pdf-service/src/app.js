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
