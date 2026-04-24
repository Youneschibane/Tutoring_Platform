const express = require('express');
const router = express.Router();
const { protect ,protectReactivate } = require('../middleware/authMiddleware');

// 1. Importation de ton middleware multer existant
const upload = require('../middleware/upload'); 

const { updateProfile, updateProfileTeacher, updateProfileStudent, updateProfileParent } = require('../packProfil/updateProfile');
const { requestPasswordChangeOtp, confirmPasswordChange } = require('../packProfil/updatePassword');
const { deleteAccount, reactivateAccount } = require('../packProfil/supprimerCompte');

// ─────────────────────────────────────────────────────────────────────
// All routes in this section require authentication
// ─────────────────────────────────────────────────────────────────────

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Mettre à jour le profil utilisateur"
 * #swagger.description = "Mettre à jour le profil utilisateur (nom, prénom, adresse, email, téléphone, photo)"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "multipart/form-data": {
 *       schema: {
 *         type: "object",
 *         properties: {
 *           firstname: { type: "string", example: "Ahmed", description: "Prénom" },
 *           familyname: { type: "string", example: "Benali", description: "Nom de famille" },
 *           postaladr: { type: "string", example: "Alger", description: "Adresse postale" },
 *           email: { type: "string", example: "user@example.com", description: "Email" },
 *           numberphone: { type: "string", example: "+213555123456", description: "Numéro de téléphone" },
 *           photo_profil: { type: "string", format: "binary", description: "Photo de profil (JPEG, PNG - max 5MB)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — profil mis à jour avec succès" }
 * #swagger.responses[400] = { description: "Bad Request — données invalides" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.patch('/update-profile', protect, upload.single('photo_profil'), updateProfile);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Mettre à jour le profil enseignant"
 * #swagger.description = "Mettre à jour le profil enseignant (nature, localisation, domaines, certifications, etc.)"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "multipart/form-data": {
 *       schema: {
 *         type: "object",
 *         properties: {
 *           firstname: { type: "string", example: "Fatima", description: "Prénom" },
 *           familyname: { type: "string", example: "Durand", description: "Nom de famille" },
 *           postaladr: { type: "string", example: "Tunis", description: "Adresse postale" },
 *           email: { type: "string", example: "teacher@example.com", description: "Email" },
 *           numberphone: { type: "string", example: "+216555123456", description: "Numéro de téléphone" },
 *           nature: { type: "string", enum: ["Independant", "Etablissement", "Centre"], description: "Type d'enseignant" },
 *           latitude: { type: "number", example: 36.753, description: "Latitude de localisation" },
 *           longitude: { type: "number", example: 3.058, description: "Longitude de localisation" },
 *           deplacement: { type: "boolean", example: true, description: "Peut se déplacer?" },
 *           rayon_deplacement: { type: "number", example: 5, description: "Rayon de déplacement (km)" },
 *           description_pedagogique: { type: "string", example: "Spécialisée en mathématiques", description: "Description pédagogique" },
 *           certifications: { type: "string", example: "Master en Éducation", description: "Certifications" },
 *           actif: { type: "boolean", example: true, description: "Profil actif?" },
 *           subjects: { type: "string", example: "Mathématiques, Physique", description: "Matières enseignées" },
 *           photo_profil: { type: "string", format: "binary", description: "Photo de profil (JPEG, PNG - max 5MB)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — profil enseignant mis à jour" }
 * #swagger.responses[400] = { description: "Bad Request — données invalides" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide" }
 * #swagger.responses[403] = { description: "Forbidden — accès réservé aux enseignants" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.patch('/update-profile-teacher', protect, upload.single('photo_profil'), updateProfileTeacher);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Mettre à jour le profil étudiant"
 * #swagger.description = "Mettre à jour le profil étudiant (niveau scolaire, objectifs pédagogiques, etc.)"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "multipart/form-data": {
 *       schema: {
 *         type: "object",
 *         properties: {
 *           firstname: { type: "string", example: "Mohamed", description: "Prénom" },
 *           familyname: { type: "string", example: "Ali", description: "Nom de famille" },
 *           postaladr: { type: "string", example: "Casablanca", description: "Adresse postale" },
 *           email: { type: "string", example: "student@example.com", description: "Email" },
 *           numberphone: { type: "string", example: "+212655123456", description: "Numéro de téléphone" },
 *           yearOfStudy: { type: "string", example: "2024-2025", description: "Année d'étude" },
 *           niveau_scolaire: { type: "string", enum: ["Primary", "Secondary", "High School", "University"], description: "Niveau scolaire" },
 *           objectifs_pedagogiques: { type: "string", example: "Améliorer les notes en maths", description: "Objectifs pédagogiques" },
 *           photo_profil: { type: "string", format: "binary", description: "Photo de profil (JPEG, PNG - max 5MB)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — profil étudiant mis à jour" }
 * #swagger.responses[400] = { description: "Bad Request — données invalides" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide" }
 * #swagger.responses[403] = { description: "Forbidden — accès réservé aux étudiants" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.patch('/update-profile-student', protect, upload.single('photo_profil'), updateProfileStudent);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Mettre à jour le profil parent"
 * #swagger.description = "Mettre à jour le profil parent (enfants, données familiales, etc.)"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "multipart/form-data": {
 *       schema: {
 *         type: "object",
 *         properties: {
 *           firstname: { type: "string", example: "Karim", description: "Prénom" },
 *           familyname: { type: "string", example: "Hassan", description: "Nom de famille" },
 *           postaladr: { type: "string", example: "Rabat", description: "Adresse postale" },
 *           email: { type: "string", example: "parent@example.com", description: "Email" },
 *           numberphone: { type: "string", example: "+212755123456", description: "Numéro de téléphone" },
 *           enfants: { type: "string", example: "[\"507f1f77bcf86cd799439011\"]", description: "IDs des enfants (JSON array)" },
 *           photo_profil: { type: "string", format: "binary", description: "Photo de profil (JPEG, PNG - max 5MB)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — profil parent mis à jour" }
 * #swagger.responses[400] = { description: "Bad Request — données invalides" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide" }
 * #swagger.responses[403] = { description: "Forbidden — accès réservé aux parents" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.patch('/update-profile-parent', protect, upload.single('photo_profil'), updateProfileParent);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Demander un code OTP pour changer le mot de passe"
 * #swagger.description = "Envoyer un OTP à l'utilisateur pour changer son mot de passe"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.requestBody = {
 **
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Demander la suppression du compte"
 * #swagger.description = "Marquer le compte pour suppression (statut: pending_deletion)"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.responses[200] = { description: "OK — demande de suppression enregistrée" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide ou manquant" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable" }
 * #swagger.responses[409] = { description: "Conflict — suppression déjà en cours" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/delete', protect, deleteAccount);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Réactiver un compte en attente de suppression"
 * #swagger.description = "Annuler la demande de suppression et réactiver le compte"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.responses[200] = { description: "OK — compte réactivé" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide ou manquant" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable ou pas en attente de suppression" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/reactivate', protect, reactivateAccount);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Demander un code OTP pour changer le mot de passe"
 * #swagger.description = "Envoyer un OTP à l'utilisateur pour changer son mot de passe"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.requestBody = {
 **
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Demander la suppression du compte"
 * #swagger.description = "Marquer le compte pour suppression (statut: pending_deletion)"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.responses[200] = { description: "OK — demande de suppression enregistrée" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide ou manquant" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable" }
 * #swagger.responses[409] = { description: "Conflict — suppression déjà en cours" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/delete', protect, deleteAccount);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Réactiver un compte en attente de suppression"
 * #swagger.description = "Annuler la demande de suppression et réactiver le compte"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.responses[200] = { description: "OK — compte réactivé" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide ou manquant" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable ou pas en attente de suppression" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/reactivate', protect, reactivateAccount);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Demander un code OTP pour changer le mot de passe"
 * #swagger.description = "Envoyer un OTP à l'utilisateur pour changer son mot de passe"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.requestBody = {
 **
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Demander la suppression du compte"
 * #swagger.description = "Marquer le compte pour suppression (statut: pending_deletion)"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.responses[200] = { description: "OK — demande de suppression enregistrée" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide ou manquant" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable" }
 * #swagger.responses[409] = { description: "Conflict — suppression déjà en cours" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/delete', protect, deleteAccount);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Réactiver un compte en attente de suppression"
 * #swagger.description = "Annuler la demande de suppression et réactiver le compte"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.responses[200] = { description: "OK — compte réactivé" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide ou manquant" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable ou pas en attente de suppression" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/reactivate', protect, reactivateAccount);

/** 
 */
router.post('/password/request-otp', protect, requestPasswordChangeOtp);

/**
 * #swagger.tags = ['Pack Profil']
 * #swagger.summary = "Confirmer et appliquer le changement de mot de passe"
 * #swagger.description = "Vérifier l'OTP et appliquer le nouveau mot de passe (étape 2)"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "application/json": {
 *       schema: {
 *         type: "object",
 *         required: ["otp", "newPassword"],
 *         properties: {
 *           otp: { type: "string", example: "123456", description: "Code OTP reçu (6 chiffres)" },
 *           newPassword: { type: "string", example: "newPassword123", description: "Nouveau mot de passe (min 8 caractères)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — mot de passe changé avec succès" }
 * #swagger.responses[400] = { description: "Bad Request — code incorrect ou mot de passe invalide" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide ou OTP expiré" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/password/confirm-change', protect, confirmPasswordChange);

// Account deletion - changed to POST, removed :id parameter (uses req.user.id)
router.post('/delete', protect, deleteAccount);

// Account reactivation - changed to POST, removed :id parameter (uses req.user.id)
router.post('/reactivate', protectReactivate , reactivateAccount);

module.exports = router;
