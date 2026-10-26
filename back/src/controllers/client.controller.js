const { stringify } = require('csv-stringify');
const clientService = require('../services/client.service');

async function getAll(req, res, next) {
  try {
    const clients = await clientService.findAll(req.user.id);
    res.json(clients);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const client = await clientService.findById(req.params.id, req.user.id);
    res.json(client);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const client = await clientService.create(req.body, req.user.id);
    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const client = await clientService.update(req.params.id, req.body, req.user.id);
    res.json(client);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    await clientService.remove(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function exportCsv(req, res, next) {
  try {
    const clients = await clientService.findAll(req.user.id);

    const rows = clients.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      company: c.company ?? '',
      address_line1: c.address_line1 ?? '',
      address_line2: c.address_line2 ?? '',
      zip_code: c.zip_code ?? '',
      city: c.city ?? '',
      country: c.country ?? '',
      created_at: c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : '',
    }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');

    stringify(rows, { header: true, delimiter: ';' }, (err, output) => {
      if (err) return next(err);
      res.send(output);
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove, exportCsv };
