const express = require('express');
const router  = express.Router();

// ─────────────────────────────────────────────
// MIDDLEWARES
// ─────────────────────────────────────────────
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────
const {
  ajouterDiplome,
  supprimerDiplome,
  getMesDiplomes,
  supprimerPendingDiplome
} = require('../controllers/teacherDocumentController');

// ─────────────────────────────────────────────
// UPLOAD (FIXED IMPORT)
// ─────────────────────────────────────────────
const upload=require('../middleware/upload');

// Safety check (optional but useful in dev)
if (!upload || !upload.uploadDiplome) {
  console.error(" uploadDiplome is undefined. Check Uploadmiddleware export.");
}

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

/**
 * @route   GET /api/teacher/diplomes
 * @desc    Get all diplomas of current teacher
 * @access  Private (Teacher only)
 */
router.get('/',
  protect,
  restrictTo('teacher'),
  getMesDiplomes
);

/**
 * @route   POST /api/teacher/diplomes
 * @desc    Add a new diploma
 * @access  Private (Teacher only)
 */
router.post('/',
  protect,
  restrictTo('teacher'),
  upload.uploadDiplome, //  FIXED
  ajouterDiplome
);

/**
 * @route   DELETE /api/teacher/diplomes/:diplome_id
 * @desc    Delete a diploma
 * @access  Private (Teacher only)
 */
router.delete('/:diplome_id',
  protect,
  restrictTo('teacher'),
  supprimerDiplome
);

router.delete('/pending/:diplome_id',
  protect,
  restrictTo('teacher'),
  supprimerPendingDiplome
);

module.exports = router;