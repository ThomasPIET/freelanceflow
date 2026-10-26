const request = require('supertest');

jest.mock('../config/database', () => ({
  define: jest.fn(() => ({})),
  authenticate: jest.fn(),
}));

jest.mock('../models', () => ({
  Invoice: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  InvoiceLine: { bulkCreate: jest.fn(), destroy: jest.fn() },
  Client: {},
  Service: {},
  User: {},
}));

const app = require('../app');

describe('GET /health', () => {
  it('should return status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
