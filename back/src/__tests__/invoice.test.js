const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  define: jest.fn(() => ({})),
  authenticate: jest.fn(),
}));

jest.mock('../config/cache', () => ({
  get: jest.fn().mockReturnValue(null),
  set: jest.fn(),
  del: jest.fn(),
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

const app = require('../app');
const { Invoice, InvoiceLine } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

const generateToken = (userId = 1) =>
  jwt.sign({ id: userId, email: 'test@test.com' }, JWT_SECRET, { expiresIn: '1h' });

const mockLines = [
  {
    id: 1,
    invoice_id: 1,
    service_id: 1,
    quantity: 2,
    unit_price: 75,
    total: 150,
    Service: { id: 1, label: 'Dev Web' },
  },
];

const mockInvoice = {
  id: 1,
  user_id: 1,
  client_id: 1,
  status: 'draft',
  total_ht: 150,
  tva_rate: 20,
  total_ttc: 180,
  Client: { id: 1, name: 'Acme', email: 'acme@test.com' },
  InvoiceLines: mockLines,
  update: jest.fn(),
  destroy: jest.fn(),
};

describe('Invoice Routes', () => {
  let token;

  beforeEach(() => {
    token = generateToken();
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/invoices');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/invoices')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/invoices', () => {
    it('should return all invoices for user', async () => {
      Invoice.findAll.mockResolvedValue([mockInvoice]);

      const res = await request(app).get('/api/invoices').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].total_ht).toBe(150);
    });

    it('should return empty array when no invoices', async () => {
      Invoice.findAll.mockResolvedValue([]);

      const res = await request(app).get('/api/invoices').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('should return invoice by id', async () => {
      Invoice.findOne.mockResolvedValue(mockInvoice);

      const res = await request(app).get('/api/invoices/1').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('draft');
    });

    it('should return 404 when invoice not found', async () => {
      Invoice.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/invoices/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/invoices', () => {
    const newInvoiceData = {
      client_id: 1,
      date: '2026-04-13T11:14:52.333Z',
      lines: [{ service_id: 1, quantity: '2', unit_price: '75.00' }],
    };

    it('should create an invoice with lines (string values parsed)', async () => {
      const created = {
        id: 2,
        user_id: 1,
        client_id: 1,
        tva_rate: 20,
        total_ht: 150,
        total_ttc: 180,
      };
      Invoice.create.mockResolvedValue(created);
      InvoiceLine.bulkCreate.mockResolvedValue([]);
      Invoice.findOne.mockResolvedValue({ ...mockInvoice, id: 2 });

      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(newInvoiceData);

      expect(res.status).toBe(201);
      expect(Invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 1,
          client_id: 1,
          tva_rate: 20,
          total_ht: 150,
          total_ttc: 180,
          issued_at: '2026-04-13T11:14:52.333Z',
        })
      );
      expect(InvoiceLine.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ service_id: 1, quantity: 2, unit_price: 75, total: 150 }),
        ])
      );
    });

    it('should create an invoice without lines', async () => {
      const created = { id: 3, user_id: 1, client_id: 1, tva_rate: 20, total_ht: 0, total_ttc: 0 };
      Invoice.create.mockResolvedValue(created);
      Invoice.findOne.mockResolvedValue({
        ...mockInvoice,
        id: 3,
        total_ht: 0,
        total_ttc: 0,
        InvoiceLines: [],
      });

      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({ client_id: 1 });

      expect(res.status).toBe(201);
      expect(InvoiceLine.bulkCreate).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/invoices/:id', () => {
    it('should update invoice status', async () => {
      const updated = { ...mockInvoice, status: 'sent' };
      Invoice.findOne.mockResolvedValue(mockInvoice);
      mockInvoice.update.mockResolvedValue(updated);
      // findById called again after update
      Invoice.findOne.mockResolvedValueOnce(mockInvoice).mockResolvedValueOnce(updated);

      const res = await request(app)
        .put('/api/invoices/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'sent' });

      expect(res.status).toBe(200);
      expect(mockInvoice.update).toHaveBeenCalledWith(
        { status: 'sent' },
        { transaction: undefined }
      );
    });

    it('should update invoice with new lines', async () => {
      Invoice.findOne.mockResolvedValue(mockInvoice);
      InvoiceLine.destroy.mockResolvedValue(1);
      InvoiceLine.bulkCreate.mockResolvedValue([]);
      mockInvoice.update.mockResolvedValue(mockInvoice);

      const res = await request(app)
        .put('/api/invoices/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ lines: [{ service_id: 2, quantity: '3', unit_price: '100.00' }] });

      expect(res.status).toBe(200);
      expect(InvoiceLine.destroy).toHaveBeenCalledWith({ where: { invoice_id: '1' } });
      expect(InvoiceLine.bulkCreate).toHaveBeenCalled();
    });

    it('should return 404 when updating non-existent invoice', async () => {
      Invoice.findOne.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/invoices/999')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'sent' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/invoices/:id', () => {
    it('should delete an invoice', async () => {
      Invoice.findOne.mockResolvedValue(mockInvoice);
      mockInvoice.destroy.mockResolvedValue();

      const res = await request(app)
        .delete('/api/invoices/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(mockInvoice.destroy).toHaveBeenCalled();
    });

    it('should return 404 when deleting non-existent invoice', async () => {
      Invoice.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/invoices/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
