const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

jest.mock('../config/database', () => ({
  define: jest.fn(() => ({})),
  authenticate: jest.fn(),
}));

jest.mock('../models/user.model', () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models', () => ({
  Invoice: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  InvoiceLine: { bulkCreate: jest.fn(), destroy: jest.fn() },
  Client: {},
  Service: {},
  User: {},
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const app = require('../app');
const User = require('../models/user.model');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

const generateToken = (userId = 1) =>
  jwt.sign({ id: userId, email: 'test@test.com' }, JWT_SECRET, { expiresIn: '1h' });

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /register ───────────────────────────────────
  describe('POST /api/auth/register', () => {
    const registerData = {
      email: 'new@test.com',
      password: 'password123',
      first_name: 'John',
      last_name: 'Doe',
      address_line1: '123 Main St',
      address_line2: 'Apt 4B',
      zip_code: '75001',
      city: 'Paris',
      country: 'France',
    };

    it('should register a new user', async () => {
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed_password');
      User.create.mockResolvedValue({
        id: 1,
        email: 'new@test.com',
        first_name: 'John',
        last_name: 'Doe',
      });

      const res = await request(app).post('/api/auth/register').send(registerData);

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('new@test.com');
      expect(res.body.first_name).toBe('John');
      expect(res.body).not.toHaveProperty('password');
      expect(User.create).toHaveBeenCalledWith({
        email: 'new@test.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Doe',
        address_line1: '123 Main St',
        address_line2: 'Apt 4B',
        zip_code: '75001',
        city: 'Paris',
        country: 'France',
      });
    });

    it('should return 409 if email already exists', async () => {
      User.findOne.mockResolvedValue({ id: 1, email: 'new@test.com' });

      const res = await request(app).post('/api/auth/register').send(registerData);

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Email already in use');
    });
  });

  // ── POST /login ──────────────────────────────────────
  describe('POST /api/auth/login', () => {
    const loginData = { email: 'test@test.com', password: 'password123' };

    it('should login and return token', async () => {
      User.findOne.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        password_hash: 'hashed_password',
      });
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app).post('/api/auth/login').send(loginData);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      const decoded = jwt.verify(res.body.token, JWT_SECRET);
      expect(decoded.id).toBe(1);
    });

    it('should return 401 with wrong email', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app).post('/api/auth/login').send(loginData);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should return 401 with wrong password', async () => {
      User.findOne.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        password_hash: 'hashed_password',
      });
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app).post('/api/auth/login').send(loginData);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });
  });

  // ── GET /me ──────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('should return current user', async () => {
      const token = generateToken();
      User.findByPk.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        first_name: 'John',
        last_name: 'Doe',
        address_line1: '123 Main St',
        zip_code: '75001',
        city: 'Paris',
        country: 'France',
        created_at: '2024-01-01',
      });

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('test@test.com');
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 404 if user not found', async () => {
      const token = generateToken(999);
      User.findByPk.mockResolvedValue(null);

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
