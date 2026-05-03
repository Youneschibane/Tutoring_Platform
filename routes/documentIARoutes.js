const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  createLivingDocument,
  getLivingDocumentStatus,
  listLivingDocuments
} = require('../controllers/documentIAController');

// POST /api/documents/ia/
router.post('/',
  protect,
  restrictTo('teacher'),
  upload.uploadLivingDocument,
  createLivingDocument
);

// GET /api/documents/ia/:id
router.get('/:id',
  protect,
  restrictTo('teacher'),
  getLivingDocumentStatus
);

// GET /api/documents/ia/
router.get('/',
  protect,
  restrictTo('teacher'),
  listLivingDocuments
);

module.exports = router;
