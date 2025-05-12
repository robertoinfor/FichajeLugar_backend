const router = require('express').Router();
const { uploadMiddleware } = require('../utils/drive');
const { handleUpload } = require('../controllers/driveController');

// Ruta para subir la imagen a Drive
router.post('/', uploadMiddleware.single('file'), handleUpload);

module.exports = router;
