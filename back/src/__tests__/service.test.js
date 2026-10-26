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

jest.mock('../models/service.model', () => ({
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
const Service = require('../models/service.model');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

const generateToken = (userId = 1) =>
  jwt.sign({ id: userId, email: 'test@test.com' }, JWT_SECRET, { expiresIn: '1h' });

const mockService = {
  id: 1,
  user_id: 1,
  label: 'Développement Web',
  hourly_rate: 75.0,
  update: jest.fn(),
  destroy: jest.fn(),
};

describe('Service Routes', () => {
  let token;

  beforeEach(() => {
    token = generateToken();
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/services');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/services')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/services', () => {
    it('should return all services for user', async () => {
      Service.findAll.mockResolvedValue([mockService]);

      const res = await request(app).get('/api/services').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(Service.findAll).toHaveBeenCalledWith({ where: { user_id: 1 } });
    });

    it('should return empty array when no services', async () => {
      Service.findAll.mockResolvedValue([]);

      const res = await request(app).get('/api/services').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/services/:id', () => {
    it('should return service by id', async () => {
      Service.findOne.mockResolvedValue(mockService);

      const res = await request(app).get('/api/services/1').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.label).toBe('Développement Web');
      expect(Service.findOne).toHaveBeenCalledWith({ where: { id: '1', user_id: 1 } });
    });

    it('should return 404 when service not found', async () => {
      Service.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/services/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/services', () => {
    const newService = {
      label: 'Design UX',
      hourly_rate: 90.0,
    };

    it('should create a service', async () => {
      Service.create.mockResolvedValue({ id: 2, user_id: 1, ...newService });

      const res = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${token}`)
        .send(newService);

      expect(res.status).toBe(201);
      expect(res.body.label).toBe('Design UX');
      expect(Service.create).toHaveBeenCalledWith({ ...newService, user_id: 1 });
    });
  });

  describe('PUT /api/services/:id', () => {
    it('should update a service', async () => {
      const updated = { ...mockService, label: 'Dev Fullstack' };
      mockService.update.mockResolvedValue(updated);
      Service.findOne.mockResolvedValue(mockService);

      const res = await request(app)
        .put('/api/services/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ label: 'Dev Fullstack' });

      expect(res.status).toBe(200);
      expect(mockService.update).toHaveBeenCalledWith({ label: 'Dev Fullstack' });
    });

    it('should return 404 when updating non-existent service', async () => {
      Service.findOne.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/services/999')
        .set('Authorization', `Bearer ${token}`)
        .send({ label: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/services/:id', () => {
    it('should delete a service', async () => {
      Service.findOne.mockResolvedValue(mockService);
      mockService.destroy.mockResolvedValue();

      const res = await request(app)
        .delete('/api/services/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(mockService.destroy).toHaveBeenCalled();
    });

    it('should return 404 when deleting non-existent service', async () => {
      Service.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/services/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
