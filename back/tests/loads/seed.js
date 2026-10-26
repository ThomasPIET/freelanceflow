/**
 * Seed script for k6 load tests.
 *
 * Creates 10 test users, each with:
 *   - 1 client
 *   - 2 services
 *   - 3 invoices (each with 2 invoice lines)
 *
 * Outputs tests/loads/config/users.json so k6 scenarios can read
 * credentials and invoice IDs without hitting the DB themselves.
 *
 * Usage:
 *   node tests/loads/seed.js           # create test data
 *   node tests/loads/seed.js --clean   # delete test data only
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Load models (also registers associations)
const { sequelize, User, Client, Service, Invoice, InvoiceLine } = require('../../src/models/index');

const LOAD_TEST_PASSWORD = 'LoadTest123!';
const SALT_ROUNDS = 10;
const USER_COUNT = 10;
const EMAIL_PREFIX = 'load_user_';
const EMAIL_DOMAIN = '@loadtest.internal';

function userEmail(i) {
  return `${EMAIL_PREFIX}${i}${EMAIL_DOMAIN}`;
}

async function clean() {
  console.log('Cleaning existing load test users...');
  const emails = Array.from({ length: USER_COUNT }, (_, i) => userEmail(i + 1));
  const users = await User.findAll({ where: { email: emails } });
  const userIds = users.map((u) => u.id);

  if (userIds.length === 0) {
    console.log('Nothing to clean.');
    return;
  }

  // Suppression dans le bon ordre pour respecter les contraintes FK
  const invoices = await Invoice.findAll({ where: { user_id: userIds } });
  const invoiceIds = invoices.map((inv) => inv.id);
  if (invoiceIds.length > 0) {
    await InvoiceLine.destroy({ where: { invoice_id: invoiceIds } });
  }
  await Invoice.destroy({ where: { user_id: userIds } });
  await Client.destroy({ where: { user_id: userIds } });
  await Service.destroy({ where: { user_id: userIds } });
  await User.destroy({ where: { id: userIds } });

  console.log(`Deleted ${userIds.length} load test users (and their data).`);
}

async function seed() {
  const passwordHash = await bcrypt.hash(LOAD_TEST_PASSWORD, SALT_ROUNDS);
  const output = [];

  for (let i = 1; i <= USER_COUNT; i++) {
    const email = userEmail(i);

    // Upsert user (safe to re-run)
    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({
        email,
        password_hash: passwordHash,
        first_name: `Load`,
        last_name: `User${i}`,
        address_line1: '1 rue du Test',
        zip_code: '75000',
        city: 'Paris',
        country: 'France',
      });
    }

    // Client
    let client = await Client.findOne({ where: { user_id: user.id } });
    if (!client) {
      client = await Client.create({
        user_id: user.id,
        name: `Client Load ${i}`,
        email: `client${i}@loadtest.internal`,
        company: `Acme Load ${i}`,
        address_line1: '2 avenue du Client',
        zip_code: '75001',
        city: 'Paris',
        country: 'France',
      });
    }

    // Services
    const services = [];
    for (const [label, rate] of [
      ['Développement web', 800],
      ['Consulting', 1200],
    ]) {
      let svc = await Service.findOne({ where: { user_id: user.id, label } });
      if (!svc) {
        svc = await Service.create({ user_id: user.id, label, hourly_rate: rate });
      }
      services.push(svc);
    }

    // Invoices
    const invoiceIds = [];
    for (let j = 1; j <= 3; j++) {
      const tva = 20.0;
      const totalHt = 1000 * j;
      const totalTtc = totalHt * (1 + tva / 100);

      let invoice = await Invoice.findOne({
        where: { user_id: user.id, client_id: client.id, total_ht: totalHt },
      });

      if (!invoice) {
        invoice = await Invoice.create({
          user_id: user.id,
          client_id: client.id,
          status: 'sent',
          total_ht: totalHt,
          tva_rate: tva,
          total_ttc: totalTtc,
          issued_at: new Date(),
        });

        // 2 invoice lines per invoice
        for (let k = 0; k < 2; k++) {
          const svc = services[k];
          const qty = j + k;
          const unitPrice = parseFloat(svc.hourly_rate);
          await InvoiceLine.create({
            invoice_id: invoice.id,
            service_id: svc.id,
            quantity: qty,
            unit_price: unitPrice,
            total: qty * unitPrice,
          });
        }
      }

      invoiceIds.push(invoice.id);
    }

    output.push({ email, password: LOAD_TEST_PASSWORD, invoice_ids: invoiceIds });
    console.log(`  ✓ User ${i}/${USER_COUNT}: ${email} (invoices: ${invoiceIds.join(', ')})`);
  }

  const outPath = path.join(__dirname, 'config', 'users.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${output.length} users to ${outPath}`);
}

async function main() {
  const isClean = process.argv.includes('--clean');
  try {
    await sequelize.authenticate();
    console.log('DB connected.\n');
    await clean();
    if (!isClean) {
      console.log(`\nSeeding ${USER_COUNT} load test users...`);
      await seed();
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
