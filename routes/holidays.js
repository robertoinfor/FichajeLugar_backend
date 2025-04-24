const router = require('express').Router();
const { getPublicHolidays } = require('../controllers/holidaysController');

router.get('/:year', getPublicHolidays);

module.exports = router;