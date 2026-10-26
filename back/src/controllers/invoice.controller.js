const { stringify } = require('csv-stringify');
const invoiceService = require('../services/invoice.service');
const pdfService = require('../services/pdf.service');
const emailService = require('../services/email.service');
const { sequelize } = require('../models');

async function getAll(req, res, next) {
  try {
    const invoices = await invoiceService.findAll(req.user.id);
    res.json(invoices);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const invoice = await invoiceService.findById(req.params.id, req.user.id);
    res.json(invoice);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const invoice = await invoiceService.create(req.body, req.user.id);
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const invoice = await invoiceService.update(req.params.id, req.body, req.user.id);
    res.json(invoice);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    await invoiceService.remove(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function getPdf(req, res, next) {
  try {
    const { doc, invoiceNumber } = await pdfService.generateInvoicePdf(req.params.id, req.user.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
    doc.pipe(res);
  } catch (error) {
    next(error);
  }
}

async function sendEmail(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    await invoiceService.update(
      req.params.id,
      { status: 'sent', date: new Date() },
      req.user.id,
      transaction
    );

    const { doc, invoiceNumber } = await pdfService.generateInvoicePdf(
      req.params.id,
      req.user.id,
      transaction
    );
    const invoice = await invoiceService.findById(req.params.id, req.user.id, transaction);

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    await new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
    });

    const pdfBuffer = Buffer.concat(chunks);

    const data = await emailService.sendInvoiceEmail({
      to: invoice.Client.email,
      clientName: invoice.Client.name,
      invoiceNumber,
      pdfBuffer,
    });

    await transaction.commit();
    res.json({ message: 'Invoice sent successfully', emailId: data.id });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

async function exportCsv(req, res, next) {
  try {
    const invoices = await invoiceService.findAll(req.user.id);

    const rows = [];
    for (const inv of invoices) {
      const base = {
        invoice_id: inv.id,
        status: inv.status,
        client_name: inv.Client?.name ?? '',
        client_email: inv.Client?.email ?? '',
        issued_at: inv.issued_at ? new Date(inv.issued_at).toISOString().slice(0, 10) : '',
        created_at: inv.created_at ? new Date(inv.created_at).toISOString().slice(0, 10) : '',
        tva_rate: inv.tva_rate,
        total_ht: inv.total_ht,
        total_ttc: inv.total_ttc,
      };

      if (inv.InvoiceLines && inv.InvoiceLines.length > 0) {
        for (const line of inv.InvoiceLines) {
          rows.push({
            ...base,
            service: line.Service?.label ?? '',
            quantity: line.quantity,
            unit_price: line.unit_price,
            line_total: line.total,
          });
        }
      } else {
        rows.push({ ...base, service: '', quantity: '', unit_price: '', line_total: '' });
      }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"');

    stringify(rows, { header: true, delimiter: ';' }, (err, output) => {
      if (err) return next(err);
      res.send(output);
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove, getPdf, sendEmail, exportCsv };
