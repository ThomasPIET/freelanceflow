const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const clientController = require('../controllers/client.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', clientController.getAll);
router.get('/export', clientController.exportCsv);
router.get('/:id', clientController.getById);
router.post('/', clientController.create);
router.put('/:id', clientController.update);
router.delete('/:id', clientController.remove);

module.exports = router;
