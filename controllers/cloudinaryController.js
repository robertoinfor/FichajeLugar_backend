const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');

// Configura el almacenamiento en Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'usuarios',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage });

exports.uploadMiddleware = upload.single('file');

exports.uploadToCloudinary = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ninguna imagen' });
    }

    const imageUrl = req.file.path;
    return res.status(200).json({ fileUrl: imageUrl });
  } catch (error) {
    console.error('Error al subir imagen a Cloudinary:', error);
    return res.status(500).json({ error: 'Error al subir la imagen' });
  }
};
