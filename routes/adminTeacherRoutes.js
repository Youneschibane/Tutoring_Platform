const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getPendingTeachers,
  getTeacherFullProfile,
  acceptTeacher,
  rejectTeacher,
  reviewTeacherDiplome
} = require('../controllers/adminTeacherController');

// Récupère les enseignants en attente
router.get('/pending', protect, restrictTo('admin'), getPendingTeachers);

// Récupère le profil complet (/:id doit correspondre au contrôleur)
router.get('/:id', protect, restrictTo('admin'), getTeacherFullProfile);

// Accepter un enseignant
router.post('/:id/accept', protect, restrictTo('admin'), acceptTeacher);

// Rejeter un enseignant
router.post('/:id/reject', protect, restrictTo('admin'), rejectTeacher);

// Examiner un diplôme en attente par sujet
router.post('/:id/diplomes/:diplome_id/review', protect, restrictTo('admin'), reviewTeacherDiplome);

module.exports = router;
