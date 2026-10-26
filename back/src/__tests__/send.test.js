const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/database', () => ({ define: jest.fn(() => ({})), authenticate: jest.fn() }));

const mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
jest.mock('../models', () => ({
  sequelize: { transaction: jest.fn(async () => mockTransaction) },
  Invoice: {},
  InvoiceLine: {},
  Client: {},
  Service: {},
  User: {},
}));
jest.mock('../services/invoice.service', () => ({ update: jest.fn(), findById: jest.fn() }));
jest.mock('../services/pdf.service', () => ({ generateInvoicePdf: jest.fn() }));
jest.mock('../services/email.service', () => ({ sendInvoiceEmail: jest.fn() }));

const app = require('../app');
const invoiceService = require('../services/invoice.service');
const pdfService = require('../services/pdf.service');
const emailService = require('../services/email.service');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const token = jwt.sign({ id: 1, email: 'test@test.com' }, process.env.JWT_SECRET);

const sendInvoice = () =>
  request(app).post('/api/invoices/1/send').set('Authorization', `Bearer ${token}`);

describe('POST /api/invoices/:id/send', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invoiceService.update.mockResolvedValue({});
    invoiceService.findById.mockResolvedValue({
      Client: { email: 'acme@test.com', name: 'Acme' },
    });
    pdfService.generateInvoicePdf.mockResolvedValue({
      buffer: Buffer.from('%PDF'),
      invoiceNumber: 'INV-00001',
    });
  });

  it('sends the PDF by email and commits', async () => {
    emailService.sendInvoiceEmail.mockResolvedValue({ id: '<abc@mailpit>' });

    const res = await sendInvoice();

    expect(res.status).toBe(200);
    expect(res.body.emailId).toBe('<abc@mailpit>');
    expect(emailService.sendInvoiceEmail).toHaveBeenCalledWith({
      to: 'acme@test.com',
      clientName: 'Acme',
      invoiceNumber: 'INV-00001',
      pdfBuffer: Buffer.from('%PDF'),
    });
    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
  });

  it('rolls back the status change when the email fails', async () => {
    emailService.sendInvoiceEmail.mockRejectedValue(
      Object.assign(new Error('Failed to send email: refused'), { status: 502 })
    );

    const res = await sendInvoice();

    expect(res.status).toBe(502);
    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it('rolls back when pdf-service is unavailable', async () => {
    pdfService.generateInvoicePdf.mockRejectedValue(
      Object.assign(new Error('PDF service unavailable'), { status: 502 })
    );

    const res = await sendInvoice();

    expect(res.status).toBe(502);
    expect(emailService.sendInvoiceEmail).not.toHaveBeenCalled();
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });
});
