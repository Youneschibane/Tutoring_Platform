



const express = require('express');
const router = express.Router();

const addDocument    = require('../gestionDuDocument/addDocument');
const getStudentDocuments = require('../gestionDuDocument/getStudentDocument');
const upload = require('../middleware/upload'); // middleware multer

// Ajouter un document (avec fichier)
router.post('/add', upload.single('fichier'), addDocument);

// Récupérer les documents d'un étudiant
router.post('/student', getStudentDocuments);

module.exports = router;