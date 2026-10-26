const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  define: jest.fn(() => ({})),
  authenticate: jest.fn(),
}));

jest.mock('../models', () => {
  const Invoice = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };
  const InvoiceLine = {
    bulkCreate: jest.fn(),
    destroy: jest.fn(),
  };
  const Client = { findOne: jest.fn() };
  const Service = {};
  const User = {};
  return { Invoice, InvoiceLine, Client, Service, User };
});

global.fetch = jest.fn();
process.env.PDF_SERVICE_URL = 'http://pdf-service:3000';

const app = require('../app');
const { Invoice } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

const generateToken = (userId = 1) =>
  jwt.sign({ id: userId, email: 'test@test.com' }, JWT_SECRET, { expiresIn: '1h' });

const mockFullInvoice = {
  id: 1,
  user_id: 1,
  client_id: 1,
  status: 'draft',
  total_ht: 150,
  tva_rate: 20,
  total_ttc: 180,
  issued_at: '2026-01-15T00:00:00.000Z',
  User: {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@test.com',
    address_line1: '123 Rue Test',
    zip_code: '75000',
    city: 'Paris',
    country: 'France',
  },
  Client: {
    id: 1,
    name: 'Acme Corp',
    email: 'acme@test.com',
    company: 'Acme Inc',
    address_line1: '456 Avenue Client',
    zip_code: '69000',
    city: 'Lyon',
    country: 'France',
  },
  InvoiceLines: [
    {
      id: 1,
      invoice_id: 1,
      service_id: 1,
      quantity: 2,
      unit_price: 75,
      total: 150,
      Service: { id: 1, label: 'Dev Web' },
    },
  ],
};

const pdfResponse = () => ({
  ok: true,
  arrayBuffer: async () => Buffer.from('%PDF-1.3 fake'),
});

describe('GET /api/invoices/:id/pdf', () => {
  let token;

  beforeEach(() => {
    token = generateToken();
    jest.clearAllMocks();
  });

  const getPdf = (id = 1) =>
    request(app).get(`/api/invoices/${id}/pdf`).set('Authorization', `Bearer ${token}`);

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/invoices/1/pdf');
    expect(res.status).toBe(401);
  });

  it('should return 404 when invoice not found', async () => {
    Invoice.findOne.mockResolvedValue(null);

    const res = await getPdf(999);

    expect(res.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should return the PDF from pdf-service with correct headers', async () => {
    Invoice.findOne.mockResolvedValue(mockFullInvoice);
    fetch.mockResolvedValue(pdfResponse());

    const res = await getPdf();

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="INV-00001.pdf"');
  });

  it('should send the invoice data to pdf-service', async () => {
    Invoice.findOne.mockResolvedValue(mockFullInvoice);
    fetch.mockResolvedValue(pdfResponse());

    await getPdf();

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://pdf-service:3000/pdf/invoice');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.invoice_number).toBe('INV-00001');
    expect(body.issuer).toMatchObject({
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@test.com',
    });
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

    await getPdf();

    expect(JSON.parse(fetch.mock.calls[0][1].body).lines[0].label).toBe('Service #7');
  });

  it('should return 502 when pdf-service is unreachable', async () => {
    Invoice.findOne.mockResolvedValue(mockFullInvoice);
    fetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await getPdf();

    expect(res.status).toBe(502);
    expect(res.body.message).toBe('PDF service unavailable');
  });

  it('should return 502 when pdf-service answers an error', async () => {
    Invoice.findOne.mockResolvedValue(mockFullInvoice);
    fetch.mockResolvedValue({ ok: false, status: 500 });

    const res = await getPdf();

    expect(res.status).toBe(502);
  });
});
