const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');

// ─────────────────────────────────────────────
// CLOUDINARY CONFIG
// ─────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ─────────────────────────────────────────────
// HELPER — public_id safe
// ─────────────────────────────────────────────
const safePublicId = (originalname) => {
  const name = path.parse(originalname).name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 60);

  return `${Date.now()}_${name}`;
};

// ─────────────────────────────────────────────
// MIME TYPES
// ─────────────────────────────────────────────
const IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const DOC_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const ALL_MIMES = [...IMAGE_MIMES, ...DOC_MIMES];

// ─────────────────────────────────────────────
// DETECT RESOURCE TYPE ( FIX)
// ─────────────────────────────────────────────
const getResourceType = (file) => {
  return IMAGE_MIMES.includes(file.mimetype) ? 'image' : 'raw';
};

// ─────────────────────────────────────────────
// FILE FILTER
// ─────────────────────────────────────────────
const makeFileFilter = (rules) => (req, file, cb) => {
  const allowed = rules[file.fieldname] || rules['*'] || ALL_MIMES;

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(
      `Type de fichier non autorisé pour "${file.fieldname}". Formats acceptés : ${allowed.join(', ')}`
    ), false);
  }
};

// ─────────────────────────────────────────────
// GENERAL STORAGE
// ─────────────────────────────────────────────
const generalStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const folder =
      file.fieldname === 'photo_profil'
        ? 'tutoring_platform/profiles'
        : 'tutoring_platform/documents';

    return {
      folder,
      resource_type: getResourceType(file), //  FIX
      type: 'upload',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx'],
      public_id: safePublicId(file.originalname)
    };
  }
});

// ─────────────────────────────────────────────
// SIGNUP STORAGE
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
      resource_type: getResourceType(file), //  FIX
      type: 'upload',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx'],
      public_id: safePublicId(file.originalname)
    };
  }
});

// ─────────────────────────────────────────────
// DIPLOME STORAGE
// ─────────────────────────────────────────────
const diplomeStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'tutoring_platform/teachers/diplomes',
    resource_type: getResourceType(file), //  FIX
    type: 'upload',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
    public_id: safePublicId(file.originalname)
  })
});

// ─────────────────────────────────────────────
// MULTER INSTANCES
// ─────────────────────────────────────────────

// General upload
const upload = multer({
  storage: generalStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: makeFileFilter({
    photo_profil: IMAGE_MIMES,
    '*': ALL_MIMES
  })
});

// Teacher signup
upload.uploadTeacherSignup = multer({
  storage: signupStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: makeFileFilter({
    photo_profil: IMAGE_MIMES,
    cv: DOC_MIMES,
    diplomes: ALL_MIMES
  })
}).fields([
  { name: 'photo_profil', maxCount: 1 },
  { name: 'cv', maxCount: 1 },
  { name: 'diplomes', maxCount: 10 }
]);

// Living document upload for IA processing
const livingDocumentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'tutoring_platform/living_documents',
    resource_type: getResourceType(file),
    type: 'upload',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx'],
    public_id: safePublicId(file.originalname)
  })
});

const livingDocumentUploader = multer({
  storage: livingDocumentStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: makeFileFilter({
    living_document: ALL_MIMES,
    document: ALL_MIMES,
    '*': ALL_MIMES
  })
});

upload.uploadLivingDocument = (req, res, next) => {
  const middleware = livingDocumentUploader.fields([
    { name: 'living_document', maxCount: 1 },
    { name: 'document', maxCount: 1 }
  ]);

  middleware(req, res, (err) => {
    if (err) return next(err);

    if (!req.files || (!req.files.living_document && !req.files.document)) {
      return res.status(400).json({
        status: 'fail',
        message: "Aucun fichier envoyé. Utiliser le champ 'living_document' ou 'document'."
      });
    }

    req.file = req.files.living_document ? req.files.living_document[0] : req.files.document[0];
    next();
  });
};

// Single diploma upload (accept both diplome and diplomes field names)
const diplomeUploader = multer({
  storage: diplomeStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: makeFileFilter({
    diplome: ALL_MIMES,
    diplomes: ALL_MIMES
  })
});

upload.uploadDiplome = (req, res, next) => {
  const middleware = diplomeUploader.fields([
    { name: 'diplome', maxCount: 1 },
    { name: 'diplomes', maxCount: 1 }
  ]);

  middleware(req, res, (err) => {
    if (err) return next(err);

    if (!req.files || (!req.files.diplome && !req.files.diplomes)) {
      return next();
    }

    const diplomeFile = req.files.diplome ? req.files.diplome[0] : req.files.diplomes[0];
    req.file = diplomeFile;
    next();
  });
};

module.exports = upload;