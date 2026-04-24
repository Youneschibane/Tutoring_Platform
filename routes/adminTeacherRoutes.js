// routes/adminTeacherRoutes.js
// Routes admin pour gérer la validation des enseignants

const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getPendingTeachers,
  getTeacherFullProfile,
  acceptTeacher,
  rejectTeacher
} = require('../controllers/adminTeacherController');

/**
 * GET /api/admin/teachers/pending
 * Récupère tous les enseignants en attente d'approbation
 * - Authentification: requise (Bearer token)
 * - Autorisation: admins uniquement
 */
router.get('/pending', protect, restrictTo('admin'), getPendingTeachers);

/**
 * GET /api/admin/teachers/:id
 * Récupère le profil complet d'un enseignant + ses documents
 * Params: id = id_enseignant (Number)
 * - Authentification: requise
 * - Autorisation: admins uniquement
 */
router.get('/:id', protect, restrictTo('admin'), getTeacherFullProfile);

/**
 * POST /api/admin/teachers/:id/accept
 * Accepte un enseignant en attente
 * Params: id = id_enseignant (Number)
 * Body: vide
 * - Authentification: requise
 * - Autorisation: admins uniquement
 */
router.post('/:id/accept', protect, restrictTo('admin'), acceptTeacher);

/**
 * POST /api/admin/teachers/:id/reject
 * Rejette un enseignant en attente
 * Params: id = id_enseignant (Number)
 * Body: { reason: string } — obligatoire
 * - Authentification: requise
 * - Autorisation: admins uniquement
 */
router.post('/:id/reject', protect, restrictTo('admin'), rejectTeacher);

module.exports = router;
