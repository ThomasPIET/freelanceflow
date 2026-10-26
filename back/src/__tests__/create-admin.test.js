jest.mock('../config/database', () => ({ define: jest.fn(() => ({})), close: jest.fn() }));
jest.mock('../models/user.model', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('bcrypt', () => ({ hash: jest.fn() }));

const bcrypt = require('bcrypt');
const User = require('../models/user.model');
const { ensureAdmin } = require('../../scripts/create-admin');

describe('ensureAdmin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('skips when email or password is missing', async () => {
    expect(await ensureAdmin({ email: '', password: 'x' })).toBe('skipped');
    expect(await ensureAdmin({ email: 'a@b.c', password: undefined })).toBe('skipped');
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('creates the admin when the email is unknown', async () => {
    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed');

    expect(await ensureAdmin({ email: 'admin@test.com', password: 'secret' })).toBe('created');
    expect(User.create).toHaveBeenCalledWith({
      email: 'admin@test.com',
      password_hash: 'hashed',
      first_name: 'Admin',
      last_name: 'FreelanceFlow',
      role: 'admin',
    });
  });

  it('promotes an existing standard account', async () => {
    const existing = { role: 'standard', update: jest.fn() };
    User.findOne.mockResolvedValue(existing);

    expect(await ensureAdmin({ email: 'admin@test.com', password: 'secret' })).toBe('promoted');
    expect(existing.update).toHaveBeenCalledWith({ role: 'admin' });
  });

  it('does nothing when the account is already admin', async () => {
    const existing = { role: 'admin', update: jest.fn() };
    User.findOne.mockResolvedValue(existing);

    expect(await ensureAdmin({ email: 'admin@test.com', password: 'secret' })).toBe('unchanged');
    expect(existing.update).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });
});
