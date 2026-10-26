const express = require('express');

const authRoutes = require('./auth.routes');
const clientRoutes = require('./client.routes');
const serviceRoutes = require('./service.routes');
const invoiceRoutes = require('./invoice.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/clients', clientRoutes);
router.use('/services', serviceRoutes);
router.use('/invoices', invoiceRoutes);

module.exports = router;
