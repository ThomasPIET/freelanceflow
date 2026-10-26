const serviceService = require('../services/service.service');

async function getAll(req, res, next) {
  try {
    const services = await serviceService.findAll(req.user.id);
    res.json(services);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const service = await serviceService.findById(req.params.id, req.user.id);
    res.json(service);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const service = await serviceService.create(req.body, req.user.id);
    res.status(201).json(service);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const service = await serviceService.update(req.params.id, req.body, req.user.id);
    res.json(service);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    await serviceService.remove(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
