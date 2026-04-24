const express = require('express');
const router = express.Router();


const { protect } = require('../middleware/authMiddleware');

const { completeProfile } = require('../Sign_In_Up/Sign_up');
const signIn              = require('../Sign_In_Up/Sign_in');
const controller          = require('../Sign_In_Up/Controller');
const { logout } = require('../packProfil/Deconnexion');
const {  logoutOtherDevices } = require('../packProfil/Deconnexion');
const logoutController = require('../packProfil/Deconnexion');
const upload=require('../middleware/upload');

// Logout routes - protected
/**
 * #swagger.tags = ['Authentication']
 * #swagger.summary = "Se déconnecter de l'appareil actuel uniquement"
 * #swagger.description = "Déconnecter l'appareil courant"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.responses[200] = { description: "OK — déconnexion réussie" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/logout', protect, logout);

/**
 * #swagger.tags = ['Authentication']
 * #swagger.summary = "Déconnecter tous les autres appareils"
 * #swagger.description = "Garder la session courante, déconnecter les autres appareils"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.responses[200] = { description: "OK — autres appareils déconnectés" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/logout-other-devices', protect, logoutOtherDevices);

/**
 * #swagger.tags = ['Authentication']
 * #swagger.summary = "Déconnecter tous les appareils"
 * #swagger.description = "Déconnecter tous les appareils y compris l'appareil courant"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.responses[200] = { description: "OK — tous les appareils déconnectés" }
 * #swagger.responses[401] = { description: "Unauthorized — token invalide" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/logout-all',           protect, logoutController.logoutAll);


// Signup / Signin (No middleware - public endpoints)
/**
 * #swagger.tags = ['Authentication']
 * #swagger.summary = "Créer un compte utilisateur avec photo de profil"
 * #swagger.description = "Inscription - Étape 3: créer le compte après vérification OTP"
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "multipart/form-data": {
 *       schema: {
 *         type: "object",
 *         required: ["signupToken", "password", "role", "firstname", "familyname", "postaladr"],
 *         properties: {
 *           photo_profil: { type: "string", format: "binary", description: "Photo de profil (JPEG, PNG - max 5MB)" },
 *           signupToken: { type: "string", example: "eyJhbGc...", description: "Token JWT retourné après vérification OTP" },
 *           password: { type: "string", example: "SecurePass123", description: "Mot de passe (min 8 caractères)" },
 *           role: { type: "string", enum: ["teacher", "student", "parent", "admin"], description: "Rôle de l'utilisateur" },
 *           firstname: { type: "string", example: "Ahmed", description: "Prénom" },
 *           familyname: { type: "string", example: "Benali", description: "Nom de famille" },
 *           postaladr: { type: "number", example: 16000, description: "Code postal" },
 *           profileData: { type: "string", description: "Données supplémentaires selon le rôle (JSON)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[201] = { description: "Created — compte créé avec succès" }
 * #swagger.responses[400] = { description: "Bad Request — champs manquants ou token invalide" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */

