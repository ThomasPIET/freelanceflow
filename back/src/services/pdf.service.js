const PDFDocument = require('pdfkit');
const { Invoice, InvoiceLine, Client, Service, User } = require('../models');

async function generateInvoicePdf(invoiceId, userId, transaction) {
  const invoice = await Invoice.findOne({
    where: { id: invoiceId, user_id: userId },
    include: [
      { model: Client },
      { model: InvoiceLine, include: [{ model: Service }] },
      {
        model: User,
        attributes: [
          'id',
          'first_name',
          'last_name',
          'email',
          'address_line1',
          'address_line2',
          'zip_code',
          'city',
          'country',
          'logo_data',
        ],
      },
    ],
    transaction,
  });

  if (!invoice) {
    const error = new Error('Invoice not found');
    error.status = 404;
    throw error;
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const user = invoice.User;
  const client = invoice.Client;
  const lines = invoice.InvoiceLines || [];

  // --- En-tête : logo à gauche, titre FACTURE + infos à droite ---
  const invoiceNumber = `INV-${String(invoice.id).padStart(5, '0')}`;
  const issuedDate = invoice.issued_at
    ? new Date(invoice.issued_at).toLocaleDateString('fr-FR')
    : '-';

  if (user.logo_data) {
    try {
      const base64 = user.logo_data.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      doc.image(buffer, 50, 45, { fit: [120, 60] });
    } catch {
      // données corrompues ou format non supporté, on passe
    }
  }

  doc.fontSize(22).font('Helvetica-Bold').text('FACTURE', 350, 45, { width: 200, align: 'right' });
  doc.fontSize(10).font('Helvetica');
  doc.text(`N° : ${invoiceNumber}`, 350, 75, { width: 200, align: 'right' });
  doc.text(`Date : ${issuedDate}`, 350, 89, { width: 200, align: 'right' });
  doc.text(`Statut : ${invoice.status}`, 350, 103, { width: 200, align: 'right' });

  // --- Section EMETTEUR (gauche) / DESTINATAIRE (droite) ---
  const partiesY = 170;
  const leftX = 50;
  const colWidth = 230;
  const rightX = 545 - colWidth;

  const rightOpts = { width: colWidth, align: 'right' };

  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('ÉMETTEUR', leftX, partiesY, { width: colWidth });
  doc.text('DESTINATAIRE', rightX, partiesY, rightOpts);

  doc.fontSize(10).font('Helvetica');
  let emetteurY = partiesY + 24;
  doc.text(`${user.first_name} ${user.last_name}`, leftX, emetteurY, { width: colWidth });
  emetteurY += 14;
  doc.text(user.email, leftX, emetteurY, { width: colWidth });
  emetteurY += 14;
  if (user.address_line1) {
    doc.text(user.address_line1, leftX, emetteurY, { width: colWidth });
    emetteurY += 14;
  }
  if (user.address_line2) {
    doc.text(user.address_line2, leftX, emetteurY, { width: colWidth });
    emetteurY += 14;
  }
  if (user.zip_code || user.city) {
    doc.text(`${user.zip_code ?? ''} ${user.city ?? ''}`.trim(), leftX, emetteurY, {
      width: colWidth,
    });
    emetteurY += 14;
  }
  if (user.country) {
    doc.text(user.country, leftX, emetteurY, { width: colWidth });
  }

  let destinataireY = partiesY + 24;
  doc.text(client.name, rightX, destinataireY, rightOpts);
  destinataireY += 14;
  if (client.company) {
    doc.text(client.company, rightX, destinataireY, rightOpts);
    destinataireY += 14;
  }
  if (client.address_line1) {
    doc.text(client.address_line1, rightX, destinataireY, rightOpts);
    destinataireY += 14;
  }
  if (client.address_line2) {
    doc.text(client.address_line2, rightX, destinataireY, rightOpts);
    destinataireY += 14;
  }
  if (client.zip_code || client.city) {
    doc.text(
      `${client.zip_code ?? ''} ${client.city ?? ''}`.trim(),
      rightX,
      destinataireY,
      rightOpts
    );
    destinataireY += 14;
  }
  if (client.country) {
    doc.text(client.country, rightX, destinataireY, rightOpts);
    destinataireY += 14;
  }
  doc.text(client.email, rightX, destinataireY, rightOpts);

  const tableTop = Math.max(emetteurY, destinataireY) + 60;
  const col = { label: 50, qty: 280, price: 360, total: 460 };

  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Service', col.label, tableTop);
  doc.text('Qty', col.qty, tableTop);
  doc.text('Prix unit.', col.price, tableTop);
  doc.text('Total', col.total, tableTop);

  doc
    .moveTo(50, tableTop + 15)
    .lineTo(550, tableTop + 15)
    .stroke();

  doc.font('Helvetica');
  let y = tableTop + 25;

  for (const line of lines) {
    const label = line.Service ? line.Service.label : `Service #${line.service_id}`;
    doc.text(label, col.label, y, { width: 220 });
    doc.text(String(parseFloat(line.quantity)), col.qty, y);
    doc.text(`${parseFloat(line.unit_price).toFixed(2)} EUR`, col.price, y);
    doc.text(`${parseFloat(line.total).toFixed(2)} EUR`, col.total, y);
    y += 20;
  }

  doc
    .moveTo(50, y + 5)
    .lineTo(550, y + 5)
    .stroke();

  const tvaAmount = (parseFloat(invoice.total_ttc) - parseFloat(invoice.total_ht)).toFixed(2);

  y += 20;
  doc.font('Helvetica-Bold');
  doc.text('Total HT:', col.price, y);
  doc.text(`${parseFloat(invoice.total_ht).toFixed(2)} EUR`, col.total, y);

  y += 20;
  doc.font('Helvetica');
  doc.text(`TVA (${parseFloat(invoice.tva_rate)}%):`, col.price, y);
  doc.text(`${tvaAmount} EUR`, col.total, y);

  y += 20;
  doc.font('Helvetica-Bold');
  doc.text('Total TTC:', col.price, y);
  doc.text(`${parseFloat(invoice.total_ttc).toFixed(2)} EUR`, col.total, y);

  doc.end();
  return { doc, invoiceNumber };
}

module.exports = { generateInvoicePdf };
