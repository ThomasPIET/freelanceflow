const { Invoice, InvoiceLine, Client, Service } = require('../models');
const cache = require('../config/cache');

function parseLine(l) {
  return {
    service_id: l.service_id,
    quantity: parseFloat(l.quantity),
    unit_price: parseFloat(l.unit_price),
  };
}

function computeTotals(lines, tvaRate) {
  const totalHt = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const totalTtc = totalHt * (1 + tvaRate / 100);
  return { total_ht: +totalHt.toFixed(2), total_ttc: +totalTtc.toFixed(2) };
}

async function findAll(userId) {
  const key = `invoices_${userId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const invoices = await Invoice.findAll({
    where: { user_id: userId },
    include: [
      { model: Client, attributes: ['id', 'name', 'email'] },
      { model: InvoiceLine, include: [{ model: Service, attributes: ['id', 'label'] }] },
    ],
    order: [['created_at', 'DESC']],
  });
  const plain = invoices.map((i) => (typeof i.toJSON === 'function' ? i.toJSON() : i));
  cache.set(key, plain);
  return plain;
}

async function findById(id, userId, transaction) {
  const invoice = await Invoice.findOne({
    where: { id, user_id: userId },
    include: [
      { model: Client, attributes: ['id', 'name', 'email'] },
      { model: InvoiceLine, include: [{ model: Service, attributes: ['id', 'label'] }] },
    ],
    transaction,
  });
  if (!invoice) {
    const error = new Error('Invoice not found');
    error.status = 404;
    throw error;
  }
  return invoice;
}

async function create(data, userId) {
  const { client_id, tva_rate = 20, date, status, lines = [] } = data;

  const parsed = lines.map(parseLine);
  const totals = computeTotals(parsed, tva_rate);

  const invoice = await Invoice.create({
    user_id: userId,
    client_id,
    tva_rate,
    issued_at: date || null,
    ...(status && { status }),
    ...totals,
  });

  if (parsed.length) {
    const invoiceLines = parsed.map((l) => ({
      invoice_id: invoice.id,
      service_id: l.service_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
      total: +(l.quantity * l.unit_price).toFixed(2),
    }));
    await InvoiceLine.bulkCreate(invoiceLines);
  }

  cache.del(`invoices_${userId}`);
  return findById(invoice.id, userId);
}

async function update(id, data, userId, transaction) {
  const invoice = await findById(id, userId);

  const { lines, date, totals: _totals, ...fields } = data;

  if (date !== undefined) {
    fields.issued_at = date || null;
  }

  if (lines) {
    await InvoiceLine.destroy({ where: { invoice_id: id }, transaction });

    const parsed = lines.map(parseLine);
    const tvaRate = fields.tva_rate ?? invoice.tva_rate;
    const computed = computeTotals(parsed, tvaRate);
    Object.assign(fields, computed);

    const invoiceLines = parsed.map((l) => ({
      invoice_id: id,
      service_id: l.service_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
      total: +(l.quantity * l.unit_price).toFixed(2),
    }));
    await InvoiceLine.bulkCreate(invoiceLines, { transaction });
  }

  await invoice.update(fields, { transaction });
  cache.del(`invoices_${userId}`);
  return findById(id, userId);
}

async function remove(id, userId) {
  const invoice = await findById(id, userId);
  await invoice.destroy();
  cache.del(`invoices_${userId}`);
}

module.exports = { findAll, findById, create, update, remove };