router.post('/signup', upload.uploadTeacherSignup, completeProfile);
/**
 * #swagger.tags = ['Authentication']
 * #swagger.summary = "Se connecter avec email/téléphone et mot de passe"
 * #swagger.description = "Connexion à l'application"
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "application/json": {
 *       schema: {
 *         type: "object",
 *         required: ["password"],
 *         properties: {
 *           email: { type: "string", example: "user@example.com", description: "Email (email OU phone requis)" },
 *           phone: { type: "string", example: "+213555123456", description: "Téléphone (email OU phone requis)" },
 *           password: { type: "string", example: "monMotDePasse123", description: "Mot de passe" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — connexion réussie, retourne token" }
 * #swagger.responses[400] = { description: "Bad Request — identifiant ou mot de passe manquant" }
 * #swagger.responses[401] = { description: "Unauthorized — mot de passe incorrect" }
 * #swagger.responses[403] = { description: "Forbidden — compte désactivé" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/signin', signIn);

// Signup OTP (public)
/**
 * #swagger.tags = ['Authentication']
 * #swagger.summary = "Envoyer un code OTP pour l'inscription"
 * #swagger.description = "Étape 1: envoyer OTP par email ou téléphone"
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "application/json": {
 *       schema: {
 *         type: "object",
 *         properties: {
 *           email: { type: "string", example: "user@example.com", description: "Email (email OU phone requis)" },
 *           phone: { type: "string", example: "+213555123456", description: "Téléphone (email OU phone requis)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — code OTP envoyé" }
 * #swagger.responses[400] = { description: "Bad Request — format invalide ou contact déjà utilisé" }
 * #swagger.responses[429] = { description: "Too Many Requests — attendre 1 minute" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/signup/send-otp', controller.sendSignupOtp);

/**
 * #swagger.tags = ['Authentication']
 * #swagger.summary = "Vérifier le code OTP d'inscription"
 * #swagger.description = "Étape 2: vérifier OTP et obtenir signupToken"
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "application/json": {
 *       schema: {
 *         type: "object",
 *         required: ["code"],
 *         properties: {
 *           email: { type: "string", example: "user@example.com", description: "Email" },
 *           phone: { type: "string", example: "+213555123456", description: "Téléphone" },
 *           code: { type: "string", example: "123456", description: "Code OTP reçu (6 chiffres)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — retourne signupToken (valide 20 minutes)" }
 * #swagger.responses[400] = { description: "Bad Request — code incorrect ou expiré" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/signup/verify',   controller.verifySignupOtp);

// Password reset (public - but with OTP verification)
/**
 * #swagger.tags = ['Authentication']
 * #swagger.summary = "Envoyer un code OTP pour réinitialiser le mot de passe"
 * #swagger.description = "Étape 1: envoyer OTP de réinitialisation par email"
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "application/json": {
 *       schema: {
 *         type: "object",
 *         required: ["email"],
 *         properties: {
 *           email: { type: "string", example: "user@example.com", description: "Email de l'utilisateur" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — code OTP envoyé" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable" }
 * #swagger.responses[429] = { description: "Too Many Requests — attendre 1 minute" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/password/send-reset', controller.sendResetOtp);

/**
 * #swagger.tags = ['Authentication']
 * #swagger.summary = "Vérifier le code OTP de réinitialisation"
 * #swagger.description = "Étape 2: vérifier OTP et obtenir resetToken"
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "application/json": {
 *       schema: {
 *         type: "object",
 *         required: ["email", "code"],
 *         properties: {
 *           email: { type: "string", example: "user@example.com", description: "Email de l'utilisateur" },
 *           code: { type: "string", example: "654321", description: "Code OTP reçu (6 chiffres)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — retourne resetToken (valide 15 minutes, à usage unique)" }
 * #swagger.responses[400] = { description: "Bad Request — code incorrect ou expiré" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/password/verify',     controller.verifyResetOtp);

/**
 * #swagger.tags = ['Authentication']
 * #swagger.summary = "Réinitialiser le mot de passe"
 * #swagger.description = "Étape 3: utiliser resetToken pour changer le mot de passe"
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "application/json": {
 *       schema: {
 *         type: "object",
 *         required: ["resetToken", "newPassword"],
 *         properties: {
 *           resetToken: { type: "string", example: "eyJhbGc...", description: "Reset token reçu à l'étape 2" },
 *           newPassword: { type: "string", example: "nouveauMdp123", description: "Nouveau mot de passe (min 8 caractères)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — mot de passe réinitialisé avec succès" }
 * #swagger.responses[400] = { description: "Bad Request — token invalide, expiré ou déjà utilisé" }
 * #swagger.responses[404] = { description: "Not Found — utilisateur introuvable" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/password/reset',      controller.resetPassword);

module.exports = router;