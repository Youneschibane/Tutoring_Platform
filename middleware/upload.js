
const multer  = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// ─────────────────────────────────────────────
// CLOUDINARY CONFIG
// ─────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ─────────────────────────────────────────────
// IMPORTANT RULE:
// ALL FILES ARE PUBLIC (NO 401)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// GENERAL STORAGE (PUBLIC FILES)
// ─────────────────────────────────────────────
const generalStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = 'tutoring_platform/documents';

    if (file.fieldname === 'photo_profil') {
      folder = 'tutoring_platform/profiles';
    }

    return {
      folder,
      resource_type: 'auto', // supports image + pdf + doc
      type: 'upload', //  PUBLIC ACCESS
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
      public_id: `${Date.now()}_${file.originalname.split('.')[0]}`
    };
  }
});

// ─────────────────────────────────────────────
// TEACHER SIGNUP STORAGE
// ─────────────────────────────────────────────
const signupStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = 'tutoring_platform/profiles';

    if (file.fieldname === 'cv') {
      folder = 'tutoring_platform/teachers/cv';
    }

    if (file.fieldname === 'diplomes') {
      folder = 'tutoring_platform/teachers/diplomes';
    }

    return {
      folder,
      resource_type: 'auto', //  FIX: PDFs included
      type: 'upload', //  PUBLIC ACCESS
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
      public_id: `${Date.now()}_${file.originalname.split('.')[0]}`
    };
  }
});

// ─────────────────────────────────────────────
// SINGLE DIPLOMA UPLOAD
// ─────────────────────────────────────────────
const diplomeStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'tutoring_platform/teachers/diplomes',
      resource_type: 'auto', //  FIX PDF + IMAGE
      type: 'upload', //  PUBLIC ACCESS
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
      public_id: `${Date.now()}_${file.originalname.split('.')[0]}`
    };
  }
});

// ─────────────────────────────────────────────
// MULTER EXPORT
// ─────────────────────────────────────────────
const upload = multer({ storage: generalStorage });

// ─────────────────────────────────────────────
// TEACHER SIGNUP UPLOAD
// ─────────────────────────────────────────────
upload.uploadTeacherSignup = multer({ storage: signupStorage }).fields([
  { name: 'photo_profil', maxCount: 1 },
  { name: 'cv', maxCount: 1 },
  { name: 'diplomes', maxCount: 10 }
]);

// ─────────────────────────────────────────────
// DIPLOMA UPLOAD ONLY
// ─────────────────────────────────────────────
upload.uploadDiplome = multer({
  storage: diplomeStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('diplome');

module.exports = upload;
