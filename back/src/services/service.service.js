const Service = require('../models/service.model');
const cache = require('../config/cache');

async function findAll(userId) {
  const key = `services_${userId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const services = await Service.findAll({ where: { user_id: userId } });
  const plain = services.map((s) => (typeof s.toJSON === 'function' ? s.toJSON() : s));
  cache.set(key, plain);
  return plain;
}

async function findById(id, userId) {
  const service = await Service.findOne({ where: { id, user_id: userId } });
  if (!service) {
    const error = new Error('Service not found');
    error.status = 404;
    throw error;
  }
  return service;
}

async function create(data, userId) {
  const service = await Service.create({ ...data, user_id: userId });
  cache.del(`services_${userId}`);
  return service;
}

async function update(id, data, userId) {
  const service = await findById(id, userId);
  const updated = await service.update(data);
  cache.del(`services_${userId}`);
  return updated;
}

async function remove(id, userId) {
  const service = await findById(id, userId);
  await service.destroy();
  cache.del(`services_${userId}`);
}

module.exports = { findAll, findById, create, update, remove };
