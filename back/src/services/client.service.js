const Client = require('../models/client.model');
const cache = require('../config/cache');

async function findAll(userId) {
  const key = `clients_${userId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const clients = await Client.findAll({ where: { user_id: userId } });
  const plain = clients.map((c) => (typeof c.toJSON === 'function' ? c.toJSON() : c));
  cache.set(key, plain);
  return plain;
}

async function findById(id, userId) {
  const client = await Client.findOne({ where: { id, user_id: userId } });
  if (!client) {
    const error = new Error('Client not found');
    error.status = 404;
    throw error;
  }
  return client;
}

async function create(data, userId) {
  const client = await Client.create({ ...data, user_id: userId });
  cache.del(`clients_${userId}`);
  return client;
}

async function update(id, data, userId) {
  const client = await findById(id, userId);
  const updated = await client.update(data);
  cache.del(`clients_${userId}`);
  return updated;
}

async function remove(id, userId) {
  const client = await findById(id, userId);
  await client.destroy();
  cache.del(`clients_${userId}`);
}

module.exports = { findAll, findById, create, update, remove };
