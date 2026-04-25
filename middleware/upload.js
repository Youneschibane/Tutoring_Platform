const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ── Storage général ───────────────────────────────────────────────────────────
const generalStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'tutoring_platform/documents';

    if (file.fieldname === 'photo_profil') {
      folder = 'tutoring_platform/profiles';
    } else if (file.fieldname === 'fichier') {
      folder = 'tutoring_platform/documents';
    }

    return {
      folder: folder,
      allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
      resource_type: 'auto',
      public_id: `${Date.now()}_${file.originalname.split('.')[0]}`
    };
  }
});

// ── Storage signup teacher ────────────────────────────────────────────────────
const signupStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'tutoring_platform/profiles';

    if (file.fieldname === 'cv') {
      folder = 'tutoring_platform/teachers/cv';
    } else if (file.fieldname === 'diplomes') {
      folder = 'tutoring_platform/teachers/diplomes';
    }

    return {
      folder: folder,
      allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
      resource_type: 'auto',
      public_id: `${Date.now()}_${file.originalname.split('.')[0]}`
    };
  }
});

// ── Export principal ──────────────────────────────────────────────────────────
const upload = multer({ storage: generalStorage });

// ── Named export — signup teacher ─────────────────────────────────────────────
upload.uploadTeacherSignup = multer({ storage: signupStorage }).fields([
  { name: 'photo_profil', maxCount: 1  },
  { name: 'cv',           maxCount: 1  },
  { name: 'diplomes',     maxCount: 10 }
]);

module.exports = upload;