const express = require('express');
const router = express.Router();
const { protect, protectReactivate } = require('../middleware/authMiddleware');

// 1. Importation du middleware multer
const upload = require('../middleware/upload'); 

const { 
  updateProfile, 
  updateProfileTeacher, 
  updateProfileStudent, 
  updateProfileParent 
} = require('../packProfil/updateProfile');
const { requestPasswordChangeOtp, confirmPasswordChange } = require('../packProfil/updatePassword');
const { deleteAccount, reactivateAccount } = require('../packProfil/supprimerCompte');

// ─────────────────────────────────────────────────────────────────────
// PACK PROFIL ROUTES
// ─────────────────────────────────────────────────────────────────────

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Mettre à jour le profil utilisateur"
 * #swagger.description = "Mettre à jour les données de base (nom, prénom, photo, etc.)"
 * #swagger.security = [{"bearerAuth": []}]
 */
router.patch('/update-profile', protect, upload.single('photo_profil'), updateProfile);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Mettre à jour le profil enseignant"
 * #swagger.security = [{"bearerAuth": []}]
 */
router.patch('/update-profile-teacher', protect, upload.single('photo_profil'), updateProfileTeacher);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Mettre à jour le profil étudiant"
 * #swagger.security = [{"bearerAuth": []}]
 */
router.patch('/update-profile-student', protect, upload.single('photo_profil'), updateProfileStudent);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Mettre à jour le profil parent"
 * #swagger.security = [{"bearerAuth": []}]
 */
router.patch('/update-profile-parent', protect, upload.single('photo_profil'), updateProfileParent);

// ─────────────────────────────────────────────────────────────────────
// PASSWORD MANAGEMENT
// ─────────────────────────────────────────────────────────────────────

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Demander un code OTP pour changer le mot de passe"
 * #swagger.security = [{"bearerAuth": []}]
 */
router.post('/password/request-otp', protect, requestPasswordChangeOtp);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Confirmer et appliquer le changement de mot de passe"
 * #swagger.security = [{"bearerAuth": []}]
 */
router.post('/password/confirm-change', protect, confirmPasswordChange);

// ─────────────────────────────────────────────────────────────────────
// ACCOUNT LIFECYCLE (DELETE & REACTIVATE)
// ─────────────────────────────────────────────────────────────────────

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Demander la suppression du compte"
 * #swagger.description = "Désactive le compte et programme une suppression après 30 jours."
 * #swagger.security = [{"bearerAuth": []}]
 */
router.post('/delete', protect, deleteAccount);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Réactiver un compte en attente de suppression"
 * #swagger.description = "Annule la procédure de suppression. Nécessite le middleware protectReactivate."
 * #swagger.security = [{"bearerAuth": []}]
 */
router.post('/reactivate',protectReactivate, reactivateAccount);

module.exports = router;