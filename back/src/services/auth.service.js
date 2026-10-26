const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const SALT_ROUNDS = 10;

async function register({
  email,
  password,
  first_name,
  last_name,
  address_line1,
  address_line2,
  zip_code,
  city,
  country,
}) {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    const error = new Error('Email already in use');
    error.status = 409;
    throw error;
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    email,
    password_hash,
    first_name,
    last_name,
    address_line1,
    address_line2,
    zip_code,
    city,
    country,
  });

  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  };
}

async function login({ email, password }) {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });

  return { token };
}

async function getMe(userId) {
  const user = await User.findByPk(userId, {
    attributes: [
      'id',
      'email',
      'first_name',
      'last_name',
      'address_line1',
      'address_line2',
      'zip_code',
      'city',
      'country',
      'logo_data',
      'created_at',
    ],
  });

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  return user;
}

async function updateMe(
  userId,
  { email, first_name, last_name, address_line1, address_line2, zip_code, city, country }
) {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (email && email !== user.email) {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      const error = new Error('Email already in use');
      error.status = 409;
      throw error;
    }
  }

  await user.update({
    email,
    first_name,
    last_name,
    address_line1,
    address_line2,
    zip_code,
    city,
    country,
  });

  return user;
}

module.exports = { register, login, getMe, updateMe };
