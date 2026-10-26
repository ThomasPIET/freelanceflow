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

jest.mock('pdfkit', () => {
  const { PassThrough } = require('stream');
  return jest.fn().mockImplementation(() => {
    const stream = new PassThrough();
    stream.fontSize = jest.fn().mockReturnValue(stream);
    stream.text = jest.fn().mockReturnValue(stream);
    stream.moveDown = jest.fn().mockReturnValue(stream);
    stream.font = jest.fn().mockReturnValue(stream);
    stream.moveTo = jest.fn().mockReturnValue(stream);
    stream.lineTo = jest.fn().mockReturnValue(stream);
    stream.stroke = jest.fn().mockReturnValue(stream);
    const originalEnd = stream.end.bind(stream);
    stream.end = jest.fn(() => originalEnd());
    return stream;
  });
});

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

describe('GET /api/invoices/:id/pdf', () => {
  let token;

  beforeEach(() => {
    token = generateToken();
    jest.clearAllMocks();
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/invoices/1/pdf');
    expect(res.status).toBe(401);
  });

  it('should return 404 when invoice not found', async () => {
    Invoice.findOne.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/invoices/999/pdf')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return PDF with correct headers', async () => {
    Invoice.findOne.mockResolvedValue(mockFullInvoice);

    const res = await request(app)
      .get('/api/invoices/1/pdf')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="INV-00001.pdf"');
  });

  it('should generate PDF with invoice data', async () => {
    Invoice.findOne.mockResolvedValue(mockFullInvoice);
    const PDFDocument = require('pdfkit');

    const res = await request(app)
      .get('/api/invoices/1/pdf')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(PDFDocument).toHaveBeenCalled();

    const mockDoc = PDFDocument.mock.results[0].value;
    expect(mockDoc.text).toHaveBeenCalledWith('FACTURE', 350, 45, { width: 200, align: 'right' });
    expect(mockDoc.text).toHaveBeenCalledWith('ÉMETTEUR', 50, expect.any(Number), { width: 230 });
    expect(mockDoc.text).toHaveBeenCalledWith(
      'DESTINATAIRE',
      expect.any(Number),
      expect.any(Number),
      { width: 230, align: 'right' }
    );
    expect(mockDoc.text).toHaveBeenCalledWith('John Doe', 50, expect.any(Number), { width: 230 });
    expect(mockDoc.text).toHaveBeenCalledWith('john@test.com', 50, expect.any(Number), {
      width: 230,
    });
    expect(mockDoc.text).toHaveBeenCalledWith('Acme Corp', expect.any(Number), expect.any(Number), {
      width: 230,
      align: 'right',
    });
    expect(mockDoc.text).toHaveBeenCalledWith('Acme Inc', expect.any(Number), expect.any(Number), {
      width: 230,
      align: 'right',
    });
    expect(mockDoc.text).toHaveBeenCalledWith('Dev Web', expect.any(Number), expect.any(Number), {
      width: 220,
    });
  });

  it('should include totals in PDF', async () => {
    Invoice.findOne.mockResolvedValue(mockFullInvoice);
    const PDFDocument = require('pdfkit');

    await request(app).get('/api/invoices/1/pdf').set('Authorization', `Bearer ${token}`);

    const mockDoc = PDFDocument.mock.results[0].value;
    expect(mockDoc.text).toHaveBeenCalledWith('150.00 EUR', expect.any(Number), expect.any(Number));
    expect(mockDoc.text).toHaveBeenCalledWith('30.00 EUR', expect.any(Number), expect.any(Number));
    expect(mockDoc.text).toHaveBeenCalledWith('180.00 EUR', expect.any(Number), expect.any(Number));
  });

  it('should handle invoice without issued date', async () => {
    const invoiceNoDate = { ...mockFullInvoice, issued_at: null };
    Invoice.findOne.mockResolvedValue(invoiceNoDate);

    const res = await request(app)
      .get('/api/invoices/1/pdf')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should handle invoice with multiple lines', async () => {
    const multiLineInvoice = {
      ...mockFullInvoice,
      total_ht: 450,
      total_ttc: 540,
      InvoiceLines: [
        {
          id: 1,
          service_id: 1,
          quantity: 2,
          unit_price: 75,
          total: 150,
          Service: { id: 1, label: 'Dev Web' },
        },
        {
          id: 2,
          service_id: 2,
          quantity: 3,
          unit_price: 100,
          total: 300,
          Service: { id: 2, label: 'Design' },
        },
      ],
    };
    Invoice.findOne.mockResolvedValue(multiLineInvoice);

    const res = await request(app)
      .get('/api/invoices/1/pdf')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
