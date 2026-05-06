const express = require('express');
const router = express.Router();
const devisController = require('../controllers/devisController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// we restrict la demande a l etudiant uniquement 
router.post('/demander', protect, restrictTo('student' , 'parent'), devisController.creerDevis);

// we restrict la demande au prof uniquement 
router.patch('/repondre/:id', protect, restrictTo('teacher'), devisController.repondreDevis);

// both can see their devis 
router.get('/Mesdevis' , protect , devisController.getMesDevis);

router.put('/repondreEtud/:id' , protect , restrictTo('student'  , 'parent') , devisController.reponseFinaleEtudiant);

module.exports = router;