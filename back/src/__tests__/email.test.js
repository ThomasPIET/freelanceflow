const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: mockSendMail })) }));

const message = {
  to: 'acme@test.com',
  clientName: 'Acme',
  invoiceNumber: 'INV-00001',
  pdfBuffer: Buffer.from('%PDF'),
};

function loadService(env) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };
  return {
    nodemailer: require('nodemailer'),
    emailService: require('../services/email.service'),
  };
}

const ORIGINAL_ENV = process.env;

describe('email.service', () => {
  beforeEach(() => mockSendMail.mockReset());
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  const mailpitEnv = {
    SMTP_HOST: 'mailpit',
    SMTP_PORT: '1025',
    SMTP_SECURE: 'false',
    MAIL_FROM: 'factures@freelanceflow.local',
  };

  it('sends the invoice with the PDF attached', async () => {
    const { nodemailer, emailService } = loadService(mailpitEnv);
    mockSendMail.mockResolvedValue({ messageId: '<abc@mailpit>' });

    const result = await emailService.sendInvoiceEmail(message);

    expect(result).toEqual({ id: '<abc@mailpit>' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'mailpit',
      port: 1025,
      secure: false,
      auth: undefined,
    });
    const mail = mockSendMail.mock.calls[0][0];
    expect(mail.from).toBe('factures@freelanceflow.local');
    expect(mail.to).toBe('acme@test.com');
    expect(mail.subject).toBe('Facture INV-00001');
    expect(mail.attachments).toEqual([
      { filename: 'INV-00001.pdf', content: message.pdfBuffer, contentType: 'application/pdf' },
    ]);
  });

  it('uses SMTP credentials when SMTP_USER is set', async () => {
    const { nodemailer, emailService } = loadService({
      ...mailpitEnv,
      SMTP_USER: 'resend',
      SMTP_PASS: 'key',
      SMTP_SECURE: 'true',
      SMTP_PORT: '465',
    });
    mockSendMail.mockResolvedValue({ messageId: 'id' });

    await emailService.sendInvoiceEmail(message);

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true, auth: { user: 'resend', pass: 'key' } })
    );
  });

  it('throws a 502 error when SMTP fails', async () => {
    const { emailService } = loadService(mailpitEnv);
    mockSendMail.mockRejectedValue(new Error('connection refused'));

    await expect(emailService.sendInvoiceEmail(message)).rejects.toMatchObject({
      status: 502,
      message: 'Failed to send email: connection refused',
    });
  });
});
