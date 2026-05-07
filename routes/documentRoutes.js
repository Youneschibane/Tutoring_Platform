const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const { protect , restrictTo } = require('../middleware/authMiddleware');
const { isTeacherAccepted } = require('../Sign_In_Up/Sign_up');

// On ajoute les accolades ici pour extraire la fonction de l'objet exporté
const { addDocument } = require('../gestionDuDocument/addDocument');
const { getStudentDocuments } = require('../gestionDuDocument/getStudentDocument');
const { getSessionDocuments } = require('../controllers/sessionDocumentsController');
// Protected route - students request documents using POST
router.post('/get-documents', protect, getStudentDocuments);
router.post('/get-session-documents', protect, getSessionDocuments);
/*
  #swagger.tags = ['Documents']
  #swagger.summary = 'Ajouter un document'
  #swagger.consumes = ['multipart/form-data']
  #swagger.parameters['type_document'] = {
    in: 'formData',
    type: 'string',
    required: true,
    description: 'Type du document'
  }
  #swagger.parameters['access_type'] = {
    in: 'formData',
    type: 'string',
    required: true,
    enum: ['public', 'private'],
    description: 'Niveau d\'accès du document'
  }
  #swagger.parameters['teacher_id'] = {
    in: 'formData',
    type: 'string',
    required: true,
    description: 'ID numérique de l\'enseignant'
  }
  #swagger.parameters['service'] = {
    in: 'formData',
    type: 'string',
    required: false,
    description: 'Obligatoire si access_type = public'
  }
  #swagger.parameters['seance'] = {
    in: 'formData',
    type: 'string',
    required: false,
    description: 'Obligatoire si access_type = private'
  }
  #swagger.parameters['description'] = {
    in: 'formData',
    type: 'string',
    required: false,
    description: 'Description du document (optionnel)'
  }
  #swagger.parameters['fichier'] = {
    in: 'formData',
    type: 'file',
    required: true,
    description: 'Fichier à uploader (PDF, JPEG, PNG, DOC, DOCX - max 10MB)'
  }
  #swagger.responses[201] = { description: 'Document créé avec succès' }
  #swagger.responses[400] = { description: 'Champ manquant / fichier invalide / incohérence access_type' }
  #swagger.responses[403] = { description: 'Enseignant non propriétaire du service ou de la séance' }
  #swagger.responses[404] = { description: 'Enseignant / service / séance introuvable' }
  #swagger.responses[409] = { description: 'Document en doublon' }
  #swagger.responses[500] = { description: 'Erreur serveur' }
*/
//a route for add documents 
router.post('/add', protect,restrictTo('teacher'), upload.single('fichier'), addDocument);
/*
  #swagger.tags = ['Documents']
  #swagger.summary = 'Récupérer les documents accessibles à un étudiant'
  #swagger.parameters['body'] = {
    in: 'body',
    required: true,
    schema: {
      $student_id: 'STU123'
    }
  }
  #swagger.responses[200] = {
    description: 'Documents récupérés avec succès',
    schema: {
      message: 'Documents récupérés avec succès',
      total: 4,
      data: [
        {
          service: { _id: '', nom: '', description: '' },
          documents_publics: [],
          documents_prives: []
        }
      ]
    }
  }
  #swagger.responses[400] = { description: 'student_id manquant' }
  #swagger.responses[404] = { description: 'Étudiant introuvable' }
  #swagger.responses[500] = { description: 'Erreur serveur' }
*/

module.exports = router;