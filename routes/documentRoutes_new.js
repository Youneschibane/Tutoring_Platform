const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const { protect } = require('../middleware/authMiddleware');
const { isTeacherAccepted } = require('../Sign_In_Up/Sign_up');

// On ajoute les accolades ici pour extraire la fonction de l'objet exporté
const { addDocument } = require('../gestionDuDocument/addDocument');
const { getStudentDocuments } = require('../gestionDuDocument/getStudentDocument');

// Protected route - teacher uploads documents
/**
 * #swagger.tags = ['Documents']
 * #swagger.summary = "Ajouter un document avec upload de fichier"
 * #swagger.description = "Enseignant: ajouter un cours, exercice ou correction avec fichier"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "multipart/form-data": {
 *       schema: {
 *         type: "object",
 *         required: ["file", "type_document", "access_type", "teacher_id"],
 *         properties: {
 *           file: { type: "string", format: "binary", description: "Fichier (PDF, JPEG, PNG, DOC, DOCX - max 10MB)" },
 *           type_document: { type: "string", example: "cours", description: "Type de document (cours, exercice, correction, etc.)" },
 *           access_type: { type: "string", enum: ["public", "private"], description: "Accès public (pour service) ou privé (pour séance)" },
 *           teacher_id: { type: "number", example: 1042, description: "ID de l'enseignant (idmembre)" },
 *           service: { type: "number", example: 5, description: "ID du service — obligatoire si access_type = public" },
 *           seance: { type: "number", example: 123, description: "ID de la séance — obligatoire si access_type = private" },
 *           description: { type: "string", example: "Exercices de mathématiques 3ème", description: "Description du document (optionnel)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[201] = { description: "Created — document ajouté avec succès" }
 * #swagger.responses[400] = { description: "Bad Request — champs manquants ou fichier invalide" }
 * #swagger.responses[403] = { description: "Forbidden — accès réservé aux enseignants acceptés" }
 * #swagger.responses[404] = { description: "Not Found — enseignant ou service introuvable" }
 * #swagger.responses[409] = { description: "Conflict — document déjà existant" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/add', protect, isTeacherAccepted, upload.single('fichier'), addDocument);

/**
 * #swagger.tags = ['Documents']
 * #swagger.summary = "Récupérer les documents accessibles pour un étudiant"
 * #swagger.description = "Étudiant: récupérer tous les documents publics des services + documents privés des séances réservées"
 * #swagger.security = [{"bearerAuth": []}]
 * #swagger.requestBody = {
 *   required: true,
 *   content: {
 *     "application/json": {
 *       schema: {
 *         type: "object",
 *         required: ["student_id"],
 *         properties: {
 *           student_id: { type: "number", example: 1001, description: "ID de l'étudiant (id_eleve)" }
 *         }
 *       }
 *     }
 *   }
 * }
 * #swagger.responses[200] = { description: "OK — documents récupérés avec succès" }
 * #swagger.responses[400] = { description: "Bad Request — student_id manquant" }
 * #swagger.responses[404] = { description: "Not Found — étudiant introuvable" }
 * #swagger.responses[500] = { description: "Internal Server Error" }
 */
router.post('/get-documents', protect, getStudentDocuments);

module.exports = router;
