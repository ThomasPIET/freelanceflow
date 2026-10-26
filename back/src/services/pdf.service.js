const { Invoice, InvoiceLine, Client, Service, User } = require('../models');

const ISSUER_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'address_line1',
  'address_line2',
  'zip_code',
  'city',
  'country',
  'logo_data',
];
const CLIENT_FIELDS = [
  'name',
  'company',
  'email',
  'address_line1',
  'address_line2',
  'zip_code',
  'city',
  'country',
];
const INVOICE_FIELDS = ['issued_at', 'status', 'total_ht', 'total_ttc', 'tva_rate'];

const pick = (source, fields) =>
  Object.fromEntries(fields.map((field) => [field, source?.[field] ?? null]));

function serviceUnavailable() {
  const error = new Error('PDF service unavailable');
  error.status = 502;
  return error;
}

function buildPayload(invoice, invoiceNumber) {
  return {
    invoice_number: invoiceNumber,
    invoice: pick(invoice, INVOICE_FIELDS),
    issuer: pick(invoice.User, ISSUER_FIELDS),
    client: pick(invoice.Client, CLIENT_FIELDS),
    lines: (invoice.InvoiceLines || []).map((line) => ({
      label: line.Service ? line.Service.label : `Service #${line.service_id}`,
      quantity: line.quantity,
      unit_price: line.unit_price,
      total: line.total,
    })),
  };
}

async function generateInvoicePdf(invoiceId, userId, transaction) {
  const invoice = await Invoice.findOne({
    where: { id: invoiceId, user_id: userId },
    include: [
      { model: Client },
      { model: InvoiceLine, include: [{ model: Service }] },
      { model: User, attributes: ['id', ...ISSUER_FIELDS] },
    ],
    transaction,
  });

  if (!invoice) {
    const error = new Error('Invoice not found');
    error.status = 404;
    throw error;
  }

  const invoiceNumber = `INV-${String(invoice.id).padStart(5, '0')}`;

  let response;
  try {
    response = await fetch(`${process.env.PDF_SERVICE_URL}/pdf/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(invoice, invoiceNumber)),
    });
  } catch {
    throw serviceUnavailable();
  }

  if (!response.ok) throw serviceUnavailable();

  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, invoiceNumber };
}

module.exports = { generateInvoicePdf };
