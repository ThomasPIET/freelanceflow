const request = require('supertest');
const app = require('../app');

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const validBody = () => ({
  invoice_number: 'INV-00001',
  invoice: {
    issued_at: '2026-10-20T00:00:00.000Z',
    status: 'sent',
    total_ht: '150.00',
    total_ttc: '180.00',
    tva_rate: '20',
  },
  issuer: {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@test.com',
    address_line1: '1 rue Test',
    address_line2: null,
    zip_code: '75000',
    city: 'Paris',
    country: 'France',
    logo_data: PNG_1X1,
  },
  client: {
    name: 'Acme',
    company: 'Acme Inc',
    email: 'acme@test.com',
    address_line1: '2 avenue Client',
    address_line2: null,
    zip_code: '69000',
    city: 'Lyon',
    country: 'France',
  },
  lines: [{ label: 'Dev Web', quantity: '2', unit_price: '75.00', total: '150.00' }],
});

const binaryParser = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const postPdf = (body) =>
  request(app).post('/pdf/invoice').send(body).buffer(true).parse(binaryParser);

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /pdf/invoice', () => {
  it('renders a PDF', async () => {
    const res = await postPdf(validBody());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('renders without logo, lines, company or issue date', async () => {
    const body = validBody();
    body.issuer.logo_data = null;
    body.client.company = null;
    body.invoice.issued_at = null;
    body.lines = [];

    const res = await postPdf(body);

    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('renders even when the logo is corrupted', async () => {
    const body = validBody();
    body.issuer.logo_data = 'data:image/png;base64,not-an-image';

    const res = await postPdf(body);

    expect(res.status).toBe(200);
  });

  it.each(['invoice_number', 'invoice', 'issuer', 'client', 'lines'])(
    'returns 400 when %s is missing',
    async (field) => {
      const body = validBody();
      delete body[field];

      const res = await request(app).post('/pdf/invoice').send(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
    }
  );

  it('returns 400 when lines is not an array', async () => {
    const res = await request(app)
      .post('/pdf/invoice')
      .send({ ...validBody(), lines: 'nope' });

    expect(res.status).toBe(400);
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await request(app)
      .post('/pdf/invoice')
      .set('Content-Type', 'application/json')
      .send('{"invoice_number":');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
});
