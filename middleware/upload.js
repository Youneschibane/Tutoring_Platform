const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tutoring_platform/documents', // dossier dans Cloudinary
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
    resource_type: 'auto' // détecte automatiquement le type
  }
});

const upload = multer({ storage });

module.exports = upload;