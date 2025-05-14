const express = require('express');
const router = express.Router();
const { uploadMiddleware, uploadToCloudinary } = require('../controllers/cloudinaryController');

// Ruta POST /upload
router.post('/upload', uploadMiddleware, uploadToCloudinary);

module.exports = router;
