const express = require('express');
const router = express.Router();
const uc = require('../controllers/fcmController');

router.get('/token/:userId', uc.getToken);
router.post('/token', uc.postToken);
router.post('/send', uc.sendNotification);
router.get('/', uc.getTokensFCM)

module.exports = router;

