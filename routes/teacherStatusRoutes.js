// routes/teacherStatusRoutes.js
// Routes pour les enseignants : consultation du statut de validation

const express = require('express');
const router = express.Router();

const { protect, restrictTo, skipAcceptedCheck } = require('../middleware/authMiddleware');
const { getMyStatus } = require('../controllers/teacherStatusController');

/**
 * GET /api/teacher/me/status
 * Récupère le statut de validation de l'enseignant connecté
 * Cette route est accessible MÊME si l'enseignant n'est pas encore accepté
 * Car elle utilise skipAcceptedCheck pour bypasser la vérification d'acceptation
 *
 * Ordre des middlewares IMPORTANT:
 * 1. skipAcceptedCheck — définit req.skipAcceptedCheck = true (avant protect)
 * 2. protect — authentifie et charge req.user (consulte skipAcceptedCheck)
 * 3. restrictTo('teacher') — vérifie le rôle
 * 4. getMyStatus — retourne le statut
 *
 * - Authentification: requise (Bearer token)
 * - Autorisation: enseignants uniquement
 * - Accessibilité: même les enseignants non acceptés
 */
router.get('/me/status', skipAcceptedCheck, protect, restrictTo('teacher'), getMyStatus);

module.exports = router;
