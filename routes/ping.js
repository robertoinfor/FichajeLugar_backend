const express = require('express');
const router = express.Router();

// Ruta y acción para hacer un ping (el backend de Render no se apague)
router.get('/', (req, res) => {
    res.send('pong');
});

module.exports = router;
