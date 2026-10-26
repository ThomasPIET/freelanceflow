require('dotenv').config();
const bcrypt = require('bcrypt');
const sequelize = require('../src/config/database');
const User = require('../src/models/user.model');

const SALT_ROUNDS = 10;

async function ensureAdmin({ email, password }) {
  if (!email || !password) return 'skipped';

  const existing = await User.findOne({ where: { email } });
  if (!existing) {
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    await User.create({
      email,
      password_hash,
      first_name: 'Admin',
      last_name: 'FreelanceFlow',
      role: 'admin',
    });
    return 'created';
  }

  if (existing.role !== 'admin') {
    await existing.update({ role: 'admin' });
    return 'promoted';
  }

  return 'unchanged';
}

if (require.main === module) {
  ensureAdmin({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    .then((result) => {
      console.log(`create-admin: ${result}`);
      return sequelize.close();
    })
    .catch((error) => {
      console.error('create-admin failed:', error);
      process.exit(1);
    });
}

module.exports = { ensureAdmin };
