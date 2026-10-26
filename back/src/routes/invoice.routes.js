const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middlewares/auth.middleware');
const invoiceController = require('../controllers/invoice.controller');

const sendEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: 'Too many emails sent, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

router.use(authMiddleware);

router.get('/', invoiceController.getAll);
router.get('/export', invoiceController.exportCsv);
router.get('/:id', invoiceController.getById);
router.get('/:id/pdf', invoiceController.getPdf);
router.post('/:id/send', sendEmailLimiter, invoiceController.sendEmail);
router.post('/', invoiceController.create);
router.put('/:id', invoiceController.update);
router.delete('/:id', invoiceController.remove);

module.exports = router;
