const router = require('express').Router();
const { getPublicHolidays } = require('../controllers/holidaysController');

// Ruta para recoger los festivos
router.get('/:year', getPublicHolidays);

module.exports = router;