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

jest.mock('../models/client.model', () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models', () => ({
  Invoice: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  InvoiceLine: { bulkCreate: jest.fn(), destroy: jest.fn() },
  Client: {},
  Service: {},
  User: {},
}));

const app = require('../app');
const Client = require('../models/client.model');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

const generateToken = (userId = 1) =>
  jwt.sign({ id: userId, email: 'test@test.com' }, JWT_SECRET, { expiresIn: '1h' });

const mockClient = {
  id: 1,
  user_id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  company: 'ACME',
  address_line1: '123 Main St',
  address_line2: 'Apt 4B',
  zip_code: '75001',
  city: 'Paris',
  country: 'France',
  update: jest.fn(),
  destroy: jest.fn(),
};

describe('Client Routes', () => {
  let token;

  beforeEach(() => {
    token = generateToken();
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/clients');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/clients', () => {
    it('should return all clients for user', async () => {
      Client.findAll.mockResolvedValue([mockClient]);

      const res = await request(app).get('/api/clients').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(Client.findAll).toHaveBeenCalledWith({ where: { user_id: 1 } });
    });

    it('should return empty array when no clients', async () => {
      Client.findAll.mockResolvedValue([]);

      const res = await request(app).get('/api/clients').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/clients/:id', () => {
    it('should return client by id', async () => {
      Client.findOne.mockResolvedValue(mockClient);

      const res = await request(app).get('/api/clients/1').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('John Doe');
      expect(Client.findOne).toHaveBeenCalledWith({ where: { id: '1', user_id: 1 } });
    });

    it('should return 404 when client not found', async () => {
      Client.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/clients/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/clients', () => {
    const newClient = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      company: 'Corp',
      address: '456 Elm St',
    };

    it('should create a client', async () => {
      Client.create.mockResolvedValue({ id: 2, user_id: 1, ...newClient });

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${token}`)
        .send(newClient);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Jane Doe');
      expect(Client.create).toHaveBeenCalledWith({ ...newClient, user_id: 1 });
    });
  });

  describe('PUT /api/clients/:id', () => {
    it('should update a client', async () => {
      const updated = { ...mockClient, name: 'John Updated' };
      mockClient.update.mockResolvedValue(updated);
      Client.findOne.mockResolvedValue(mockClient);

      const res = await request(app)
        .put('/api/clients/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'John Updated' });

      expect(res.status).toBe(200);
      expect(mockClient.update).toHaveBeenCalledWith({ name: 'John Updated' });
    });

    it('should return 404 when updating non-existent client', async () => {
      Client.findOne.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/clients/999')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('should delete a client', async () => {
      Client.findOne.mockResolvedValue(mockClient);
      mockClient.destroy.mockResolvedValue();

      const res = await request(app)
        .delete('/api/clients/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(mockClient.destroy).toHaveBeenCalled();
    });

    it('should return 404 when deleting non-existent client', async () => {
      Client.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/clients/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
