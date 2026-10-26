const nodemailer = require('nodemailer');

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

async function sendInvoiceEmail({ to, clientName, invoiceNumber, pdfBuffer }) {
  const from = process.env.MAIL_FROM || 'factures@freelanceflow.local';

  try {
    const info = await getTransporter().sendMail({
      from,
      to,
      subject: `Facture ${invoiceNumber}`,
      html: `
      <h2>Bonjour ${clientName},</h2>
      <p>Veuillez trouver ci-joint votre facture <strong>${invoiceNumber}</strong>.</p>
      <p>N'hésitez pas à nous contacter pour toute question.</p>
      <p>Cordialement</p>
    `,
      attachments: [
        { filename: `${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
      ],
    });
    return { id: info.messageId };
  } catch (error) {
    const err = new Error(`Failed to send email: ${error.message}`);
    err.status = 502;
    throw err;
  }
}

module.exports = { sendInvoiceEmail };
