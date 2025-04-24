const express = require('express');
const router = express.Router();
const uc = require('../controllers/locationsController');

router.get('/', uc.getLocations);
router.put('/:id/changeState', uc.changeStateLocation);
router.put('/:id/changeName', uc.updateLocation);
router.post('/', uc.postLocation)

module.exports = router;