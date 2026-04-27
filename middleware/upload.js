const multer  = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ── Storage général ───────────────────────────────────────────────────────────
// upload.single('photo_profil') et upload.single('fichier') — inchangés
const generalStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = 'tutoring_platform/documents';

    if (file.fieldname === 'photo_profil') {
      folder = 'tutoring_platform/profiles';
    } else if (file.fieldname === 'fichier') {
      folder = 'tutoring_platform/documents';
    }

    return {
      folder,
      allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
      resource_type:   'auto',
      public_id:       `${Date.now()}_${file.originalname.split('.')[0]}`
    };
  }
});

// ── Storage signup teacher ────────────────────────────────────────────────────
// photo_profil + cv + diplomes dans des dossiers séparés
const signupStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = 'tutoring_platform/profiles';

    if (file.fieldname === 'cv') {
      folder = 'tutoring_platform/teachers/cv';
    } else if (file.fieldname === 'diplomes') {
      folder = 'tutoring_platform/teachers/diplomes';
    }

    return {
      folder,
      allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
      resource_type:   'auto',
      public_id:       `${Date.now()}_${file.originalname.split('.')[0]}`
    };
  }
});

// ── Storage diplôme individuel ────────────────────────────────────────────────
// Utilisé pour l'ajout d'un diplôme après inscription
const diplomeStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder:          'tutoring_platform/teachers/diplomes',
      allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
      resource_type:   'auto',
      public_id:       `${Date.now()}_${file.originalname.split('.')[0]}`
    };
  }
});

// ── Export principal ──────────────────────────────────────────────────────────
// Toutes les routes existantes continuent à fonctionner SANS modification
const upload = multer({ storage: generalStorage });

// ── Named exports ─────────────────────────────────────────────────────────────
upload.uploadTeacherSignup = multer({ storage: signupStorage }).fields([
  { name: 'photo_profil', maxCount: 1  },
  { name: 'cv',           maxCount: 1  },
  { name: 'diplomes',     maxCount: 10 }
]);

upload.uploadDiplome = multer({
  storage: diplomeStorage,
  limits: { fieldSize: 10 * 1024 * 1024 } // 10 MB per field
}).single('diplome');

module.exports = upload;