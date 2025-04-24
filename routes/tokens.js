const express = require('express');
const router = express.Router();
const uc = require('../controllers/tokensController');

router.post('/decrypt', uc.decrypt);
router.delete('/:id/delete', uc.deleteToken);
router.get('/', uc.getTokens)

module.exports = router;
