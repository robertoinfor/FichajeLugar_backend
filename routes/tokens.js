const express = require('express');
const router = express.Router();
const uc = require('../controllers/tokensController');

// Rutas para las acciones del controlador
router.post('/decrypt', uc.decrypt);
router.delete('/:id/delete', uc.deleteToken);
router.post('/', uc.postToken),
router.get('/', uc.getTokens)

module.exports = router;
